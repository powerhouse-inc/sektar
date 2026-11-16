/**
 * Who the app conversion workflow may run as, judged afresh on each ensure:
 * the person who granted it, through a Renown delegation naming exactly this
 * app; the host, only where no person is needed; or nobody, with the reason
 * a person can act on. Follows the Integration pattern
 * (processors/integration-reconciler/grant.ts) with its own resource, so an
 * Integration grant never authorizes conversion.
 */
import type {
  DelegationClaims,
  DelegationCredentialStatus,
} from "@renown/sdk/node";
import {
  decodeDelegation,
  parsePkhDid,
  verifyDelegation,
} from "@renown/sdk/node";
import { APP_CONVERSION_RESOURCE } from "../contracts.js";

export const PUBLISH_WORKFLOW = "PUBLISH_WORKFLOW";

export type HostAuthorizationPolicy =
  | "OPEN"
  | "ADMIN_ONLY"
  | "DOCUMENT_PERMISSIONS";

export interface Person {
  readonly address: string;
  readonly networkId: string;
  readonly chainId: number;
}

export interface HostFacts {
  /** The host's own key; null where it has none. */
  readonly environment: string | null;
  /** Who the host is signed in as; null when nobody. */
  readonly address: string | null;
  /** Reads need a person here. */
  readonly requiresPerson: boolean;
}

export type GrantGap = "missing" | "ended" | "revoked" | "invalid";

export type ConversionAuthority =
  /** Publish as the host: only on a host where reads need no person and nobody granted. */
  | { readonly kind: "host" }
  | {
      readonly kind: "delegated";
      readonly person: Person;
      readonly statement: string;
      readonly expiresAt: string;
    }
  | {
      readonly kind: "needs-grant";
      readonly gap: GrantGap;
      readonly message: string;
      readonly endedAt?: string;
    }
  | {
      readonly kind: "refused";
      readonly code: "audience-unproven";
      readonly message: string;
    };

export interface JudgeConversionAuthority {
  /** The signed delegation from the browser; null when none was given. */
  readonly statement: string | null;
  readonly host: HostFacts;
  readonly authorization: HostAuthorizationPolicy;
  /** The runner key's DID; null when it could not be read. */
  readonly delegate: string | null;
  /** Epoch seconds. */
  readonly now: number;
  /** What Renown last said of the first link. */
  readonly credential: (
    claims: DelegationClaims,
  ) => Promise<DelegationCredentialStatus>;
  /**
   * Under DOCUMENT_PERMISSIONS: a real proof that whoever can read the
   * Workflows drive can read all app sources too. Absent means no proof.
   */
  readonly sameAudience?: () => Promise<boolean>;
}

const GAP_MESSAGES: Record<GrantGap, string> = {
  missing:
    "Conversions on this host run as a person. Choose Use my access only in Settings → Document conversion to convert as you.",
  ended:
    "Your permission to convert has ended. Choose Use my access only in Settings → Document conversion to renew it.",
  revoked:
    "Your permission to convert was withdrawn in Renown. Choose Use my access only in Settings → Document conversion to allow it again.",
  invalid:
    "Your permission to convert doesn't fit this host or these files. Choose Use my access only in Settings → Document conversion to allow it again.",
};

const needs = (gap: GrantGap, endedAt?: string): ConversionAuthority => ({
  kind: "needs-grant",
  gap,
  message: GAP_MESSAGES[gap],
  ...(endedAt ? { endedAt } : {}),
});

function personOf(claims: DelegationClaims): Person | null {
  try {
    const { networkId, chainId } = parsePkhDid(claims.sub);
    return { address: claims.prf.issuer.ethereumAddress, networkId, chainId };
  } catch {
    return null;
  }
}

export async function judgeConversionAuthority(
  params: JudgeConversionAuthority,
): Promise<ConversionAuthority> {
  const { statement, host, authorization, delegate, now } = params;
  if (
    authorization === "DOCUMENT_PERMISSIONS" &&
    !(await params.sameAudience?.())
  ) {
    return {
      kind: "refused",
      code: "audience-unproven",
      message:
        "Sektar can't convert PDFs on a host that sets access document by document yet. Run Sektar with open or admin-only access to convert.",
    };
  }
  if (!statement) {
    return host.requiresPerson ? needs("missing") : { kind: "host" };
  }
  const claims = decodeDelegation(statement);
  const person = claims ? personOf(claims) : null;
  if (!claims || !person || !delegate) return needs("invalid");
  const endedAt = new Date(claims.exp * 1000).toISOString();
  if (now >= claims.exp) return needs("ended", endedAt);
  const verdict = await verifyDelegation(statement, {
    user: person,
    key: delegate,
    signedAt: now,
    actionType: PUBLISH_WORKFLOW,
  });
  if (
    !verdict.ok ||
    claims.env !== host.environment ||
    claims.scp.res !== APP_CONVERSION_RESOURCE
  ) {
    return needs("invalid");
  }
  if ((await params.credential(claims)) === "revoked") return needs("revoked");
  return { kind: "delegated", person, statement, expiresAt: endedAt };
}

/**
 * Whether a verified request actor may fire the app workflow by hand:
 * only the delegated publisher, whose authority the run carries. A host
 * publish has no person to match, so it admits only a host that needs none.
 */
export function actorMayFire(
  actorAddress: string | null,
  authority: ConversionAuthority,
): boolean {
  switch (authority.kind) {
    case "delegated":
      return (
        actorAddress !== null &&
        actorAddress.toLowerCase() === authority.person.address.toLowerCase()
      );
    case "host":
      return true;
    case "needs-grant":
    case "refused":
      return false;
    default: {
      const unhandled: never = authority;
      return unhandled;
    }
  }
}
