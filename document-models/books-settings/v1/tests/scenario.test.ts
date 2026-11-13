import {
  reducer,
  setBaseCurrency,
  utils,
  type BooksSettingsDocument,
} from "document-models/books-settings/v1";
import { describe, expect, it } from "vitest";

const T = "2026-11-12T09:00:00.000Z";
const lastError = (doc: BooksSettingsDocument) =>
  doc.operations.global.at(-1)?.error;

describe("books settings", () => {
  it("starts in euros", () => {
    const doc = utils.createDocument();
    expect(doc.state.global).toEqual({
      baseCurrency: "EUR",
      baseCurrencyChangedAt: null,
    });
  });

  it("takes a new main currency, in capitals", () => {
    const doc = reducer(
      utils.createDocument(),
      setBaseCurrency({ currency: " usd ", changedAt: T }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global).toEqual({
      baseCurrency: "USD",
      baseCurrencyChangedAt: T,
    });
  });

  it("refuses what is not a currency code and keeps the one it had", () => {
    let doc = reducer(
      utils.createDocument(),
      setBaseCurrency({ currency: "GBP", changedAt: T }),
    );
    for (const currency of ["", "EU", "EURO", "E1R"]) {
      doc = reducer(doc, setBaseCurrency({ currency, changedAt: T }));
      expect(lastError(doc)).toBe(
        `"${currency}" is not a three-letter currency code`,
      );
      expect(doc.state.global.baseCurrency).toBe("GBP");
    }
  });
});
