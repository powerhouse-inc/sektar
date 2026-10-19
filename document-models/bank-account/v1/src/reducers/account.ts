import type { BankAccountAccountOperations } from "document-models/bank-account/v1";
import { CurrencyLockedError } from "../../gen/account/error.js";

export const bankAccountAccountOperations: BankAccountAccountOperations = {
  setAccountDetailsOperation(state, action) {
    if (action.input.name !== undefined) state.name = action.input.name;
    if (action.input.institution !== undefined)
      state.institution = action.input.institution;
    if (action.input.iban !== undefined) state.iban = action.input.iban;
    if (action.input.kind !== undefined && action.input.kind !== null)
      state.kind = action.input.kind;
    if (action.input.currency !== undefined && action.input.currency !== null) {
      if (
        state.transactions.length > 0 &&
        action.input.currency !== state.currency
      ) {
        throw new CurrencyLockedError(
          "The currency cannot change once transactions exist",
        );
      }
      state.currency = action.input.currency;
    }
    if (
      action.input.openingBalance !== undefined &&
      action.input.openingBalance !== null
    )
      state.openingBalance = action.input.openingBalance;
  },
};
