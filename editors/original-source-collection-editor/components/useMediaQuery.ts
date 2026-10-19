import { useEffect, useState } from "react";

/**
 * Whether the viewport currently matches a query.
 *
 * The three-pane layout is not a styling choice that CSS can carry on its
 * own: on a narrow screen the panes become *navigation*, with only one
 * visible and a way back. That is real state, so the breakpoint has to be
 * readable from JavaScript rather than only from a media query.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => {
      setMatches(list.matches);
    };
    // Called once on mount as well: the initial state was computed before
    // this effect ran, and the viewport can change in between.
    update();
    list.addEventListener("change", update);
    return () => {
      list.removeEventListener("change", update);
    };
  }, [query]);

  return matches;
}
