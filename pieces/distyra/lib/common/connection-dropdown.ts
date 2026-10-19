import { Property } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { distyraRequest } from "./client.js";
import type { DistyraConnection, DistyraConnectionsResponse } from "./types.js";

/** Enough to tell two connections at the same bank apart in the picker. */
function connectionLabel(connection: DistyraConnection): string {
  const bank = connection.aspsp_name ?? "Unknown bank";
  const reference = connection.external_ref ?? connection.applicant_ref;
  const qualifiers = [
    connection.country,
    connection.psu_type,
    reference,
  ].filter((part): part is string => Boolean(part));
  return qualifiers.length > 0 ? `${bank} (${qualifiers.join(" · ")})` : bank;
}

/**
 * Picks an active bank connection. Shared so a future polling trigger offers
 * the same list. Listing connections is a plain read: it does not touch the
 * bank, so it costs nothing against the PSD2 fetch allowance.
 */
export const distyraConnectionIdProp = Property.Dropdown({
  displayName: "Connection",
  description:
    "The bank connection to pull from. Only active connections are listed — a pending, expired or revoked one cannot be read.",
  required: true,
  auth: distyraAuth,
  refreshers: [],
  options: async ({ auth }) => {
    if (!auth) {
      return {
        disabled: true,
        placeholder: "Connect your Distyra account first",
        options: [],
      };
    }

    try {
      const response = await distyraRequest<DistyraConnectionsResponse>({
        credentials: auth.props,
        path: "/v1/connect/connections",
        query: { status: "active", limit: 500 },
      });

      if (response.connections.length === 0) {
        return {
          disabled: true,
          placeholder:
            "No active connections — create one in Distyra Connect first",
          options: [],
        };
      }

      return {
        options: response.connections.map((connection) => ({
          label: connectionLabel(connection),
          value: connection.id,
        })),
      };
    } catch (error) {
      // A dropdown that throws renders as a bare failure, so hand the reason
      // back as the placeholder instead.
      return {
        disabled: true,
        placeholder:
          error instanceof Error ? error.message : "Could not load connections",
        options: [],
      };
    }
  },
});
