// @ts-check
// `ph run cli` brings up the switchboard + Connect together as one
// supervised stack (generic compound): the production shape of Sektar, and
// what the container image runs (hosts/cli/Dockerfile, README.md).
//
// - The switchboard serves Sektar's drives from Postgres. Without Portle
//   (publication through a tunnel is the desktop's and the studio's) and
//   without the Vetra studio plugins (those are the vetra host's, verb dev).
// - Connect is a pure REMOTE CLIENT of it, as in the vetra host: no local
//   reactor, no PGlite in the tab. Its server proxies the switchboard's paths
//   and serves the switchboard's URLs as ${origin}, so the browser only ever
//   talks to the page's own origin, whatever domain or proxy is in front.
//
// Verbs (forwarded to both members): `build` builds the project package and
// Connect and starts nothing; `serve` starts the switchboard in production
// mode and serves the built Connect; `run` would start Connect's dev server.
//
// Deployment settings come from the environment: PH_SWITCHBOARD_DATABASE_URL
// names the database (below), and the switchboard reads auth, the workflow
// secrets key and the rest from it as well (README.md lists them).
//
// A $map over the switchboard's outputs is avoided below: `ph run cli build`
// (6.2.3-dev.80) maps Connect's drive declarations before any output exists.
import connect from "../connect/host.js";
import switchboardHost from "../switchboard/host.js";
import { outputs as switchboard } from "../switchboard/outputs.js";

/** Plugins that do not belong in production (see above). */
const NOT_IN_PRODUCTION = new Set(["@powerhousedao/portle/switchboard"]);

/** The drives the switchboard reports (hosts/switchboard/outputs.js). */
const SERVED_DRIVES = /** @type {Exclude<keyof typeof switchboard.drives, "$item">[]} */ (
  Object.keys(switchboard.drives)
    .filter((key) => key !== "$item")
    .sort()
);

/** Every interface: in a container, Docker publishes the ports from outside. */
const ALL_INTERFACES = "0.0.0.0";

/** @satisfies {PHHost} */
export default {
  name: "cli",

  runner: {
    module: "@powerhousedao/host-core/runners/compound",
  },

  // No startOrder: the cli-connect member's output tokens start the
  // switchboard first (`ph run cli --explain outputs` prints the order).

  children: {
    // The switchboard host, minus Portle, on Postgres.
    "cli-switchboard": {
      host: "switchboard",
      runner: {
        host: ALL_INTERFACES,
        plugins: switchboardHost.runner.plugins.filter(
          (entry) =>
            !NOT_IN_PRODUCTION.has(
              typeof entry === "string" ? entry : entry.module,
            ),
        ),
      },
      reactor: {
        ...switchboardHost.reactor,
        backends: {
          main: {
            kind: "in-process",
            // Postgres, at the URL the environment gives: the switchboard
            // reads PH_SWITCHBOARD_DATABASE_URL for both its reactor store and
            // its read model (one database may serve both). Not written here:
            // a host file cannot read the environment, a storage url takes no
            // $env token, and a url the host names would beat the env's.
            // Unset, the switchboard would fall back to PGlite, so the image
            // refuses to start without it; locally:
            //   PH_SWITCHBOARD_DATABASE_URL=postgres://sektar:sektar@localhost:5434/sektar ph run cli serve
            storage: { kind: "postgres" },
          },
        },
      },
    },

    // Connect as a remote client (full-statement reactor override; the
    // standalone connect host's own reactor is untouched). The lone remote
    // backend selects reactorClient "remote"; the remote drives give the
    // client the Switchboard URL to proxy to.
    "cli-connect": {
      host: "connect",
      // Connect's server proxies the switchboard's paths to the member, and
      // serves the switchboard's URLs below as ${origin}: the browser talks
      // to its own origin for everything.
      runner: {
        host: ALL_INTERFACES,
        proxy: { target: switchboard.origin },
      },
      reactor: {
        // the override is a full statement: keep the connect host's protocol
        protocol: connect.reactor.protocol,
        backends: {
          sb: {
            kind: "remote",
            // a remote backend is named by one of its drives
            remote: { url: switchboard.drives.sektar.url },
          },
        },
        // Every drive the switchboard member serves (its declared ones and
        // the ones its plugins create, workflows), by the URL it reports, in
        // key-sorted order. A list of output tokens rather than a $map over
        // the switchboard's outputs: `ph run cli build` (6.2.3-dev.80) maps
        // the declarations before any output exists, and fails on a $map.
        drives: SERVED_DRIVES.map((slug) => ({
          slug,
          remote: { url: switchboard.drives[slug].url },
        })),
      },
    },
  },
};
