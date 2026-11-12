import { createAction, Property } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { shouldReadBalances } from "../bank/balances.js";
import { distyraRequest } from "../common/client.js";
import { distyraConnectionIdProp } from "../common/connection-dropdown.js";
import type { DistyraAccount } from "./list-accounts.js";

/** What Read Balances answers: read or not, and the accounts when it did. */
export type DistyraBalancesResult = {
  /** False when the run left the balances alone, or the bank could not be read. */
  read: boolean;
  /** Why not, when `read` is false. */
  reason: string | null;
  /** When the balances were read from the bank. */
  readAt: string | null;
  accounts: DistyraAccount[];
};

export const distyraReadBalancesAction = createAction({
  auth: distyraAuth,
  // Saved workflows refer to the action by name: don't rename it once published
  name: "read-balances",
  displayName: "Read Balances",
  description:
    "Read the bank's own balance of every account on a connection, for Record Bank Balance to bring the Sektar accounts to. It decides by itself whether this run should: always with the person on screen, otherwise once a day and only when the schedule leaves one of the connection's four daily fetches for it. A run that should not, or a bank that cannot be read, answers read: false and never fails the workflow.",
  props: {
    connectionId: distyraConnectionIdProp,
    everyHours: Property.Number({
      displayName: "Sync interval (hours)",
      description:
        "How often this workflow runs, in hours. A sync every six hours already uses the bank's four daily fetches, so its balances are only read when the person is on screen.",
      required: false,
    }),
    psuIpAddress: Property.ShortText({
      displayName: "PSU IP Address",
      description:
        "The IP address of your end user, only when one is actively waiting on this run. Send with PSU User Agent.",
      required: false,
      advanced: true,
    }),
    psuUserAgent: Property.ShortText({
      displayName: "PSU User Agent",
      description: "The User-Agent of your end user's browser. Send with PSU IP Address.",
      required: false,
      advanced: true,
    }),
  },
  errorHandlingOptions: {
    // Off: every attempt spends one of the bank's daily fetches.
    retryOnFailure: { defaultValue: false },
    continueOnFailure: { defaultValue: true },
  },
  async run(context): Promise<DistyraBalancesResult> {
    const p = context.propsValue;
    // "null"/"undefined": a workflow expression that resolved to nothing
    const text = (v: string | null | undefined) => {
      const t = v?.trim();
      return t && t !== "null" && t !== "undefined" ? t : undefined;
    };
    const psuIpAddress = text(p.psuIpAddress);
    const psuUserAgent = text(p.psuUserAgent);
    const attended = Boolean(psuIpAddress && psuUserAgent);
    const now = new Date();
    if (
      !shouldReadBalances({
        attended,
        everyHours: Number(p.everyHours) || 0,
        hourUtc: now.getUTCHours(),
      })
    ) {
      return {
        read: false,
        reason: "Not this run: the balances are read once a day, or on Sync now",
        readAt: null,
        accounts: [],
      };
    }
    try {
      const response = await distyraRequest<{ accounts?: DistyraAccount[] }>({
        credentials: context.auth.props,
        path: `/v1/connect/connections/${encodeURIComponent(p.connectionId)}/accounts`,
        headers:
          psuIpAddress && psuUserAgent
            ? { "psu-ip-address": psuIpAddress, "psu-user-agent": psuUserAgent }
            : undefined,
      });
      return {
        read: true,
        reason: null,
        readAt: now.toISOString(),
        accounts: response.accounts ?? [],
      };
    } catch (error) {
      // The transactions are in: a balance that could not be read today is
      // read tomorrow, and must not turn a good sync into a failed one.
      return {
        read: false,
        reason: error instanceof Error ? error.message : String(error),
        readAt: null,
        accounts: [],
      };
    }
  },
});
