# hosts/

Each subfolder defines one host: an application this project can run via
`ph run <host-name> [verb]`. A host.js is a static projection of
powerhouse.config.json — plain data, default-exported:

```js
export default {
  name, // display identity (never seeds storage identity — renaming is safe)
  runner, // { module, ...process options } — ph run imports and calls runner.module
  config, // handed to the runner's runtime whole
  reactor, // reactor runners only (projection arrives in a later phase)
  children, // compound runners only — reactor XOR children
};
```

Rules: a host.js may import the project's powerhouse.config.json and its
sibling hosts' `../<host>/host.js` and generated `../<host>/outputs.js`,
nothing else; `process.` is banned (read the environment with
`{ $env: "NAME" }`); the export must survive a JSON round trip (no
functions); `ph <host-name>` is sugar for `ph run <host-name>` (built-in
commands win name collisions).

Another host's outputs (URLs, drive ids, …) are read with output tokens:
`switchboard.drives.workflows.url` from `../switchboard/outputs.js`, or
literally `{ $output: { host: "switchboard", path: ["drives", "workflows", "url"] } }`.
They resolve when the host starts — from the producer's live run record when
run alone (`ph run switchboard` first), from the member's live outputs inside
a compound. `{ $map: { over, to } }` renders a list from a collection output:
the `cli` and `desktop` Connect members attach one remote drive per drive the
switchboard serves (`slug: { $key: true }`, `url: switchboard.drives.$item.url`).
`ph generate hosts` regenerates each producer's `outputs.js` and
`types.d.ts`; every host carries `/** @satisfies {PHHost} */`, and
`npm run tsc` type-checks them (`tsc -p hosts`).

Scaffolded hosts: `connect` (studio dev server), `switchboard` (API/reactor
server), `vetra` (compound: both, dev mode — what `ph vetra` runs),
`desktop` (production switchboard + built Connect on the generic compound),
`assistant` (headless agent API on the project switchboard) and `cli`
(switchboard + Connect together, Connect as a remote client).
The runners come from the linked monorepo checkout (`../powerhouse`, or
`$POWERHOUSE_DIR`), built — see README.md, "Local monorepo link".

### Sign-in on the `desktop` host

`desktop` signs in before anything runs. `hosts/desktop/app.json` has
`signIn: true`, so the shell opens a page of its own and holds the stack back
until someone has picked an identity, with Renown or with a local key. What the
user sees is documented on the website, in `docs/where-sektar-runs.mdx`, which
is the spec for all of this.

The data folder the user chose holds `settings.json`, `local.key` and one folder
per identity:

```
<root>/
  settings.json          read before anything starts, never holds a secret
  local.key              the local identity's key, in a password-encrypted keystore
  local/                 the local identity, whichever key it has
  0x…/                   one per Renown identity
    .ph/                 the stack's storage: ${userData}/.ph
    backups/
    profile-cached.json  public information only
    profile-cached.<ext> the avatar
```

The shell points `${userData}` at the identity's folder and sets `ADMINS` to its
address, so the identity decides both whose storage this is and who runs it.
The switchboard's auth comes through `config.switchboard` on its server member
rather than env, since nobody edits an env file on a person's own computer
(`docs/adr/0008-delegated-signers.md` in the monorepo):

- The server binds `127.0.0.1`.
- Verified credentials stay in `${userData}/.ph/.credentials.json`, so once
  signed in it works with Renown unreachable. A revocation lands the next time
  it is online.
- A local identity runs with `RENOWN_SOURCE=kept`: its credential is at no
  Renown, so only what is kept there counts, and Renown is never asked.
- `ownerClaim` stays on for a host run without the shell, where nothing sets
  `ADMINS`. Set, `ADMINS` wins over it.

The page is served from Connect's address, since the browser keeps a Renown
session per origin, which is why this host turns Connect's service worker off.
Connect is a remote client here, as on `cli`, so the window holds nothing of a
person's and it can be handed to the next identity. Signing in needs
`window.phDesktop.openExternal` from the shell; without it Connect keeps
Renown's redirect.

