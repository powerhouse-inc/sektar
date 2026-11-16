import {
  buildAndSignCredential,
  createDelegation,
  MemoryKeyStorage,
  RenownCryptoBuilder,
  type IRenownCrypto,
  type PowerhouseVerifiableCredential,
  type SignCredentialTypedData,
} from "@renown/sdk/node";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { APP_CONVERSION_RESOURCE } from "../contracts.js";
import {
  actorMayFire,
  judgeConversionAuthority,
  type HostFacts,
  type JudgeConversionAuthority,
} from "./authority.js";

// viem is the SDK's own dependency; Sektar does not declare it.
type Account = {
  address: `0x${string}`;
  signTypedData(args: unknown): Promise<`0x${string}`>;
};
const { privateKeyToAccount } = createRequire(
  import.meta.resolve("@renown/sdk/node"),
)("viem/accounts") as { privateKeyToAccount: (key: `0x${string}`) => Account };

// A well-known Anvil dev key; never used for anything real.
const PERSON = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const newKey = (): Promise<IRenownCrypto> =>
  new RenownCryptoBuilder().withKeyPairStorage(new MemoryKeyStorage()).build();

describe("who the app-wide conversion workflow runs as", () => {
  let session: IRenownCrypto;
  let delegate: IRenownCrypto;
  let hostKey: IRenownCrypto;
  let credential: PowerhouseVerifiableCredential;
  let host: HostFacts;

  const statementFor = (
    overrides: Partial<Parameters<typeof createDelegation>[0]> = {},
  ) =>
    createDelegation({
      issuer: session.issuer,
      credential,
      delegate: delegate.did,
      environment: hostKey.did,
      scope: { ops: ["PUBLISH_WORKFLOW"], res: APP_CONVERSION_RESOURCE },
      ...overrides,
    });

  const judge = (
    statement: string | null,
    overrides: Partial<JudgeConversionAuthority> = {},
  ) =>
    judgeConversionAuthority({
      statement,
      host,
      authorization: "ADMIN_ONLY",
      delegate: delegate.did,
      now: Math.floor(Date.now() / 1000),
      credential: () => Promise.resolve("active"),
      ...overrides,
    });

  beforeAll(async () => {
    session = await newKey();
    delegate = await newKey();
    hostKey = await newKey();
    credential = await buildAndSignCredential({
      signTypedData: ((args) =>
        PERSON.signTypedData(args)) as SignCredentialTypedData,
      address: PERSON.address,
      chainId: 1,
      app: "connect",
      appId: session.did,
    });
    host = { environment: hostKey.did, address: null, requiresPerson: true };
  });

  it("runs as the person whose statement names the app", async () => {
    const statement = await statementFor();
    const authority = await judge(statement);
    expect(authority).toMatchObject({
      kind: "delegated",
      statement,
      person: { address: PERSON.address, networkId: "eip155", chainId: 1 },
    });
    expect(actorMayFire(PERSON.address.toLowerCase(), authority)).toBe(true);
    expect(
      actorMayFire("0x0000000000000000000000000000000000000001", authority),
    ).toBe(false);
    expect(actorMayFire(null, authority)).toBe(false);
  });

  it("refuses an Integration statement, a retired source-scoped resource, another host or another runner key", async () => {
    for (const statement of [
      await statementFor({
        scope: { ops: ["PUBLISH_WORKFLOW"], res: "sektar/integration:i-1" },
      }),
      await statementFor({
        scope: {
          ops: ["PUBLISH_WORKFLOW"],
          res: "sektar/conversion:files:files-drive",
        },
      }),
      await statementFor({ environment: delegate.did }),
      await statementFor({ delegate: hostKey.did }),
    ]) {
      expect(await judge(statement)).toMatchObject({
        kind: "needs-grant",
        gap: "invalid",
      });
    }
    expect(await judge("not a statement")).toMatchObject({
      kind: "needs-grant",
      gap: "invalid",
    });
  });

  it("asks for a grant when none was given or it ended or was revoked, but not when Renown cannot say", async () => {
    const statement = await statementFor();
    const ended = await judge(statement, {
      now: Math.floor(Date.now() / 1000) + 400 * 24 * 3600,
    });
    expect(ended).toMatchObject({ kind: "needs-grant", gap: "ended" });
    const revoked = await judge(statement, {
      credential: () => Promise.resolve("revoked"),
    });
    expect(revoked).toMatchObject({ kind: "needs-grant", gap: "revoked" });
    expect(
      await judge(statement, { credential: () => Promise.resolve("unknown") }),
    ).toMatchObject({
      kind: "delegated",
    });
    expect(await judge(null)).toMatchObject({
      kind: "needs-grant",
      gap: "missing",
    });
  });

  it("publishes as the host only where reads need no person", async () => {
    const open = await judge(null, {
      authorization: "OPEN",
      host: { ...host, requiresPerson: false },
    });
    expect(open).toEqual({ kind: "host" });
    expect(actorMayFire(null, open)).toBe(true);
  });

  it("refuses document-by-document hosts unless the audience is proven the same", async () => {
    const statement = await statementFor();
    const refused = await judge(statement, {
      authorization: "DOCUMENT_PERMISSIONS",
    });
    expect(refused).toMatchObject({
      kind: "refused",
      code: "audience-unproven",
    });
    expect(actorMayFire(PERSON.address, refused)).toBe(false);
    expect(
      await judge(statement, {
        authorization: "DOCUMENT_PERMISSIONS",
        sameAudience: () => Promise.resolve(false),
      }),
    ).toMatchObject({ kind: "refused" });
    expect(
      await judge(statement, {
        authorization: "DOCUMENT_PERMISSIONS",
        sameAudience: () => Promise.resolve(true),
      }),
    ).toMatchObject({ kind: "delegated" });
  });
});
