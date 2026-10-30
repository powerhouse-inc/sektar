import { useSyncExternalStore } from "react";

// The name the user gave us, for the greetings and the assistant. It lives in
// this browser only: not in a document, and not sent anywhere else.

const KEY = "sektar:user-name";

/** The name for this session, set only when storage refused to keep it. */
let unstored: string | undefined;

const listeners = new Set<() => void>();

/** One line, no outer spaces; an empty result means no name. */
export function cleanUserName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** The user's name, or "" when none is set. */
export function getUserName(): string {
  if (unstored !== undefined) return unstored;
  try {
    return cleanUserName(localStorage.getItem(KEY) ?? "");
  } catch {
    return "";
  }
}

/** Remembers the name; an empty one clears it. */
export function setUserName(value: string): void {
  const name = cleanUserName(value);
  try {
    if (name) localStorage.setItem(KEY, name);
    else localStorage.removeItem(KEY);
    unstored = undefined;
  } catch {
    // A private window, say: the name lasts as long as this page does.
    unstored = name;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab's change arrives as a storage event; a page with no window
  // (the tests' server render) has none to listen to.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

/** The user's name, following every change to it; "" when none is set. */
export function useUserName(): string {
  return useSyncExternalStore(subscribe, getUserName, getUserName);
}

/** "Good morning, Marit.", or "Good morning." when there is no name. */
export function greeting(hour: number, name: string): string {
  const part =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}
