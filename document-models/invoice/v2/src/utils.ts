// Helpers that read an invoice the same way everywhere: totals, rates, the
// VAT category codes, and the line rule the reducers enforce (so an editor
// can say what is wrong before it dispatches).
export { lineProblem } from "./rules.js";
export * from "./totals.js";
