// One GraphQL call to a remote index subgraph (kit/mail-index, trip-index,
// finance-index, files-index). The call carries the logged-in Renown user's
// bearer, as the framework's own switchboard client does, so a switchboard
// that requires an authenticated caller answers it. A refusal (401/403) is
// recorded on the backend-auth store, which Connect turns into the sign-in
// gate instead of a broken view.
import {
  ambientRenownTokenProvider,
  recordBackendAuthError,
} from "@powerhousedao/reactor-browser";

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
