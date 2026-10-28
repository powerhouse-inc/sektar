import { Property } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { distyraRequest } from "./client.js";

type Account = {
  account_id: string;
  account_key: string | null;
  name: string | null;
  currency: string | null;
  iban_masked: string | null;
  cash_account_type: string | null;
};

/** What a picked account carries, as the option's value (JSON). */
export type PickedAccount = {
  accountId: string;
  accountKey: string;
  name: string | null;
  currency: string | null;
  ibanMasked: string | null;
  /** ISO 20022: CACC current, SVGS savings, CARD card, LOAN, OTHR */
  kind: string | null;
};

/**
 * The accounts of one bank connection, to pick from when setting up (an
 * app's "connect a bank" flow resolves it through the runtime's
 * blockOptions). Each option's value is a PickedAccount as JSON: the
 * account id transaction pulls filter on, and the key that stays the same
 * across re-authorizations. Listing reaches the bank for live details, so it
 * uses one of the connection's four unattended fetches a day: for setting
 * up, not for a schedule.
 */
export const distyraAccountProp = Property.Dropdown({
  displayName: "Account",
  description:
    "One account of the bank connection. Listing them reaches the bank, which uses one of its four unattended fetches a day.",
  required: false,
  auth: distyraAuth,
  refreshers: ["connectionId"],
  options: async ({ auth, connectionId }) => {
    if (!auth) {
      return {
        disabled: true,
        placeholder: "Connect your Distyra account first",
        options: [],
      };
    }
    if (typeof connectionId !== "string" || connectionId === "") {
      return {
        disabled: true,
        placeholder: "Pick a connection first",
        options: [],
      };
    }
    try {
      const response = await distyraRequest<{ accounts?: Account[] }>({
        credentials: auth.props,
        path: `/v1/connect/connections/${encodeURIComponent(connectionId)}/accounts`,
      });
      const accounts = response.accounts ?? [];
      if (accounts.length === 0) {
        return {
          disabled: true,
          placeholder: "No accounts on this connection",
          options: [],
        };
      }
      return {
        options: accounts.map((a) => {
          const picked: PickedAccount = {
            accountId: a.account_id,
            accountKey: a.account_key ?? a.account_id,
            name: a.name,
            currency: a.currency,
            ibanMasked: a.iban_masked,
            kind: a.cash_account_type,
          };
          const label = [a.name ?? "Account", a.currency, a.iban_masked]
            .filter(Boolean)
            .join(" · ");
          return { label, value: JSON.stringify(picked) };
        }),
      };
    } catch (error) {
      return {
        disabled: true,
        placeholder:
          error instanceof Error ? error.message : "Could not load accounts",
        options: [],
      };
    }
  },
});
