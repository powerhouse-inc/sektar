import { Property } from "@powerhousedao/pieces-framework";
import { distyraRequest, type DistyraCredentials } from "./client.js";
import { distyraConnectionIdProp } from "./connection-dropdown.js";
import type { DistyraTransactionsResponse } from "./types.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The props every pull action takes. Shared so the raw action and the
 * ledger-shaped one can never drift apart on what they accept.
 */
export const pullProps = {
  connectionId: distyraConnectionIdProp,
  accountId: Property.ShortText({
    displayName: "Account ID",
    description:
      "Limit the pull to one account on the connection. Leave blank to fetch every account.",
    required: false,
  }),
  since: Property.ShortText({
    displayName: "Since",
    description:
      "The next_cursor from your previous run (YYYY-MM-DD). This is the incremental cursor: the boundary day overlaps, so deduplicate downstream by transaction id.",
    required: false,
  }),
  history: Property.StaticDropdown({
    displayName: "History",
    description:
      "Which range a pull with no dates reads. Leave as Automatic to let the first pull on a connection take all history and every later one the last 90 days. Cannot be combined with Since or Date From.",
    required: false,
    defaultValue: "automatic",
    options: {
      options: [
        {
          label: "Automatic (all on first pull, then 90 days)",
          value: "automatic",
        },
        { label: "All history", value: "all" },
        { label: "Recent (last 90 days)", value: "recent" },
      ],
    },
  }),
  dateFrom: Property.ShortText({
    displayName: "Date From",
    description: "Explicit window start (YYYY-MM-DD). Overrides Since.",
    required: false,
  }),
  dateTo: Property.ShortText({
    displayName: "Date To",
    description: "Explicit window end (YYYY-MM-DD).",
    required: false,
  }),
  enrich: Property.Checkbox({
    displayName: "Enrich transactions",
    description:
      "Run enrichment on each transaction. Bills the enrichment meter and needs the `enrichment:read` scope.",
    required: false,
    defaultValue: false,
  }),
  enrichHistory: Property.StaticDropdown({
    displayName: "Enrich History",
    description:
      "Only applies to an all-history pull with enrichment on. Recent enriches the last 90 days and marks older rows enrichment_skipped, uncharged. All enriches and charges for every row.",
    required: false,
    defaultValue: "recent",
    options: {
      options: [
        { label: "Recent (last 90 days)", value: "recent" },
        { label: "All rows (charges for every row)", value: "all" },
      ],
    },
  }),
  psuIpAddress: Property.ShortText({
    displayName: "PSU IP Address",
    description:
      "The IP address of your end user, only when one is actively waiting on this run. Such a fetch is exempt from the bank's 4-per-day limit. Send with PSU User Agent — either both or neither. Never your own server's address.",
    required: false,
    advanced: true,
  }),
  psuUserAgent: Property.ShortText({
    displayName: "PSU User Agent",
    description:
      "The User-Agent of your end user's browser. Send with PSU IP Address.",
    required: false,
    advanced: true,
  }),
};

/** The subset of prop values a pull reads. */
export type PullPropsValue = {
  connectionId: string;
  accountId?: string | null;
  since?: string | null;
  history?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  enrich?: boolean | null;
  enrichHistory?: string | null;
  psuIpAddress?: string | null;
  psuUserAgent?: string | null;
};

function assertIsoDate(
  value: string | null | undefined,
  fieldName: string,
): string | undefined {
  const trimmed = value?.trim();
  // "null"/"undefined" arrive when a workflow expression resolves to nothing
  // and the runtime stringifies it. Treating them as absent is what lets the
  // first run — with an empty cursor — pull all history instead of failing.
  if (!trimmed || trimmed === "null" || trimmed === "undefined") {
    return undefined;
  }
  if (!ISO_DATE.test(trimmed)) {
    throw new Error(
      `${fieldName} must be a date in YYYY-MM-DD format, got "${trimmed}".`,
    );
  }
  return trimmed;
}

/**
 * Validate the prop combination and run the pull. The combinations rejected
 * here are the ones the API answers with `invalid_history`; catching them
 * locally costs nothing and names the two fields that disagree.
 */
export async function runPull(
  credentials: DistyraCredentials,
  props: PullPropsValue,
): Promise<DistyraTransactionsResponse> {
  const since = assertIsoDate(props.since, "Since");
  const dateFrom = assertIsoDate(props.dateFrom, "Date From");
  const dateTo = assertIsoDate(props.dateTo, "Date To");
  const accountId = props.accountId?.trim() || undefined;
  const enrich = props.enrich === true;
  // "automatic" is this piece's own default, meaning "send no history param"
  // and let the API apply its first-pull-then-90-days rule.
  const history =
    !props.history || props.history === "automatic" ? undefined : props.history;

  if (history && (dateFrom || since)) {
    throw new Error(
      "History cannot be combined with Date From or Since. Clear the dates to use History, or leave History on Automatic.",
    );
  }
  if (history === "all" && dateTo) {
    throw new Error("History 'All history' cannot be combined with Date To.");
  }

  const psuIpAddress = props.psuIpAddress?.trim() || undefined;
  const psuUserAgent = props.psuUserAgent?.trim() || undefined;
  if (Boolean(psuIpAddress) !== Boolean(psuUserAgent)) {
    throw new Error(
      "PSU IP Address and PSU User Agent must be sent together — supply both or neither.",
    );
  }

  const headers: Record<string, string> = {};
  if (psuIpAddress && psuUserAgent) {
    headers["psu-ip-address"] = psuIpAddress;
    headers["psu-user-agent"] = psuUserAgent;
  }

  return distyraRequest<DistyraTransactionsResponse>({
    credentials,
    path: `/v1/connect/connections/${encodeURIComponent(props.connectionId)}/transactions`,
    query: {
      account_id: accountId,
      since,
      date_from: dateFrom,
      date_to: dateTo,
      history,
      enrich: enrich ? "true" : undefined,
      // enrich_history is only meaningful alongside enrich=true; sending it on
      // its own is refused as `invalid_history`.
      enrich_history: enrich ? props.enrichHistory : undefined,
    },
    headers,
  });
}
