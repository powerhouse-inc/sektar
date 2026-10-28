// The switchboard's workflow runtime, as the integrations UI needs it: where
// it is (the selected drive's sync channel, else the default drive's, as
// Workflow Studio finds it) and the two OAuth2 calls of a sign-in. Requests
// carry the signed-in user's Renown token.
import {
  DriveCollectionId,
  type GqlRequestChannel,
} from "@powerhousedao/reactor";
import {
  DEFAULT_SWITCHBOARD_URL,
  parseDriveUrl,
  subgraphUrlFromGraphqlUrl,
  useDefaultDrivesUrl,
  useSelectedDriveSafe,
  useSyncList,
} from "@powerhousedao/reactor-browser";
import { ambientRenownTokenProvider } from "@powerhousedao/reactor-browser/graphql-client";
import { useMemo } from "react";

const SUBGRAPH = "workflow-runtime";

function baseFromChannelUrl(channelUrl: string): string | undefined {
  try {
    const url = new URL(channelUrl);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/r\/?$/, "");
    return url.toString();
  } catch {
    return undefined;
  }
}

/** The workflow-runtime subgraph of the switchboard behind the selected drive. */
export function useWorkflowRuntimeUrl(): string {
  const [drive] = useSelectedDriveSafe();
  const remotes = useSyncList();
  const defaultDrivesUrl = useDefaultDrivesUrl();
  const driveId = drive?.header.id;
  return useMemo(() => {
    let base: string | undefined;
    if (driveId) {
      const remote = remotes.find((entry) =>
        entry.meta.collectionId.equals(DriveCollectionId.forDrive(driveId)),
      );
      const url = (remote?.channel as GqlRequestChannel | undefined)?.config
        .url;
      if (typeof url === "string") base = baseFromChannelUrl(url);
    }
    if (!base && defaultDrivesUrl) {
      try {
        base = parseDriveUrl(defaultDrivesUrl).graphqlEndpoint.replace(
          /\/r$/,
          "",
        );
      } catch {
        // a malformed default drive URL: the constant below
      }
    }
    return subgraphUrlFromGraphqlUrl(base ?? DEFAULT_SWITCHBOARD_URL, SUBGRAPH);
  }, [driveId, remotes, defaultDrivesUrl]);
}

async function gql<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const token = await ambientRenownTokenProvider();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new Error(body.errors[0]!.message);
  if (!body.data)
    throw new Error(`The switchboard answered ${response.status}`);
  return body.data;
}

export type OAuthStart = { state: string; authorizationUrl: string };
export type OAuthAttempt = {
  status: "PENDING" | "EXCHANGING" | "OK" | "ERROR";
  error: string | null;
};

/** Opens a sign-in for the connection: the provider's page to send the user to. */
export async function startSignIn(
  url: string,
  connectionId: string,
): Promise<OAuthStart> {
  const data = await gql<{ workflowRuntime: { startOAuth: OAuthStart } }>(
    url,
    `mutation StartOAuth($connectionId: String!) {
      workflowRuntime { startOAuth(connectionId: $connectionId) { state authorizationUrl } }
    }`,
    { connectionId },
  );
  return data.workflowRuntime.startOAuth;
}

/** How a sign-in stands; null when the switchboard no longer knows it. */
export async function signInStatus(
  url: string,
  state: string,
): Promise<OAuthAttempt | null> {
  const data = await gql<{
    workflowRuntime: { oauthAttempt: OAuthAttempt | null };
  }>(
    url,
    `query OAuthAttempt($state: String!) {
      workflowRuntime { oauthAttempt(state: $state) { status error } }
    }`,
    { state },
  );
  return data.workflowRuntime.oauthAttempt;
}

/** How the runtime holds one workflow's trigger: when it last looked, and whether that worked. */
export type TriggerState = {
  workflowId: string;
  /** ENABLED | DISABLED | ERROR | PARKED */
  status: string;
  lastPollAt: string | null;
  nextPollAt: string | null;
  lastError: string | null;
};

/** The triggers of the workflows this person may read. */
export async function triggerStates(url: string): Promise<TriggerState[]> {
  const data = await gql<{
    workflowRuntime: { triggerStates: TriggerState[] };
  }>(
    url,
    `query TriggerStates {
      workflowRuntime { triggerStates { workflowId status lastPollAt nextPollAt lastError } }
    }`,
    {},
  );
  return data.workflowRuntime.triggerStates;
}

export type RerunResult = {
  runId: string | null;
  status: string;
  error: string | null;
};

/**
 * Runs a workflow's latest failed run again, with the payload it failed on
 * (for a backfill: its slice). Null when there is no failed run to retry.
 */
export async function rerunLastFailed(
  url: string,
  workflowId: string,
): Promise<RerunResult | null> {
  const runs = await gql<{
    workflowRuntime: { runs: { id: string; status: string }[] };
  }>(
    url,
    `query Runs($workflowId: String!) {
      workflowRuntime { runs(workflowId: $workflowId, limit: 10, excludeTriggerKinds: ["test"]) { id status } }
    }`,
    { workflowId },
  );
  const failed = runs.workflowRuntime.runs.find((r) => r.status === "FAILED");
  if (!failed) return null;
  const data = await gql<{ workflowRuntime: { rerun: RerunResult } }>(
    url,
    `mutation Rerun($runId: String!) {
      workflowRuntime { rerun(runId: $runId) { runId status error } }
    }`,
    { runId: failed.id },
  );
  return data.workflowRuntime.rerun;
}

export type RuntimeConnection = {
  id: string;
  name: string;
  connectorId: string;
  status: string;
  accountLabel: string | null;
};

/** The connections this person may use, as the runtime holds them. */
export async function runtimeConnections(
  url: string,
): Promise<RuntimeConnection[]> {
  const data = await gql<{
    workflowRuntime: { connections: RuntimeConnection[] };
  }>(
    url,
    `query Connections { workflowRuntime { connections { id name connectorId status accountLabel } } }`,
    {},
  );
  return data.workflowRuntime.connections;
}

export type BlockRef = {
  pieceName: string;
  pieceVersion: string;
  name: string;
  kind: "action" | "trigger";
};

export type DropdownOptions = {
  options: { label: string; value: unknown }[];
  placeholder?: string;
  disabled?: boolean;
};

/** A piece's dropdown, resolved by the runtime on a connection (no workflow needed). */
export async function blockOptions(
  url: string,
  block: BlockRef,
  propName: string,
  input: Record<string, unknown>,
  connectionId: string,
): Promise<DropdownOptions> {
  const data = await gql<{
    workflowRuntime: { blockOptions: DropdownOptions | null };
  }>(
    url,
    `query BlockOptions($block: BlockInput!, $prop: String!, $input: Unknown, $connectionId: String) {
      workflowRuntime { blockOptions(block: $block, propName: $prop, input: $input, connectionId: $connectionId) }
    }`,
    { block, prop: propName, input, connectionId },
  );
  return data.workflowRuntime.blockOptions ?? { options: [] };
}

/**
 * Runs a workflow's trigger now, as its schedule or poll would ("sync now").
 * False when it has no armed trigger (live updates off, stopped, failing).
 */
export async function pollNow(url: string, workflowId: string): Promise<boolean> {
  const data = await gql<{ workflowRuntime: { pollNow: boolean } }>(
    url,
    `mutation PollNow($workflowId: String!) {
      workflowRuntime { pollNow(workflowId: $workflowId) }
    }`,
    { workflowId },
  );
  return data.workflowRuntime.pollNow;
}
