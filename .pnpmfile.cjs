// Local monorepo linking.
//
// package.json and pnpm-workspace.yaml link the @powerhousedao packages and
// document-model from a sibling checkout of the monorepo:
// `link:../powerhouse/<pkg-path>`. That is what the committed lockfile
// records, so a default `pnpm install` needs the monorepo at ../powerhouse.
//
// To link a monorepo that lives elsewhere (another checkout, a worktree),
// set POWERHOUSE_DIR — absolute, or relative to this project's root:
//
//   POWERHOUSE_DIR=~/src/powerhouse pnpm install --no-frozen-lockfile
//
// Every `link:../powerhouse/` spec is then rewritten to `link:<POWERHOUSE_DIR>/`
// — in package manifests (readPackage) and in the workspace overrides
// (updateConfig; overrides apply after readPackage, so the manifest hook alone
// would not reach transitive consumers). Such an install rewrites
// pnpm-lock.yaml with the machine's paths: never commit it
// (`git restore pnpm-lock.yaml`). With POWERHOUSE_DIR unset this file changes
// nothing.
//
// pnpm records this file's checksum in pnpm-lock.yaml: after editing it, run a
// default `pnpm install` (POWERHOUSE_DIR unset) and commit both together.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PREFIX = "link:../powerhouse/";

function resolveTarget() {
  const raw = process.env.POWERHOUSE_DIR;
  if (!raw) return null;
  const expanded = raw.startsWith("~/")
    ? path.join(require("node:os").homedir(), raw.slice(2))
    : raw;
  const abs = path.resolve(__dirname, expanded);
  if (!fs.existsSync(abs)) {
    console.warn(
      `.pnpmfile.cjs: POWERHOUSE_DIR=${raw} (${abs}) does not exist`,
    );
  }
  // Forward slashes: a `link:C:\…` spec is not a valid pnpm path on Windows.
  return abs.split(path.sep).join("/").replace(/\/+$/, "");
}

const target = resolveTarget();

function rewriteSpec(spec) {
  if (typeof spec !== "string" || !spec.startsWith(PREFIX)) return spec;
  return `link:${target}/${spec.slice(PREFIX.length)}`;
}

function rewriteMap(map) {
  if (!map || typeof map !== "object") return;
  for (const name of Object.keys(map)) map[name] = rewriteSpec(map[name]);
}

function readPackage(pkg) {
  if (!target) return pkg;
  rewriteMap(pkg.dependencies);
  rewriteMap(pkg.devDependencies);
  rewriteMap(pkg.optionalDependencies);
  rewriteMap(pkg.overrides);
  if (pkg.pnpm) rewriteMap(pkg.pnpm.overrides);
  return pkg;
}

function updateConfig(config) {
  if (!target) return config;
  rewriteMap(config.overrides);
  return config;
}

module.exports = { hooks: { readPackage, updateConfig } };
