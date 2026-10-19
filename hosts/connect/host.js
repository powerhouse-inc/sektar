// @ts-check
// Static projection of powerhouse.config.json and the switchboard sibling;
// runtime behavior lives in the runner module named below.
import config from "../../powerhouse.config.json" with { type: "json" };
import switchboardHost from "../switchboard/host.js";
import { outputs as switchboard } from "../switchboard/outputs.js";

/** @satisfies {PHHost} */
export default {
  name: "sektar-connect",

  // `ph run connect` (sugar: `ph connect` once hosts are active) imports
  // and calls this module. Options here are consumed by the runner and never
  // emitted into the runtime config.
  runner: {
    module: "@powerhousedao/ph-cli/runners/connect",
    port: config.studio?.port ?? 3000, // referenced — the value stays in powerhouse.config.json

    // THE COMPOSITION — presence is activation (no feature flags behind
    // these lines). The generic shell is Connect's chrome: sidebar, home,
    // /d/ URLs, drive management. It OWNS the drive-chrome toggles — passed in
    // its `config` here. Removing the entry turns those toggles OFF (live
    // today — no add-drive affordance). NOTE: it does not yet unmount the
    // chrome UI itself; gating the shell on this plugin ("go headless / swap
    // your own shell") is on the roadmap. Branding is NOT set here — it stays
    // top-level connect.branding.
    // No generic plugin: Sektar brings its own shell (hosts/connect/routes/
    // _app.tsx) — the business never sees Connect's generic chrome.
    plugins: [
      // Productivity Center's workflows: this plugin loads Workflow Studio
      // and attaches the Workflows drive the switchboard's workflows plugin
      // serves (hosts/switchboard/host.js). The drive must be the
      // switchboard's — the studio reaches its runtime through the drive's
      // switchboard — so its URL is the switchboard's output: the running
      // switchboard's record standalone (start it first), the switchboard
      // member's live outputs inside cli/desktop/vetra.
      {
        module: "@powerhousedao/connect/plugins/workflows",
        config: { drive: switchboard.drives.workflows.url },
      },
    ],
  },

  // handed to the runtime whole: the connect.* block, projected unchanged.
  // Branding (connect.branding: appName, icon, loader, homeBackground, icons)
  // is part of it; the Connect build resolves the image paths.
  config: config.connect ?? {},

  profile: {
    appId: "inc.powerhouse.connect.sektar",
    name: "sektar",
  },

  // Standalone Connect runs its OWN reactor (reactorClient derived from the
  // backends below — a lone `worker` backend → the worker reactor, PGlite in
  // a SharedWorker). The default drive lives in the tab's reactor. The
  // cli/desktop compounds re-point this same drive at the switchboard instead
  // — see those hosts. `protocol` is single-sourced from the connect.reactor
  // block both this host and the switchboard read, so they cannot diverge.
  reactor: {
    protocol: config.connect?.reactor ?? {},
    backends: {
      // in-process, not worker: the built Connect's worker reactor cannot
      // import the local package, so the models registered by main.tsx would
      // be missing in production (desktop/serve) — in-page they are shared.
      main: { kind: "in-process" },
    },
    // The drives the switchboard declares (Sektar, Mail, Backfills; read,
    // not copied): standalone Connect keeps a local copy of each, the
    // compounds (vetra, cli, desktop) replace them with the switchboard's.
    // The Workflows drive is not declared here: the workflows plugin above
    // attaches it (runner.plugins).
    drives: switchboardHost.reactor.drives,
  },
};
