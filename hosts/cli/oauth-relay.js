// @ts-check
// Google sign-in for a Sektar in the cloud, through the publisher's relay
// (docs/superpowers/specs/2026-10-30-cloud-oauth-relay-design.md, Part 4).
//
// A switchboard plugin of the cli host (host.js names it in the
// switchboard member's runner.plugins). At start, before the workflow
// runtime is composed, it decides how the publisher app `sektar-google`
// signs in on this host:
//
// - PUBLIC_URL unset or loopback (a developer's machine): as configured.
// - The app's web client file is mounted (a self-hoster with their own
//   Google client): as configured; their client always wins.
// - Otherwise it asks sektar.io whether it relays for the PUBLIC_URL host
//   (GET <relay base>/api/oauth/hosts/<host> → { accepted }). Only on
//   accepted: true does it hand the switchboard `workflows.oauthApps`
//   itself: the config's entries, with `relay` added to `sektar-google`.
//   No answer, a refusal or an error: as configured.
//
// It logs one line saying which way it went. The relay values are public
// (a client id and two URLs; the secret stays on sektar.io), and the base is
// SEKTAR_OAUTH_RELAY_BASE (default https://sektar.vetra.io) for staging.
//
// Why a plugin: a host file is declarative (it cannot read the environment
// or wait on the network), and the switchboard's config has no
// `workflows.oauthApps` key a host file could set; the server options do,
// and a plugin's transformServerOptions hook may change them, async, before
// the workflow runtime reads them.
import fs from "node:fs";
import path from "node:path";

/** The publisher app the relay serves (powerhouse.config.json workflows.oauthApps). */
export const RELAY_APP = "sektar-google";
/** The relay's Google web client id: public, as in every authorization URL. */
export const RELAY_CLIENT_ID =
  "1081260940232-drh7cdlpoafbjt3f4mqj4bcp349hn5nb.apps.googleusercontent.com";
// sektar.io is not live yet; the site runs at sektar.vetra.io, a fixed domain
// that is registered on the Google client. Switch once sektar.io points there.
export const DEFAULT_RELAY_BASE = "https://sektar.vetra.io";

const LOG = "[sektar:oauth-relay]";

/**
 * @typedef {{ desktop?: string; web?: string }} OAuthClients
 * @typedef {{ clientId: string; redirectUri: string; tokenUrl: string }} OAuthRelay
 * @typedef {{ id: string; clients: OAuthClients; relay?: OAuthRelay }} OAuthApp
 * @typedef {(input: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>} FetchLike
 */

/** @param {string | undefined} base */
export function relayBase(base) {
  return (base?.trim() || DEFAULT_RELAY_BASE).replace(/\/+$/, "");
}

/**
 * The relay entry for an app, at the base.
 * @param {string | undefined} base
 * @returns {OAuthRelay}
 */
export function relayFor(base) {
  const b = relayBase(base);
  return {
    clientId: RELAY_CLIENT_ID,
    redirectUri: `${b}/api/oauth/callback`,
    tokenUrl: `${b}/api/oauth/token`,
  };
}

/** @param {string} hostname */
function isLoopbackHostname(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    /^127(\.\d{1,3}){3}$/.test(h)
  );
}

/**
 * The host of PUBLIC_URL when it is a public one; null when unset,
 * malformed or loopback.
 * @param {string | undefined} publicUrl
 */
export function publicHost(publicUrl) {
  if (!publicUrl?.trim()) return null;
  let host;
  try {
    host = new URL(publicUrl.trim()).hostname;
  } catch {
    return null;
  }
  return host && !isLoopbackHostname(host) ? host : null;
}

/**
 * Whether to ask sektar.io at all: a public PUBLIC_URL and no web client
 * file of the app on this host.
 * @param {{ publicUrl: string | undefined; webClientPresent: boolean }} facts
 * @returns {{ ask: true; host: string } | { ask: false; reason: string }}
 */
export function relayDecision({ publicUrl, webClientPresent }) {
  const host = publicHost(publicUrl);
  if (!host) {
    return {
      ask: false,
      reason: publicUrl?.trim()
        ? "PUBLIC_URL is loopback or not a URL"
        : "PUBLIC_URL is not set",
    };
  }
  if (webClientPresent) {
    return { ask: false, reason: "its own web client is mounted" };
  }
  return { ask: true, host };
}

/**
 * The apps with the relay added to the publisher app; the others unchanged.
 * @param {readonly OAuthApp[]} apps
 * @param {OAuthRelay} relay
 * @returns {OAuthApp[]}
 */
export function withRelay(apps, relay) {
  return apps.map((app) => (app.id === RELAY_APP ? { ...app, relay } : app));
}

/**
 * The config file's `workflows.oauthApps`, client paths made absolute from
 * the config file's folder: what the switchboard itself reads when nobody
 * passes them (server readConfigOAuthApps). Unreadable or malformed: none.
 * @param {string} configPath
 * @returns {OAuthApp[]}
 */
