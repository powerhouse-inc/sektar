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

// The drives the studio switchboard serves to Connect over the network (a
// subset of the switchboard host's list): Mail, whose attachments live in
// the switchboard's store, and Backfills, whose queues the workflows advance
// through the switchboard.
const SERVED = new Set(["mail", "backfills"]);
const mailDrives = (switchboard.reactor.drives ?? []).filter((d) =>
  SERVED.has(d.slug),
);

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
      // The switchboard host's own drives (sektar) plus the studio drives,
      // declared (projectHash keeps today's ids):
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
          // Mail and Backfills, served here so the studio Connect can attach
          // them as remotes (the drive apps reach the attachment store and
          // the workflow runtime through the switchboard behind the drive).
          ...mailDrives,
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
      // The studio Connect keeps its own local drives (the business drive)
      // but takes Mail and Backfills from the studio switchboard as REMOTES:
      // the standalone host's local copies are dropped so each slug names
      // one drive, the switchboard's.
      reactor: {
        ...connect.reactor,
        drives: [
          ...(connect.reactor.drives ?? []).filter(
            (d) => !mailDrives.some((m) => m.slug === d.slug),
          ),
          ...mailDrives.map((d) => ({
            slug: d.slug,
            remote: {
              url: `http://127.0.0.1:${switchboard.runner.port}/d/${d.slug}`,
            },
          })),
        ],
      },
    },
  },
};
