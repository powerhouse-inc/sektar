// The search context lives in the kit (editors/sektar/kit/search-context.ts)
// so drive apps can read the top bar's query too; the routes keep importing
// it from here.
export {
  matches,
  SearchContext,
  useSearch,
} from "../../../../editors/sektar/kit/search-context.js";
