import type { DocumentModelGlobalState } from "document-model";

export const documentModel: DocumentModelGlobalState = {
  id: "sektar/books-settings",
  name: "Books Settings",
  author: {
    name: "Sektar",
    website: "https://sektar.example",
  },
  extension: "bks",
  description:
    "The settings of the books: the main currency every total is added up in.",
  specifications: [
    {
      version: 1,
      changeLog: [],
      state: {
        global: {
          schema:
            'type BooksSettingsState {\n  "The currency the books add up in (ISO 4217)"\n  baseCurrency: String!\n  "When the main currency last changed"\n  baseCurrencyChangedAt: DateTime\n}',
          initialValue:
            '{"baseCurrency": "EUR", "baseCurrencyChangedAt": null}',
          examples: [],
        },
        local: {
          schema: "",
          initialValue: "",
          examples: [],
        },
      },
      modules: [
        {
          id: "ee430397-84ae-434a-8aad-647e8728c876",
          name: "currency",
          description: "The main currency of the books",
          operations: [
            {
              id: "bde2df7c-4f2f-4434-a7de-02696135f240",
              name: "SET_BASE_CURRENCY",
              description: "Choose the currency the totals are shown in",
              schema:
                "input SetBaseCurrencyInput {\n  currency: String!\n  changedAt: DateTime!\n}",
              template: "",
              reducer:
                'const code = action.input.currency.trim().toUpperCase();\nif (!/^[A-Z]{3}$/.test(code))\n  throw new InvalidCurrencyError(\n    `"${action.input.currency}" is not a three-letter currency code`,\n  );\nstate.baseCurrency = code;\nstate.baseCurrencyChangedAt = action.input.changedAt;',
              errors: [
                {
                  id: "130245e7-9aa2-4281-b667-8f570f0bfc83",
                  code: "INVALID_CURRENCY",
                  name: "InvalidCurrencyError",
                  description:
                    "The currency is not a three-letter ISO 4217 code",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
      ],
    },
  ],
};
