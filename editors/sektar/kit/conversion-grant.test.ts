import {
  buildAndSignCredential,
  decodeDelegation,
  MemoryKeyStorage,
  parsePkhDid,
  RenownCryptoBuilder,
  verifyDelegation,
  type IRenownCrypto,
  type SignCredentialTypedData,
} from "@renown/sdk/node";
import { createRequire } from "node:module";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { APP_CONVERSION_RESOURCE } from "../../../conversions/contracts.js";
import {
  ConversionGrantError,
  mintConversionGrant,
} from "./conversion-grant.js";
import { granterOf, type Granter, type RunnerFacts } from "./reactor-grant.js";

const signing = vi.hoisted(() => ({ fails: null as Error | null }));

vi.mock("@powerhousedao/reactor-browser", async () => {
  const sdk = await import("@renown/sdk/node");
  return {
    createDelegation: (input: Parameters<typeof sdk.createDelegation>[0]) =>
      signing.fails
        ? Promise.reject(signing.fails)
        : sdk.createDelegation(input),
    decodeDelegation: sdk.decodeDelegation,
    useRenown: () => undefined,
  };
});
vi.mock("@powerhousedao/reactor-browser/graphql-client", () => ({
  ambientRenownTokenProvider: () => Promise.resolve("a-token"),
}));
vi.mock("./workflow-runtime.js", () => ({ useWorkflowRuntimeUrl: () => "" }));

type Account = {
  address: `0x${string}`;
  signTypedData(args: unknown): Promise<`0x${string}`>;
};
const { privateKeyToAccount } = createRequire(
  import.meta.resolve("@renown/sdk/node"),
)("viem/accounts") as {
  privateKeyToAccount: (key: `0x${string}`) => Account;
};
// A well-known Anvil dev key; never used for anything real.
const PERSON = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const newKey = (): Promise<IRenownCrypto> =>
  new RenownCryptoBuilder().withKeyPairStorage(new MemoryKeyStorage()).build();

const HOST = "https://host.example/base";

let granter: Granter;
let facts: RunnerFacts;
let asked: { url: string; authorization: string | null }[];

/** The host's runner route answers with `answer`, or is not there. */
function runner(answer: RunnerFacts | null) {
  asked = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    asked.push({
      url,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return Promise.resolve(
      answer
        ? new Response(JSON.stringify(answer))
        : new Response("", { status: 404 }),
    );
  });
}

beforeAll(async () => {
  const session = await newKey();
  const credential = await buildAndSignCredential({
    signTypedData: ((args) =>
      PERSON.signTypedData(args)) as SignCredentialTypedData,
    address: PERSON.address,
    chainId: 1,
    app: "connect",
    appId: session.did,
  });
  granter = granterOf({
    crypto: session,
    user: { address: PERSON.address, credential },
  })!;
  facts = {
    delegate: (await newKey()).did,
    environment: (await newKey()).did,
    requiresPerson: true,
    reactorConnectionId: null,
  };
});

afterEach(() => {
  signing.fails = null;
  vi.unstubAllGlobals();
});

describe("signing for the app", () => {
  it("signs the person's own statement, for the app workflow and the host's runner key only", async () => {
    runner(facts);
    const statement = await mintConversionGrant({
      host: HOST,
      granter,
    });
    expect(asked).toEqual([
      {
        url: "https://host.example/api/@powerhousedao/sektar/runner",
        authorization: "Bearer a-token",
      },
    ]);
    const claims = decodeDelegation(statement!)!;
    expect(claims).toMatchObject({
      aud: facts.delegate,
      env: facts.environment,
      scp: {
        ops: ["PUBLISH_WORKFLOW"],
        res: APP_CONVERSION_RESOURCE,
      },
    });
    // As the host judges it: this person's, for this runner key, to publish.
    const { networkId, chainId } = parsePkhDid(claims.sub);
    const judged = (actionType: string) =>
      verifyDelegation(statement!, {
        user: { address: PERSON.address, networkId, chainId },
        key: facts.delegate,
        signedAt: claims.iat,
        actionType,
      });
    expect((await judged("PUBLISH_WORKFLOW")).ok).toBe(true);
    expect((await judged("ADD_FILE")).ok).toBe(false);
  });

  it("signs nothing with nobody signed in, and does not ask the host", async () => {
    runner(facts);
    expect(
      await mintConversionGrant({ host: HOST, granter: null }),
    ).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it("signs nothing for an open host, or one without the runner route", async () => {
    runner({ ...facts, requiresPerson: false });
    expect(await mintConversionGrant({ host: HOST, granter })).toBeUndefined();
    runner(null);
    expect(await mintConversionGrant({ host: HOST, granter })).toBeUndefined();
  });

  it("says what to do when the session cannot sign what the host asks for", async () => {
    runner(facts);
    signing.fails = new Error("The credential has expired");
    const refusal = mintConversionGrant({ host: HOST, granter });
    await expect(refusal).rejects.toBeInstanceOf(ConversionGrantError);
    await expect(refusal).rejects.toMatchObject({
      message:
        "Sektar couldn't confirm your permission to convert as you. Sign out, sign in again, and try again.",
      detail: "The credential has expired",
    });
  });
});
