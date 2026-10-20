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
a compound. `ph generate hosts` regenerates each producer's `outputs.js` and
`types.d.ts`; every host carries `/** @satisfies {PHHost} */`, and
`npm run tsc` type-checks them (`tsc -p hosts`).

Scaffolded hosts: `connect` (studio dev server), `switchboard` (API/reactor
server), `vetra` (compound: both, dev mode — what `ph vetra` runs),
`desktop` (production switchboard + built Connect on the generic compound),
`assistant` (headless agent API on the project switchboard) and `cli`
(switchboard + Connect together, Connect as a remote client).

### Reactor-client topologies (what runs the reactor, and where)

The `reactor.backends` of a Connect host select which of four clients it
runs — one field, derived from the backend topology:

| host                       | backends                         | reactorClient | reactor + storage                                                               |
| -------------------------- | -------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `connect` (standalone)     | one `in-process`                 | `in-process`  | the tab's own reactor on the main thread (PGlite in-page)                       |
| `cli` → connect member     | one `remote`                     | `remote`      | NO local reactor — a pure client to the switchboard over GraphQL (no PGlite)    |
| `desktop` → connect member | one `in-process` + remote drives | `in-process`  | the tab's reactor PLUS SYNCHRONIZED remote drives (local replica, keeps PGlite) |

The lesson the `cli` vs `desktop` split teaches: a **remote client** proxies
to the switchboard and stores nothing locally (no PGlite); a **synchronized
remote drive** keeps a local replica and therefore needs PGlite by design.
The `worker` mode (reactor in a SharedWorker) is the fourth option; Sektar's
connect host uses `in-process` because the built Connect's worker cannot
import the local package.

The project drive (`sektar`) is OWNED by the switchboard; standalone Connect
has its own local copy (the same declaration, read from the switchboard
host); the `cli`/`desktop` compounds re-point Connect at the switchboard's.
