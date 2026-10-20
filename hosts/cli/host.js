// @ts-check
// `ph run cli` brings up the switchboard + Connect together as one
// supervised stack (generic compound). The drive lives in the switchboard;
// Connect runs as a pure REMOTE CLIENT of it — a lone remote backend makes
// reactorClient "remote", so this Connect builds NO local reactor and never
// downloads PGlite. (Contrast desktop, where Connect takes the same drive as
// a SYNCHRONIZED remote drive — a local replica, which keeps PGlite by
// design. remote client = no local store; synchronized remote drive = local
// store.) Standalone `ph run connect` is untouched — still a local reactor.
import switchboardHost from "../switchboard/host.js";
import { outputs as switchboard } from "../switchboard/outputs.js";

// The drive(s) the switchboard declares — the single source Connect's
// remote attachment derives from. (T4: `$map` over the switchboard's
// `drives` output also attaches plugin-created drives such as workflows.)
const serverDrives = switchboardHost.reactor.drives ?? [];

/** @satisfies {PHHost} */
export default {
  name: "cli",

  // run → each member starts at "run": switchboard = server, Connect = studio
  // (no build step needed).
  runner: {
    module: "@powerhousedao/host-core/runners/compound",
  },

  config: {
    startOrder: ["cli-switchboard", "cli-connect"],
  },

  children: {
    // Inherits the switchboard host wholesale — including its drive.
    "cli-switchboard": { host: "switchboard" },

    // Connect as a remote client (full-statement reactor override; the
    // standalone connect host's own reactor is untouched). The lone remote
    // backend selects reactorClient "remote"; the remote default drive(s)
    // give the client the Switchboard URL to proxy to.
    "cli-connect": {
      host: "connect",
      // Every URL is the switchboard member's output (what it actually
      // bound), so the compound starts it first.
      reactor: {
        backends: {
          sb: {
            kind: "remote",
            remote: { url: switchboard.endpoints.graphql },
          },
        },
        drives: serverDrives.map((drive) => ({
          slug: drive.slug,
          remote: {
            url: {
              $output: { host: "switchboard", path: ["drives", drive.slug, "url"] },
            },
          },
        })),
      },
    },
  },
};
