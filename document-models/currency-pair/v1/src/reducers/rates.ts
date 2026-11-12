import type { CurrencyPairRatesOperations } from "document-models/currency-pair/v1";
import {
  DuplicateDateError,
  EmptyRatesError,
  InvalidManualRateError,
  InvalidRateError,
  ManualPairNotSetError,
  PairNotSetError,
  RateNotFoundError,
} from "../../gen/rates/error.js";

export const currencyPairRatesOperations: CurrencyPairRatesOperations = {
  recordRatesOperation(state, action) {
    if (!state.base || !state.quote)
      throw new PairNotSetError("Name the two currencies first");
    if (action.input.rates.length === 0)
      throw new EmptyRatesError("Nothing to record");
    const days = new Set<string>();
    for (const r of action.input.rates) {
      if (r.rate <= 0)
        throw new InvalidRateError(
          `A rate must be above zero (${r.date.slice(0, 10)})`,
        );
      const day = `${r.date.slice(0, 10)}T00:00:00.000Z`;
      if (days.has(day))
        throw new DuplicateDateError(
          `${day.slice(0, 10)} is in the batch twice`,
        );
      days.add(day);
    }
    for (const r of action.input.rates) {
      const day = `${r.date.slice(0, 10)}T00:00:00.000Z`;
      const held = state.rates.find((x) => x.date === day);
      if (!held) {
        state.rates.push({
          id: r.id,
          date: day,
          rate: r.rate,
          source: action.input.source,
          manual: false,
        });
      } else if (!held.manual) {
        held.rate = r.rate;
        held.source = action.input.source;
      }
    }
    state.rates.sort((a, b) => a.date.localeCompare(b.date));
    state.lastFetchedAt = action.input.fetchedAt;
  },
  setManualRateOperation(state, action) {
    if (!state.base || !state.quote)
      throw new ManualPairNotSetError("Name the two currencies first");
    if (action.input.rate <= 0)
      throw new InvalidManualRateError("A rate must be above zero");
    const day = `${action.input.date.slice(0, 10)}T00:00:00.000Z`;
    const held = state.rates.find((x) => x.date === day);
    if (held) {
      held.rate = action.input.rate;
      held.source = "Manual";
      held.manual = true;
    } else {
      state.rates.push({
        id: action.input.id,
        date: day,
        rate: action.input.rate,
        source: "Manual",
        manual: true,
      });
      state.rates.sort((a, b) => a.date.localeCompare(b.date));
    }
  },
  removeRateOperation(state, action) {
    const day = `${action.input.date.slice(0, 10)}T00:00:00.000Z`;
    const index = state.rates.findIndex((x) => x.date === day);
    if (index === -1)
      throw new RateNotFoundError(`No rate for ${day.slice(0, 10)}`);
    state.rates.splice(index, 1);
  },
};
