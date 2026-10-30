// Where a sign-in to the publisher's Google app finishes, as the integrations
// UI needs to know it. A page on loopback is the runner's own: the provider
// sends the sign-in back to this machine (today's local flow). Anywhere else
// the UI asks the switchboard (workflowRuntime.oauthSignIn) instead of
// guessing from the page's address: RELAY or WEB means the sign-in finishes
// in this environment, from this browser (the cloud flow); DESKTOP, NONE or
// no answer keeps the hand-off to the computer that runs Sektar.
import { useEffect, useState } from "react";
import {
  signInMode,
  useWorkflowRuntimeUrl,
  type SignInMode,
} from "./workflow-runtime.js";

/** The publisher's Google app (powerhouse.config.json workflows.oauthApps; the reconciler's GOOGLE_APP). */
export const SIGN_IN_APP = "sektar-google";

/**
 * local: this browser is on the runner (loopback page); cloud: the sign-in
 * finishes in this environment from any browser; handoff: it finishes on
 * the computer that runs Sektar, not here.
 */
export type SignInPlace = "local" | "cloud" | "handoff";

/** The page addresses that are the runner's own (unchanged from the hostname guess). */
const LOOPBACK_PAGES = ["localhost", "127.0.0.1", "[::1]"];

export function isLoopbackPage(hostname: string): boolean {
  return LOOPBACK_PAGES.includes(hostname);
}

/** Where the sign-in finishes, from the page's hostname and the switchboard's answer (null: not asked yet). */
export function signInPlace(
  hostname: string,
  mode: SignInMode | null,
): SignInPlace {
  if (isLoopbackPage(hostname)) return "local";
  if (mode === "RELAY" || mode === "WEB") return "cloud";
  return "handoff";
}

/**
 * Whether the texts speak of "this environment" rather than a computer: the
 * sign-in finishes here (cloud), or the runner is the environment the page
 * is served from (its label is the public host, runner.ts).
 */
export function speaksOfEnvironment(
  place: SignInPlace,
  runnerLabel: string | null | undefined,
  hostname: string,
): boolean {
  if (place === "cloud") return true;
  if (place === "local") return false;
  return Boolean(runnerLabel) && runnerLabel === hostname;
}

/** Answers per workflow-runtime URL: asked once per page load. */
const answers = new Map<string, Promise<SignInMode>>();

function askOnce(url: string): Promise<SignInMode> {
  let answer = answers.get(url);
  if (!answer) {
    answer = signInMode(url, SIGN_IN_APP).then((mode) => {
      // No answer may be a passing failure: ask again next time
      if (mode === "UNKNOWN") answers.delete(url);
      return mode;
    });
    answers.set(url, answer);
  }
  return answer;
}

const known = new Map<string, SignInMode>();

/**
 * Where a sign-in finishes for this page, and the switchboard's mode. On a
 * loopback page nothing is asked: it is the local flow. Elsewhere it is the
 * hand-off until the switchboard answers.
 */
export function useSignInPlace(): {
  place: SignInPlace;
  mode: SignInMode | null;
  hostname: string;
} {
  const url = useWorkflowRuntimeUrl();
  const hostname = window.location.hostname;
  const loopback = isLoopbackPage(hostname);
  const [mode, setMode] = useState<SignInMode | null>(() =>
    loopback ? null : (known.get(url) ?? null),
  );
  useEffect(() => {
    if (loopback) return;
    let live = true;
    void askOnce(url).then((answer) => {
      if (answer !== "UNKNOWN") known.set(url, answer);
      if (live) setMode(answer);
    });
    return () => {
      live = false;
    };
  }, [url, loopback]);
  return { place: signInPlace(hostname, mode), mode, hostname };
}

/** A failed sign-in start, in plain words; detail: the switchboard's own text, smaller. */
export type SignInFailure = { text: string; detail: string | null };

/**
 * What a failed startOAuth means to the person: a switchboard without a
 * client for the app (nobody set up Google sign-in there), a switchboard out
 * of reach, or else its own text.
 */
export function explainSignInFailure(
  error: unknown,
  provider = "Google",
): SignInFailure {
  const raw = error instanceof Error ? error.message : String(error);
  if (/has no web client on this host|no desktop client/i.test(raw)) {
    return {
      text: `This Sektar can't sign in to ${provider} yet: ask whoever runs it to set up ${provider} sign-in.`,
      detail: raw,
    };
  }
  if (
    (error instanceof TypeError &&
      /fetch|network|load failed/i.test(raw)) ||
    /^(Failed to fetch|NetworkError\b|Load failed$|fetch failed$)/i.test(raw)
  ) {
    return { text: "Couldn't reach Sektar's server. Try again.", detail: null };
  }
  return { text: raw, detail: null };
}
