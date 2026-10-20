import type { InvoiceCurrencyOperations } from "document-models/invoice/v2";
import {
  InvalidCurrencyError,
  InvalidRateError,
  InvoiceNotDraftError,
  RateNotFoundError,
} from "../../gen/currency/error.js";
import { code, isCurrencyCode, repriceLines, text } from "../rules.js";

export const invoiceCurrencyOperations: InvoiceCurrencyOperations = {
  setCurrencyOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "The currency is fixed once the invoice is issued",
      );
    const currency =
      action.input.currency === undefined || action.input.currency === null
        ? state.currency
        : code(action.input.currency);
    const vatCurrency =
      action.input.vatCurrency === undefined
        ? state.vatCurrency
        : code(action.input.vatCurrency);
    if (!isCurrencyCode(currency))
      throw new InvalidCurrencyError(
        "The currency must be an ISO 4217 code, such as EUR",
      );
    if (
      vatCurrency !== null &&
      vatCurrency !== undefined &&
      !isCurrencyCode(vatCurrency)
    )
      throw new InvalidCurrencyError(
        "The VAT currency must be an ISO 4217 code, such as EUR",
      );
    if (vatCurrency === currency)
      throw new InvalidCurrencyError(
        "The VAT currency is only set when it differs from the invoice currency",
      );
    state.currency = currency;
    state.vatCurrency = vatCurrency ?? null;
    repriceLines(state);
  },
  setExchangeRateOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "Exchange rates are fixed once the invoice is issued",
      );
    const base = code(i.base);
    const quote = code(i.quote);
    if (!isCurrencyCode(base) || !isCurrencyCode(quote) || base === quote)
      throw new InvalidRateError(
        "A rate links two different ISO 4217 currencies",
      );
    if (!Number.isFinite(i.rate) || i.rate <= 0)
      throw new InvalidRateError("The rate must be positive");
    const kept = state.exchangeRates.filter(
      (r) =>
        !(
          (r.base === base && r.quote === quote) ||
          (r.base === quote && r.quote === base)
        ),
    );
    kept.push({
      base,
      quote,
      rate: i.rate,
      date: i.date ?? null,
      source: text(i.source),
    });
    state.exchangeRates = kept;
    repriceLines(state);
  },
  removeExchangeRateOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "Exchange rates are fixed once the invoice is issued",
      );
    const base = code(action.input.base);
    const quote = code(action.input.quote);
    const index = state.exchangeRates.findIndex(
      (r) =>
        (r.base === base && r.quote === quote) ||
        (r.base === quote && r.quote === base),
    );
    if (index < 0) throw new RateNotFoundError("No rate for that pair");
    state.exchangeRates.splice(index, 1);
  },
};
