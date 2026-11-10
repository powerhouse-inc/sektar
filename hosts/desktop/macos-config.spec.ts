// hosts/desktop/tauri-shell/tauri.macos.conf.json is the one piece of the
// generated shell that's ours: Tauri merges it over tauri.conf.json on macOS
// only, and the desktop runner never writes it. A JSON merge patch replaces
// arrays whole, so its window repeats the generated one; these checks keep
// the copy from drifting when app.json or the runner changes the original.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shell = join(import.meta.dirname, "tauri-shell");
type Window = Record<string, unknown>;
type Conf = { app: { windows: Window[] }; bundle?: { macOS?: Record<string, unknown> } };
const read = (file: string): Conf => JSON.parse(readFileSync(join(shell, file), "utf8")) as Conf;
const generated = read("tauri.conf.json");
const macos = read("tauri.macos.conf.json");

/** The window settings macOS deliberately changes. */
const MAC_ONLY = ["width", "height", "center"];
const without = (w: Window, keys: string[]) => Object.fromEntries(Object.entries(w).filter(([k]) => !keys.includes(k)));

describe("the macOS shell config", () => {
  it("repeats the generated window, changing only its size and placement", () => {
    expect(macos.app.windows).toHaveLength(generated.app.windows.length);
    expect(without(macos.app.windows[0], MAC_ONLY)).toEqual(without(generated.app.windows[0], MAC_ONLY));
  });

  it("opens centred, within a 13-inch MacBook's 1440×900 screen, and no smaller than the minimum", () => {
    const w = macos.app.windows[0];
    expect(w.center).toBe(true);
    expect(w.width).toBeLessThanOrEqual(1440);
    expect(w.height).toBeLessThanOrEqual(900);
    expect(w.width).toBeGreaterThanOrEqual(w.minWidth as number);
    expect(w.height).toBeGreaterThanOrEqual(w.minHeight as number);
  });

  it("asks for the macOS the bundled Node needs (Node 24: 13.5)", () => {
    expect(macos.bundle?.macOS?.minimumSystemVersion).toBe("13.5");
    // Only the version is ours: signing stays as the runner generates it.
    expect(Object.keys(macos.bundle?.macOS ?? {})).toEqual(["minimumSystemVersion"]);
  });
});
