import type { CurrencyPairPairOperations } from "document-models/currency-pair/v1";
import {
  InvalidPairCurrencyError,
  PairLockedError,
  SameCurrencyError,
} from "../../gen/pair/error.js";

export const currencyPairPairOperations: CurrencyPairPairOperations = {
  setPairOperation(state, action) {
    const base = action.input.base.trim().toUpperCase();
    const quote = action.input.quote.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote))
      throw new InvalidPairCurrencyError(
        `"${action.input.base}" and "${action.input.quote}" must be three-letter currency codes`,
      );
    if (base === quote)
      throw new SameCurrencyError("A currency needs no rate to itself");
    if (
      state.rates.length > 0 &&
      (state.base !== base || state.quote !== quote)
    )
      throw new PairLockedError("The pair cannot change once it holds rates");
    state.base = base;
    state.quote = quote;
  },
};
