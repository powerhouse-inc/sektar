import { PieceAuth, Property } from "@powerhousedao/pieces-framework";
import {
  DISTYRA_DEFAULT_BASE_URL,
  distyraErrorCode,
  distyraRequest,
} from "./common/client.js";
import type { DistyraConnectionsResponse } from "./common/types.js";

/** The key is the whole credential: Distyra authenticates with a bearer token
 * alone (`Authorization: Bearer sk_…`). There is no paired secret to send —
 * the "signing secret" in the portal signs *incoming* webhooks and is not used
 * on any outbound call, so it is deliberately not a field here. */
export const distyraAuth = PieceAuth.CustomAuth({
  description:
    "Create an API key in the Distyra portal under Developers → API keys. It needs the `connect:read` scope, plus `enrichment:read` if you want to enrich transactions as you pull them.",
  required: true,
  props: {
    apiKey: PieceAuth.SecretText({
      displayName: "API Key",
      description:
        "Starts with `sk_`. Use an `sk_test_` key to work against test mode.",
      required: true,
    }),
    baseUrl: Property.ShortText({
      displayName: "Base URL",
      description: `Leave blank unless Distyra told you otherwise. Defaults to ${DISTYRA_DEFAULT_BASE_URL} — note the API stays on .com even though the portal is on .eu.`,
      required: false,
    }),
  },
  validate: async ({ auth }) => {
    // Checked before spending a request: the portal shows the API key next to
    // the webhook signing secret, and pasting the wrong one comes back as a
    // bare `invalid_key`, which reads as "your key is revoked" rather than
    // "that is not a key". Every API key is `sk_` + base58.
    const key = auth.apiKey.trim();
    if (!key.startsWith("sk_")) {
      return {
        valid: false,
        error:
          "That does not look like a Distyra API key — they start with `sk_`. Check you copied the API key from Developers → API keys, and not the webhook signing secret.",
      };
    }

    try {
      // The cheapest authenticated call that also proves the scope this piece
      // needs. It reads Distyra's own records, not the bank, so it spends
      // nothing against a connection's daily fetch allowance.
      await distyraRequest<DistyraConnectionsResponse>({
        credentials: auth,
        path: "/v1/connect/connections",
        query: { limit: 1 },
      });
      return { valid: true };
    } catch (error) {
      const code = distyraErrorCode(
        error instanceof Error ? error.cause : error,
      );
      if (code === "insufficient_scope") {
        return {
          valid: false,
          error:
            "This API key is valid but lacks the `connect:read` scope, which this piece needs.",
        };
      }
      if (code === "connect_unconfigured") {
        // The key itself is fine; Connect just is not switched on yet. Say so
        // rather than sending the user off to re-check a working key.
        return {
          valid: false,
          error:
            "Connect is not configured for this organization yet. Enable it in the Distyra portal, then reconnect.",
        };
      }
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Could not reach Distyra.",
      };
    }
  },
  getConnectionIdentifier: async ({ auth }) => {
    // No endpoint returns the organization, so label the connection by the
    // thing that actually differs between two of them: live vs test, and the
    // key's tail. Never the whole key.
    const key = auth.apiKey.trim();
    const mode = key.startsWith("sk_test_") ? "Test" : "Live";
    return Promise.resolve(`${mode} key ····${key.slice(-4)}`);
  },
});
