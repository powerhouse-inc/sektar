import { createDelegation, useRenown } from "@powerhousedao/reactor-browser";
import { useCallback, useRef } from "react";
import { APP_CONVERSION_RESOURCE } from "../../../conversions/contracts.js";
import { UserFacingError } from "./conversion.js";
import {
  fetchRunnerFacts,
  granterOf,
  wantsStatement,
  type Granter,
} from "./reactor-grant.js";

/** What a statement lets the runner sign. Nothing else. */
const DELEGATED_OPERATIONS = ["PUBLISH_WORKFLOW"];

/** The statement could not be signed on a host that asks for one. */
export class ConversionGrantError extends UserFacingError {
  override name = "ConversionGrantError";
}

/**
 * A signed statement for app-wide conversion, or none: nobody is signed in with a
 * credential, or the host takes no statement (an open host, or one without
 * the runner route). Without one the host decides as it always has, and
 * refuses in its own words where it needs one. Rejects with a
 * ConversionGrantError when this session cannot sign what the host asks for.
 */
export async function mintConversionGrant(input: {
  /** The switchboard asked: its origin serves the runner route */
  host: string;
  granter: Granter | null;
}): Promise<string | undefined> {
  const { host, granter } = input;
  if (!granter) return undefined;
  const facts = await fetchRunnerFacts(host);
  if (!wantsStatement(facts) || !facts.environment) return undefined;
  try {
    return await createDelegation({
      issuer: granter.issuer,
      credential: granter.credential,
      delegate: facts.delegate,
      environment: facts.environment,
      scope: { ops: DELEGATED_OPERATIONS, res: APP_CONVERSION_RESOURCE },
    });
  } catch (error) {
    throw new ConversionGrantError(
      "Sektar couldn't confirm your permission to convert as you. Sign out, sign in again, and try again.",
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  }
}

/** Signs an app-wide statement as whoever is signed in; see mintConversionGrant. */
export type MintConversionGrant = () => Promise<string | undefined>;

/**
 * The signer for one host, as the person signed in to this app now. `host`
 * is null where there is no host to ask: nothing is signed.
 */
export function useConversionGrant(host: string | null): MintConversionGrant {
  const granter = useRef<Granter | null>(null);
  granter.current = granterOf(useRenown());
  return useCallback(
    () =>
      host
        ? mintConversionGrant({ host, granter: granter.current })
        : Promise.resolve(undefined),
    [host],
  );
}
