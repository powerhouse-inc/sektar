// One GraphQL call to a remote index subgraph (kit/mail-index, trip-index,
// finance-index, files-index). The call carries the logged-in Renown user's
// bearer, as the framework's own switchboard client does, so a switchboard
// that requires an authenticated caller answers it. A refusal (401/403) is
// recorded on the backend-auth store, which Connect turns into the sign-in
// gate instead of a broken view.
import {
  ambientRenownTokenProvider,
  DriveCollectionId,
  getPHStore,
  getSwitchboardBaseFromChannelUrl,
  recordBackendAuthError,
} from "@powerhousedao/reactor-browser";

/** Where a drive's index is answered from. */
export type IndexMode =
  | { kind: "remote"; base: string }
  | { kind: "local" }
  | { kind: "unknown" };

/** What the choice is made from: the app's values, by hook or from the store. */
export interface IndexEnvironment {
  remotes: readonly {
    meta: { collectionId: DriveCollectionId };
    channel?: unknown;
  }[];
  module: { kind?: string } | undefined;
  attachments: unknown;
  switchboardUrl: string | undefined;
}

/**
 * Where the index for this drive is answered from. A synchronized remote
 * drive's channel URL names its switchboard (the way the framework builds
 * its own switchboard links); a tab with its own reactor and no remote for
 * the drive queries locally. A pure remote client (the studio and cli
 * Connect) has neither a sync list nor a GraphQL client in the store: its
 * switchboard is the one the attachment service talks to, which is the
 * origin every read and write already goes to.
 */
export function indexModeOf(driveId: string, env: IndexEnvironment): IndexMode {
  const { remotes, module, attachments, switchboardUrl } = env;
  const remote = remotes.find((r) =>
    r.meta.collectionId.equals(DriveCollectionId.forDrive(driveId)),
  );
  const channelUrl = (
    remote?.channel as { config?: { url?: unknown } } | undefined
  )?.config?.url;
  if (typeof channelUrl === "string" && channelUrl) {
    return {
      kind: "remote",
      base: getSwitchboardBaseFromChannelUrl(channelUrl),
    };
  }
  if (module?.kind === "browser") return { kind: "local" };
  const gql = (getPHStore()?.reactorGraphQLClient as { url?: unknown } | undefined)
    ?.url;
  const store = (attachments as { store?: { remoteUrl?: unknown } } | undefined)
    ?.store?.remoteUrl;
  const fallback =
    typeof gql === "string" && gql
      ? gql
      : typeof store === "string" && store
        ? store
        : typeof switchboardUrl === "string"
          ? switchboardUrl
          : "";
  if (fallback) {
    return { kind: "remote", base: fallback.replace(/\/graphql(\/.*)?$/, "") };
  }
  return { kind: "unknown" };
}

/** `indexModeOf` outside React, as it stands in the app's store right now. */
export function currentIndexMode(driveId: string): IndexMode {
  const store = getPHStore();
  const module = store?.reactorClientModule;
  return indexModeOf(driveId, {
    remotes: module?.reactorModule?.syncModule?.syncManager?.list() ?? [],
    module,
    attachments: store?.attachmentService,
    switchboardUrl: store?.switchboardUrl,
  });
}

export async function indexGql<T>(
  base: string,
  query: string,
  variables: Record<string, unknown>,
  /**
   * The endpoint: the switchboard's gateway by default, or one subgraph's own
   * (`/graphql/<name>`) for a field that reads the request's headers, which
   * the gateway does not pass on.
   */
  path = "/graphql",
): Promise<T> {
  const token = await ambientRenownTokenProvider();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401 || response.status === 403) {
    const error = Object.assign(
      new Error(`The index answered ${response.status} on ${base}`),
      { response: { status: response.status } },
    );
    recordBackendAuthError(error, "switchboard");
    throw error;
  }
  const json = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    const error = new Error(json.errors[0].message);
    recordBackendAuthError(error, "switchboard");
    throw error;
  }
  if (!json.data)
    throw new Error(`The index answered ${response.status} on ${base}`);
  return json.data;
}