export function readConfigOAuthApps(configPath) {
  /** @type {unknown} */
  let raw;
  try {
    /** @type {{ workflows?: { oauthApps?: unknown } }} */
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    raw = config.workflows?.oauthApps;
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const dir = path.dirname(path.resolve(configPath));
  /** @param {unknown} p */
  const at = (p) =>
    typeof p === "string" && p ? path.resolve(dir, p) : undefined;
  /** @type {OAuthApp[]} */
  const apps = [];
  for (const entry of /** @type {unknown[]} */ (raw)) {
    const app = /** @type {{ id?: unknown; clients?: { desktop?: unknown; web?: unknown } }} */ (
      entry ?? {}
    );
    if (typeof app.id !== "string" || !app.id) continue;
    const desktop = at(app.clients?.desktop);
    const web = at(app.clients?.web);
    apps.push({
      id: app.id,
      clients: {
        ...(desktop ? { desktop } : {}),
        ...(web ? { web } : {}),
      },
    });
  }
  return apps;
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the relay whether it serves the host. "accepted" or "refused" as it
 * answered; "unreachable" when it did not answer within the attempts (a
 * network failure, a timeout or a server error is tried again).
 * @param {string} host
 * @param {{ base?: string; fetchImpl?: FetchLike; timeoutMs?: number; attempts?: number; pauseMs?: number }} [options]
 * @returns {Promise<"accepted" | "refused" | "unreachable">}
 */
export async function askRelay(host, options = {}) {
  const {
    base,
    fetchImpl = /** @type {FetchLike} */ (fetch),
    timeoutMs = 3000,
    attempts = 3,
    pauseMs = 1000,
  } = options;
  const url = `${relayBase(base)}/api/oauth/hosts/${encodeURIComponent(host)}`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const body = /** @type {{ accepted?: unknown } | null} */ (
          await res.json()
        );
        return body?.accepted === true ? "accepted" : "refused";
      }
      // A client error will not change on a retry
      if (res.status < 500) return "refused";
    } catch {
      // network failure or timeout: try again
    }
    if (attempt < attempts) await sleep(pauseMs);
  }
  return "unreachable";
}

/**
 * The oauthApps to hand the switchboard, or undefined to leave its own
 * reading of the config as it is. Logs one line.
 * @param {{
 *   env: Readonly<Record<string, string | undefined>>;
 *   apps: readonly OAuthApp[];
 *   fetchImpl?: FetchLike;
 *   exists?: (file: string) => boolean;
 *   log?: (line: string) => void;
 *   timeoutMs?: number;
 *   pauseMs?: number;
 * }} input
 * @returns {Promise<OAuthApp[] | undefined>}
 */
export async function relayOAuthApps({
  env,
  apps,
  fetchImpl,
  exists = fs.existsSync,
  log = (line) => console.log(line),
  timeoutMs,
  pauseMs,
}) {
  const app = apps.find((a) => a.id === RELAY_APP);
  if (!app) {
    log(`${LOG} Google sign-in as configured: no ${RELAY_APP} app in the config`);
    return undefined;
  }
  const web = app.clients.web;
  const decision = relayDecision({
    publicUrl: env.PUBLIC_URL,
    webClientPresent: Boolean(web && exists(web)),
  });
  if (!decision.ask) {
    log(`${LOG} Google sign-in as configured: ${decision.reason}`);
    return undefined;
  }
  const base = relayBase(env.SEKTAR_OAUTH_RELAY_BASE);
  const answer = await askRelay(decision.host, {
    base,
    ...(fetchImpl ? { fetchImpl } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(pauseMs !== undefined ? { pauseMs } : {}),
  });
  if (answer !== "accepted") {
    log(
      `${LOG} Google sign-in as configured: ${base} ${answer === "refused" ? "does not relay for" : "did not answer for"} ${decision.host}`,
    );
    return undefined;
  }
  log(`${LOG} Google sign-in through the relay at ${base} for ${decision.host}`);
  return withRelay(apps, relayFor(base));
}

/**
 * @typedef {{ configFile?: string; workflows?: { enabled?: boolean; oauthApps?: OAuthApp[] } } & Record<string, unknown>} ServerOptions
 */

/** The plugin: sets workflows.oauthApps only when the relay accepted this host. */
export default {
  name: "sektar-oauth-relay",
  appliesTo: "switchboard",
  hooks: {
    /**
     * @param {ServerOptions} options
     * @returns {Promise<ServerOptions>}
     */
    transformServerOptions: async (options) => {
      const apps =
        options.workflows?.oauthApps ??
        readConfigOAuthApps(
          options.configFile ??
            path.join(process.cwd(), "powerhouse.config.json"),
        );
      const relayed = await relayOAuthApps({ env: process.env, apps });
      if (!relayed) return options;
      return {
        ...options,
        workflows: { ...options.workflows, oauthApps: relayed },
      };
    },
  },
};
