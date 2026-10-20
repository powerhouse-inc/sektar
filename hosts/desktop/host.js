// @ts-check
// The desktop shape: a production switchboard next to the BUILT Connect,
// supervised by the desktop runner (@powerhousedao/desktop — run/serve are
// the generic compound; `dev` opens a native shell window; `build` stages
// the shippable stack). Run `ph run connect build` once, then
// `ph run desktop`. At `run`, each member uses its own default mode below;
// `ph run desktop <verb>` forwards uniformly. Members derive from the sibling
// hosts (full inclusion); the server's drive list is hoisted once and the
// connect member attaches it as REMOTES (one declaration, two projections).
import config from "../../powerhouse.config.json" with { type: "json" };
import switchboard from "../switchboard/host.js";
import connect from "../connect/host.js";

// Declared once: the server member serves these locally; the connect member
// attaches the SAME list as remote drives (a compound's Connect must not
// duplicate-declare the local drives the server owns).
const serverDrives = [
  {
    slug: "sektar",
    name: "Sektar",
    preferredEditor: "sektar",
    icon: "./icons/sektar_symbol_64x64.png",
  },
];

/** @satisfies {PHHost} */
export default {
  name: "desktop",

  runner: {
    module: "@powerhousedao/desktop/runner",
    // NATIVE WINDOW: two ways to get one (headless verbs need neither).
    //
    // 1. BUILDER-OWNED IDENTITY (recommended, no Rust): run
    //    `ph generate desktop-shell` to scaffold hosts/desktop/app.json.
    //    `ph run desktop dev` projects it into a generated Tauri shell that
    //    depends on the published ph-desktop-shell crate and opens the window
    //    around this stack; `ph run desktop build` produces installers for
    //    this OS (nsis / app+dmg / deb+appimage). Needs Rust + the Tauri CLI.
    //
    // 2. PREBUILT/HAND-MAINTAINED shell: point `shell.project` at a checkout.
    // shell: {
    //   project: "../ph-win-desktop",
    //   window: { title: "sektar", width: 1440, height: 900 },
    //   tray: true,
    //   fileAssociations: [".phd"],
    // },
  },

  profile: {
    appId: "inc.powerhouse.desktop.sektar",
    name: "Sektar",
  },

  config: {
    startOrder: ["desktop-switchboard", "desktop-connect"],
    cspRegistrySync: true, // patch the baked CSP for the runtime registry
    runtimeRecord: true, // single-instance record under .ph/run/
  },

  children: {
    "desktop-switchboard": {
      host: "switchboard",
      runner: { plugins: [...switchboard.runner.plugins] },
      reactor: {
        protocol: switchboard.reactor.protocol,
        backends: {
          main: {
            // the switchboard's own reactor; backend kind is required
            kind: "in-process",
            // Per-user data dir; ${userData} resolves at the runner (a shell
            // points it at the OS profile via PH_USER_DATA_DIR).
            storage: {
              kind: "path",
              dataDir: "${userData}/.ph/reactor-storage",
            },
            // the reactor can fetch models Connect installs at runtime
            packages: { dynamic: true },
          },
        },
        drives: serverDrives,
      },
    },
    "desktop-connect": {
      host: "connect",
      // serve the BUILT Connect; the loopback port doubles as a shell's
      // readiness probe
      runner: {
        defaultVerb: "serve",
        port: config.studio?.port ?? 3000,
        plugins: [...connect.runner.plugins],
      },
      // Attach the server's drives as remotes, each by the URL the server
      // member reports for it (its drives.<slug>.url output). (The Workflows
      // drive rides the connect host's workflows plugin, inherited above
      // through its plugins list.)
      reactor: {
        ...connect.reactor,
        drives: serverDrives.map((d) => ({
          slug: d.slug,
          remote: {
            url: { $output: { host: "switchboard", path: ["drives", d.slug, "url"] } },
          },
        })),
      },
    },
  },
};