Quitting and changing identity stop the stack rather than kill it, so its stores
close and the next start has nothing to recover. Windows has no SIGTERM, so the
shell sets `PH_STOP_ON_STDIN=1` and writes a line to the stack's stdin, then ends
the stack's job if it hasn't gone after 10 seconds. Stdin closing does the same,
which is what happens if the shell crashes.

### Reactor-client topologies (what runs the reactor, and where)

The `reactor.backends` of a Connect host select which of four clients it
runs — one field, derived from the backend topology:

| host                       | backends         | reactorClient | reactor + storage                                                            |
| -------------------------- | ---------------- | ------------- | ---------------------------------------------------------------------------- |
| `connect` (standalone)     | one `in-process` | `in-process`  | the tab's own reactor on the main thread (PGlite in-page)                    |
| `cli` → connect member     | one `remote`     | `remote`      | NO local reactor — a pure client to the switchboard over GraphQL (no PGlite) |
| `desktop` → connect member | one `remote`     | `remote`      | as `cli`: the window outlives any one identity, so it must hold nothing      |

A **remote client** proxies to the switchboard and stores nothing locally (no
PGlite); a **synchronized remote drive** would keep a local replica and
therefore need PGlite by design. The `worker` mode (reactor in a SharedWorker)
is the fourth option; Sektar's connect host uses `in-process` because the built
Connect's worker cannot import the local package.

The project drive (`sektar`) is OWNED by the switchboard; standalone Connect
has its own local copy (the same declaration, read from the switchboard
host); the `cli`/`desktop` compounds re-point Connect at the switchboard's —
every drive it serves, the plugin-created Workflows drive included. `vetra`'s
switchboard member serves the same drives plus the studio ones.

### Building Sektar.app

Native workflow runs own conversion scheduling, step recovery and history. Sektar
keeps one app-wide conversion configuration, a managed workflow binding and
immutable batch-request metadata;
it has no conversion job queue, discovery inbox or staging directory. Existing
legacy job tables are left untouched for diagnosis and are no longer executed.
Automatic intake uses one native document-event trigger for Files and Mail,
including drives and accounts added after setup. Its queue is local
to one process, defaults to 100 entries and records overflow as cancelled.
Active work interrupted by a host restart fails and requires a native rerun.

Conversion results use the existing File renditions and Email attachments:
one Markdown ref and one source-bound JSON manifest per workflow generation.
Both are direct attachment references on the source document, so access and
replication use its normal rules. The File and Email models are unchanged.
Selection compares the manifest's source ref with the current PDF and prefers
a complete result. Publication checks before writing but has no atomic source
or Off condition. Folder-sync excludes generated rows for now; its usual
role-based output names would collide across generations.

Build the app with the standard `ph run desktop build` command. The PDF
conversion release is blocked on upstream support for desktop runtime
dependency retention, Switchboard background inference, workflow connection
access enforcement and Docture page-local layout validation. Local dependency
patches and the wrapper that repackaged them have been removed.

A conversion runs as a workflow run, in the workflow runtime's own piece
workers. Sektar builds and ships no conversion worker: `ph-cli build` is the
whole package build, the `switchboard` and `cli` hosts name the stock runners,
and nothing is written to `dist/node/conversion-worker`. How many run at once
and how much memory a worker gets are the runtime's own `PH_WORKFLOWS_*`
settings; Sektar has none for them.

The runtime hands a piece a file of at most 8 MiB by default.
`PH_WORKFLOWS_PIECE_MAX_FILE_BYTES`, set on the host process, raises it.
Capabilities report this runtime cap separately from the configured app-wide
limits. The UI and admission use the lower of the cap and the global limit;
saving settings preserves the configured global limit. Oversized files are left out of
batch previews.

