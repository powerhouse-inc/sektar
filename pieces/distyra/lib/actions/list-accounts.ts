import { createAction, Property } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { distyraRequest } from "../common/client.js";
import { distyraAccountProp } from "../common/account-dropdown.js";
import { distyraConnectionIdProp } from "../common/connection-dropdown.js";

/** One row of GET /v1/connect/connections/{id}/accounts, as far as this piece reads it. */
export type DistyraAccount = {
  /** Per connection only: the bank issues a new one at every authorization. */
  account_id: string;
  /** Stable across re-authorization; match accounts on this. */
  account_key: string | null;
  account_key_basis: string | null;
  name: string | null;
  holder_name: string | null;
  currency: string | null;
  iban_masked: string | null;
  account_type: string | null;
  /** ISO 20022: CACC current, SVGS savings, CARD card, LOAN, CASH, OTHR. */
  cash_account_type: string | null;
  balance_known: boolean;
  [key: string]: unknown;
};

export const distyraListAccountsAction = createAction({
  auth: distyraAuth,
  // Saved workflows refer to the action by name: don't rename it once published
  name: "list-accounts",
  displayName: "List Accounts",
  description:
    "The accounts the holder authorized on a bank connection: account_id (what transaction pulls filter on, new at every re-authorization), account_key (stable), name, currency, masked IBAN and account kind. This call reaches the bank for live balances, so it uses one of the connection's four unattended fetches per day: use it to set things up, not on a schedule.",
  props: {
    connectionId: distyraConnectionIdProp,
    allowStored: Property.Checkbox({
      displayName: "Allow stored details",
      description:
        "Only helps right after a fetch failed at the bank: answer from stored details without live balances, and without using a fetch.",
      required: false,
      defaultValue: false,
    }),
    // Not read by the run: an app's setup picks accounts through it
    account: distyraAccountProp,
  },
  errorHandlingOptions: {
    // Off by default: every attempt spends one of the bank's daily fetches.
    retryOnFailure: { defaultValue: false },
    continueOnFailure: { defaultValue: false },
  },
  async run(context) {
    const { connectionId, allowStored } = context.propsValue;
    const response = await distyraRequest<{ accounts?: DistyraAccount[] }>({
      credentials: context.auth.props,
      path: `/v1/connect/connections/${encodeURIComponent(connectionId)}/accounts`,
      query: { allow_stored: allowStored === true ? "true" : undefined },
    });
    const accounts = response.accounts ?? [];
    return { connectionId, count: accounts.length, accounts };
  },
});
