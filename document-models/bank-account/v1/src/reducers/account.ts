import type { BankAccountAccountOperations } from "document-models/bank-account/v1";
import {
  BalanceCurrencyMismatchError,
  CurrencyLockedError,
  InvalidAccountCurrencyError,
  StaleBalanceError,
} from "../../gen/account/error.js";

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
  correctCurrencyOperation(state, action) {
    const code = action.input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code))
      throw new InvalidAccountCurrencyError(
        `"${action.input.currency}" is not a three-letter currency code`,
      );
    state.currency = code;
  },
  recordBankBalanceOperation(state, action) {
    const currency = action.input.currency?.trim().toUpperCase();
    if (currency && currency !== state.currency)
      throw new BalanceCurrencyMismatchError(
        `The bank reports a balance in ${currency}; the account is in ${state.currency}`,
      );
    if (state.bankBalance && action.input.readAt < state.bankBalance.readAt)
      throw new StaleBalanceError(
        "The account already holds a later reading of its balance",
      );
    // What the account adds up to: its booked transactions that count (a pending
    // one is not booked yet, an excluded one is left out), in cents so the sum
    // carries no float error into the opening balance.
    const counted = state.transactions
      .filter((t) => t.status !== "EXCLUDED" && t.status !== "PENDING")
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
    state.openingBalance =
      (Math.round(action.input.amount * 100) - counted) / 100;
    state.bankBalance = {
      amount: action.input.amount,
      readAt: action.input.readAt,
      kind: action.input.kind || null,
    };
  },
};
