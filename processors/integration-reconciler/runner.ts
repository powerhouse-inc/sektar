/**
 * Who this switchboard is, as the runner of an integration. On someone's own
 * computer it is the machine (`switchboard@<hostname>`, labelled with the
 * hostname). In an environment with a public address (PUBLIC_URL, not
 * loopback) it is that address's host: a pod's hostname changes with every
 * restart, and a runner id that changes orphans the integrations it claimed.
 */
import type { Host } from "./reconcile.js";

export type RunnerIdentity = {
  /** What RECORD_RUNNER records */
  me: Host;
  /** Runs as an environment at a public address (its texts say "in this environment") */
  environment: boolean;
};

/** Whether a hostname names this machine itself (localhost, 127.x, ::1, *.localhost). */
export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    /^127(\.\d{1,3}){3}$/.test(h)
  );
}

/** The host of PUBLIC_URL when it is a public one; null when unset, malformed or loopback. */
export function publicHost(publicUrl: string | undefined): string | null {
  if (!publicUrl?.trim()) return null;
  let host: string;
  try {
    host = new URL(publicUrl.trim()).hostname;
  } catch {
    return null;
  }
  if (!host || isLoopbackHostname(host)) return null;
  return host;
}

export function runnerIdentity(
  publicUrl: string | undefined,
  osHostname: string,
): RunnerIdentity {
  const host = publicHost(publicUrl);
  if (host) {
    return {
      me: { reactorId: `switchboard@${host}`, label: host },
      environment: true,
    };
  }
  return {
    me: { reactorId: `switchboard@${osHostname}`, label: osHostname },
    environment: false,
  };
}
