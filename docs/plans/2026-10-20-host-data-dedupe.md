# Removing data duplicated between the hosts and the rest of Sektar

Constraint: a host file may import only `powerhouse.config.json`, a sibling `host.js` or a sibling `outputs.js` (host-core `host-loader.ts`), so a host cannot import TS constants. Connect's served config is strict, so it has no slot for app-specific data. Data therefore flows from the host to the UI, or the UI stops needing it.

## 1. Assistant instructions are wrong, not just duplicated (do first)
- `hosts/assistant/host.js` instructions name the tools `listDrives`/`listDocuments`/`getDocument`. clint's `createMastraProvider` registers no tools at all, and the switchboard MCP tools are actually `getDrives`/`getDocuments`/`getDocument`.
- The prompt also hardcodes "Sektar drive", the `sektar/*` document types and the page names. The persona is duplicated in `agents/agent-profiles/AgentBase.md`.
- Sektar fix:
  - drop the tool names from the prompt;
  - build the drive name and slug from `import switchboard from "../switchboard/host.js"`;
  - keep one copy of the persona;
  - add a drift test: the `sektar/*` ids in the prompt match `powerhouse.manifest.json`, and no tool names appear.
- Upstream (clint, medium):
  - register the reactor read tools on the Mastra agent;
  - pass `prompts.context` through to `buildSkills`;
  - allow `instructions: { profile }` loaded from the compiled prompts, so `AgentBase.md` becomes the only prompt.

## 2. UI constants
- **Where:** `hosts/connect/routes/-shared/products.ts` (slugs `workflows`/`sektar`, editor ids, the slug regex in `productFor`), `editors/sektar/kit/data.ts` (`SEKTAR_DRIVE_SLUG`) and `routes/_app/productivity.tsx` (assumes "arrives as a remote", matches the placeholder by slug).
- **Fix:**
  - The UI finds each product's drive by `header.meta.preferredEditor === <editor id>`, using `Sektar.config.id` and the workflow-studio editor id. The URL param and the placeholder id come from the found drive's own `slug`/`id`.
  - `productFor` takes `drives`; until drives load it falls back to the remembered or default product.
  - Keep a slug fallback for one release, for stores created before drives carried a preferredEditor.
- **Upstream (small):** export `WORKFLOW_STUDIO_EDITOR_ID` (and the default workflows drive) from `@powerhousedao/connect/plugin-configs`. Until then, keep the literal with a pointer comment.
- **Tests:**
  - loading `hosts/switchboard/host.js` shows its drive's `preferredEditor === Sektar.config.id`;
  - unit tests for `driveFor`/`productFor`.
- **Naming decision needed:** the drive is called "Sektar" in the host but "Business drive" in the UI and partly in the prompt. Pick one, put it in the host `name`, and have the UI show `drive.header.name`.

## 3. Desktop identity
- **Facts:**
  - `profile` in `hosts/desktop/host.js` (and in `connect/host.js`) is validated but never read.
  - Tauri reads the generated `tauri-shell/tauri.conf.json`, which is projected from `app.json`.
  - The generated shell files are tracked in git, even though the generated `.gitignore` says otherwise.
  - Further repeats:
    - `window.title` repeats `productName`;
    - the icon path is written from a different base;
    - the loading background repeats the PWA background colour.
- **Single source:** the host `profile` (appId, name, icon), with `name` defaulting from `connect.branding.appName`. `app.json` keeps only shell look and feel.
- **Sektar interim:**
  - set `profile.name` from branding;
  - drop `window.title`;
  - `git rm --cached` the generated shell files;
  - add a drift test that `app.json` identifier/productName equal `profile`.
- **Upstream (desktop runner, medium):**
  - merge `host.profile` over `app.json` before `projectShell`;
  - make identifier/productName optional before the merge and required after;
  - rebase the profile icon path;
  - stop `ph generate desktop-shell` writing identity fields;
  - fix the generated `.gitignore`.
- **Risk:** changing the identifier changes the OS app identity and data directory, so the merge must reproduce today's values exactly.

## Lower priority
- Identical drive `$map` blocks in `cli/host.js` and `desktop/host.js`.
- A redundant port restatement in `desktop/host.js`.
- `startOrder` in the desktop host, which tokens now derive. Check `desktop build` before removing it.
- `DOC_TYPES` in `data.ts` should import the generated `*DocumentType` constants.
- Literal drive names in the README and `setup.tsx`.

## Order
1. Assistant prompt fix and drift test (Sektar only).
2. The UI matches drives by preferredEditor; switchboard and manifest drift tests.
3. Desktop interim (Sektar only).
4. Upstream: browser-safe `WORKFLOW_STUDIO_EDITOR_ID`, then drop the literal.
5. Upstream: desktop runner profile merge and `.gitignore`, then strip identity from Sektar's `app.json`.
6. Upstream: clint tools, `prompts.context` and profile-as-instructions, then collapse the prompt into `AgentBase.md`.
7. The lower-priority items, and the drive-name decision.
