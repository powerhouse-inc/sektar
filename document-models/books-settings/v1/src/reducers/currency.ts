import type { BooksSettingsCurrencyOperations } from "document-models/books-settings/v1";
import { InvalidCurrencyError } from "../../gen/currency/error.js";

export const booksSettingsCurrencyOperations: BooksSettingsCurrencyOperations =
  {
    setBaseCurrencyOperation(state, action) {
      const code = action.input.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code))
        throw new InvalidCurrencyError(
          `"${action.input.currency}" is not a three-letter currency code`,
        );
      state.baseCurrency = code;
      state.baseCurrencyChangedAt = action.input.changedAt;
    },
  };
