import { createContext, useContext } from "react";

/** The top-bar search is page-scoped: pages read the query and filter. */
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
