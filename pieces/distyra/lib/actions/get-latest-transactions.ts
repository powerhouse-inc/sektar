import { createAction } from "@powerhousedao/pieces-framework";
import { distyraAuth } from "../auth.js";
import { pullProps, runPull } from "../common/pull.js";
import type { DistyraTransactionsResult } from "../common/types.js";

export const distyraGetLatestTransactionsAction = createAction({
  auth: distyraAuth,
  // Saved workflows refer to the action by name: don't rename it once published
  name: "get-latest-transactions",
  displayName: "Get Latest Transactions",
  description:
    "Fetch normalized bank transactions for a Distyra Connect connection, exactly as the API returns them. Transactions are read live from the bank on every call and never stored, so this is a pull: leave the dates empty on the first run to get all the history the bank will give, then feed the returned next_cursor back in as Since to pick up only what is new.",
  props: pullProps,
  errorHandlingOptions: {
    // Off by default: every attempt spends one of the bank's four unattended
    // fetches per connection per day, so an automatic retry is more likely to
    // exhaust the allowance than to recover.
    retryOnFailure: { defaultValue: false },
    continueOnFailure: { defaultValue: false },
  },
  async run(context) {
    const response = await runPull(context.auth.props, context.propsValue);

    // Every field the API documents passes through untouched so later steps can
    // read `truncated` and `next_cursor` directly. `transactions` is normalized
    // to an array so downstream steps can always iterate it.
    const result: DistyraTransactionsResult = {
      ...response,
      transactions: response.transactions ?? [],
    };
    return result;
  },
});
