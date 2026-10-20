// @ts-check
// vetra is the GENERIC compound over the project's switchboard and connect
// members, each composed with the Vetra Studio plugins — there is no
// vetra-specific runner. Studio is verb-scoped: `ph run vetra dev` gets the
// Vite package loader + studio UI + codegen reload; `ph run vetra` (run) is
// the same stack headless. Members spread their sibling host's composition
// (full inclusion) and add studio.
// Requires @powerhousedao/vetra-studio in devDependencies (private until its
// first publish — link the workspace package meanwhile; added to the
// versioned scaffold deps at that publish event, same as host-core/clint).
import config from "../../powerhouse.config.json" with { type: "json" };
import switchboard from "../switchboard/host.js";
import connect from "../connect/host.js";

// Every drive the switchboard host serves (the business drive, Mail,
// Backfills): the studio switchboard serves the same list, and the studio
// Connect attaches each one as a remote, being a remote client of it.
const servedDrives = switchboard.reactor.drives ?? [];

/** @satisfies {PHHost} */
export default {
  name: "vetra",

  runner: {
    module: "@powerhousedao/host-core/runners/compound",
    defaultVerb: "dev",
  },

  children: {
    "vetra-switchboard": {
      host: "switchboard",
      runner: {
        plugins: [
          ...switchboard.runner.plugins,
          { module: "@powerhousedao/vetra-studio/switchboard", verbs: ["dev"] },
        ],
      },
      // The studio drives, declared (projectHash keeps today's ids), plus
      // every drive the switchboard host serves: the studio Connect is a
      // pure remote client of this member (below), so the business drive
      // has to live here too.
      reactor: {
        ...switchboard.reactor,
        drives: [
          ...(switchboard.reactor.drives ?? []),
          {
            slug: "vetra",
            name: "Vetra",
            projectHash: true,
            preferredEditor: "vetra-drive-app",
          },
          { slug: "vetra-preview", name: "Vetra Preview", projectHash: true },
          ...servedDrives,
        ],
      },
    },
    "vetra-studio": {
      host: "connect",
      runner: {
        port: config.vetra?.connectPort ?? 3001,
        plugins: [
          ...connect.runner.plugins,
          { module: "@powerhousedao/vetra-studio/connect", verbs: ["dev"] },
        ],
      },
      // The studio Connect is a pure REMOTE CLIENT of the studio switchboard
      // (as the cli host's Connect is): no reactor and no PGlite in the tab,
      // every read and write proxied over GraphQL. A synchronized remote
      // drive would replicate the Mail drive into the browser, thousands of
      // messages with bodies, and re-derive the whole history into a sync
      // outbox on every fresh tab, which stalled the switchboard for minutes.
      // The studio drives (vetra, preview) are attached by the studio plugin.
      reactor: {
        backends: {
          sb: {
            kind: "remote",
            remote: { url: `http://127.0.0.1:${switchboard.runner.port}/graphql` },
          },
        },
        drives: servedDrives.map((d) => ({
          slug: d.slug,
          remote: {
            url: `http://127.0.0.1:${switchboard.runner.port}/d/${d.slug}`,
          },
        })),
      },
    },
  },
};
