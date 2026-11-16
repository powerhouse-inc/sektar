import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversionProfile } from "../../../conversions/contracts.js";
import {
  preparationActive,
  type ModelPreparation,
  type ModelReadiness,
} from "../../../conversions/models/contracts.js";
import type { ConversionClient } from "./conversion.js";
import { messageOf } from "./use-conversion.js";

export function useScannerReadiness(
  client: ConversionClient | null,
  profile: ConversionProfile | null,
  refresh = "",
) {
  const key = JSON.stringify([client?.host, profile, refresh]);
  const selected = useRef(profile);
  selected.current = profile;
  const [held, setHeld] = useState<{
    key: string;
    value: ModelReadiness | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const profile = selected.current;
    if (!client || !profile) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = () => {
      clearTimeout(timer);
      void client.modelReadiness(profile, abort.signal).then(
        (value) => {
          if (!abort.signal.aborted) setHeld({ key, value, error: null });
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          setHeld({
            key,
            value: null,
            error: messageOf(
              error,
              "Scanner availability could not be checked. Checking again when connected…",
            ),
          });
          timer = setTimeout(read, 2500);
        },
      );
    };
    read();
    window.addEventListener("focus", read);
    window.addEventListener("online", read);
    return () => {
      abort.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", read);
      window.removeEventListener("online", read);
    };
  }, [client, key]);
  return held?.key === key ? held : { value: null, error: null };
}

/** Polling observes the host's scanner setup; leaving this view never cancels it. */
export function useScannerPreparation(client: ConversionClient | null) {
  const key = client?.host ?? "";
  const latest = useRef(key);
  latest.current = key;
  const [held, setHeld] = useState<{
    key: string;
    view: ModelPreparation | null;
    error: string | null;
  }>({ key, view: null, error: null });
  const [turn, setTurn] = useState(0);
  const view = held.key === key ? held.view : null;
  const follow = useCallback(
    (next: ModelPreparation) => {
      if (latest.current !== key) return;
      setHeld({ key, view: next, error: null });
      setTurn((n) => n + 1);
    },
    [key],
  );
  useEffect(() => {
    if (!client) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const all = await client.preparations(abort.signal);
        const next = all.find(preparationActive) ?? all.at(0) ?? null;
        if (abort.signal.aborted) return;
        setHeld({ key, view: next, error: null });
        timer = setTimeout(
          () => void read(),
          next && preparationActive(next) ? 700 : 2500,
        );
      } catch {
        if (abort.signal.aborted) return;
        setHeld((old) => ({
          key,
          view: old.key === key ? old.view : null,
          error:
            "Connection interrupted. The host may still be preparing your scanner. Checking again…",
        }));
        timer = setTimeout(() => void read(), 2500);
      }
    };
    void read();
    const refresh = () => setTurn((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      abort.abort();
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [client, key, turn]);
  return { view, error: held.key === key ? held.error : null, follow };
}
