// The top bar's search is page-scoped: the shell holds the query, the page
// (or the drive app) on screen reads it and filters. Lives in the kit so a
// drive app can read it without importing route code; the shell provides it.
import { createContext, useContext } from "react";

export const SearchContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
}>({
  query: "",
  setQuery: () => {},
});

export const useSearch = () => useContext(SearchContext);

export function matches(
  query: string,
  ...fields: (string | null | undefined | number)[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some(
    (f) => f !== null && f !== undefined && String(f).toLowerCase().includes(q),
  );
}
