import { useCallback, useEffect, useState } from "react";

/**
 * A step of the create flow kept in the URL's hash (`#add`, `#add/where`), so
 * the phone's back button goes back a step and a reload stays on it. The hash
 * leaves the drive's route alone: Connect's router keeps showing this app.
 */
export function useHashStep(): [
  string | null,
  (next: string | null, options?: { replace?: boolean }) => void,
] {
  const read = () => {
    const hash = window.location.hash.replace(/^#/, "");
    return hash ? decodeURIComponent(hash) : null;
  };
  const [step, setStep] = useState<string | null>(read);

  useEffect(() => {
    const onChange = () => setStep(read());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const go = useCallback(
    (next: string | null, options?: { replace?: boolean }) => {
      const url = `${window.location.pathname}${window.location.search}${next ? `#${next}` : ""}`;
      if (options?.replace)
        window.history.replaceState(window.history.state, "", url);
      else window.history.pushState(window.history.state, "", url);
      setStep(next);
    },
    [],
  );

  return [step, go];
}