The Docture piece is built to `dist/node/pieces/docture`. The managed
`Sektar PDF` extraction action uses the same converter, checking current global
limits inside the action so retries cannot replay an obsolete limit. Sektar
reconciles its managed workflow definition on host startup. The builder keeps a
package outside the bundle when the piece's own code imports it and it needs a
native addon or WebAssembly (`pdfjs-dist`, `@napi-rs/canvas`), and lists it in
the piece's `package.json`. Docture's PDF.js, Tesseract and PaddleOCR loaders,
Tesseract, and PaddleOCR with ONNX Runtime are found by
name at run time, so they must be installed where the piece can resolve them:
beside the package, as its `dependencies` are. The canvas rasterizer is also
loaded from the installed Docture package, so builds do not copy the build
machine's native binary into the piece. Scanner weights are downloaded only after
**Download and save** in Settings; converting a PDF never downloads and uses only
the scanner Settings has prepared. The host
streams pinned files, verifies exact bytes and SHA-256, and atomically caches them
in `~/.cache/sektar/ocr-models/v1`, derived from the OS user's home in both host
and workflow workers. OCR only reads verified local files and never downloads.
The host continues setup after navigation; a restart interrupts setup and requires
an explicit retry, reusing verified files. Existing settings stay active until setup
and the final revision check succeed. MuPDF
is not used: its AGPL license does not suit Sektar.
`hosts/packaging.test.ts` checks a fresh build and its resolved dependencies.

Digital extraction and OCR can run in the Node host with published dependencies.
Docture is pinned to 0.3.1. That release improves OCR geometry and table
reconstruction, but still lacks a public page-local layout validator. The
layout recovery reproduction still discards valid pages when one page's
annotations are invalid, so that release gate remains open.
Integrated AI and AI layout report unavailable when their upstream capabilities
are missing. Conversion integration tests and the packaged smoke check remain
acceptance gates; they must pass against supported upstream releases before
this feature ships. Earlier results obtained with patched packages do not
clear that gate. The chat assistant's conversion tools are deferred separately.

#### Building against a local monorepo checkout

`ph run desktop build` vendors ph-run and its runtime into the app's stack
from the npm registry. ph-run is `ph run` without the tools that build, and
the host files keep naming ph-cli's runners: where ph-cli isn't installed, they
resolve to ph-run's. Until the code these hosts need is released, vendor it
from a monorepo checkout instead: pack it, then point the build at the
tarballs with `PH_DESKTOP_LOCAL_PACKAGES` (an env var, so no machine path
lands in a host file; a relative path resolves against this project).

For conversion, local upstream builds must supply the missing capabilities
above through their supported APIs. A local tarball is useful for validating
an upstream fix, but release acceptance requires published versions and a
fresh install without dependency patches.

```sh
# from this project's root; MONOREPO is the linked checkout (README.md,
# "Local monorepo link"), its dists built
MONOREPO="${POWERHOUSE_DIR:-../powerhouse}"
# 1. pack ph-run, host-core and every workspace package they depend on
rm -rf .ph/local-packages
pnpm -C "$MONOREPO" pack:desktop-stack --pack-destination "$PWD/.ph/local-packages"
# 2. build members, stage the stack, produce Sektar.app (+ .dmg) and launch it
PH_DESKTOP_LOCAL_PACKAGES=.ph/local-packages FEATURE_UNIFORM_RUNNERS_ENABLED=true \
  npx ph-cli run desktop build
open hosts/desktop/tauri-shell/target/release/bundle/macos/Sektar.app
```

On Windows the installer step can't open a path over 260 characters, and the
stack's deepest files sit about 208 characters below `dist-stack`, so a checkout
in a deep folder fails at `makensis` with `failed opening file`, after everything
else has built. Map the shell folder to a drive, replace the folder with that
drive in `target/release/nsis/x64/installer.nsi`, and run `makensis` on it there.
Nothing else needs rebuilding. The paths fit once installed.

`PH_DESKTOP_BUNDLE_BACKEND=1`, or `bundleBackend: true` on the desktop runner,
folds the vendored stack with Rolldown after staging it, for a stack of a few
thousand files that installs in a fraction of the time. It's off until an
installed build has proven it. To try a staged stack in the real app without
building an installer, run the acceptance suite with `SEKTAR_STACK` set to it.

Every tarball overrides its package throughout the stack, as the local and
registry builds share a version number. Re-pack after rebuilding the
monorepo's dists; the build refuses two tarballs of one package, so clear
the directory first. `desktop-connect` precedes `desktop-switchboard` in
`children` because `build` runs members in that order and Connect's build
clears `dist/`, the package's `dist/node` included.
