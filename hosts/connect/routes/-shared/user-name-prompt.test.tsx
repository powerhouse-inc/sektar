import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserNamePrompt } from "./user-name-prompt.js";

const app = vi.hoisted(() => ({
  drives: [] as unknown[] | undefined,
  isResolving: false,
  selected: undefined as string | undefined,
  remotes: [] as { meta: object }[],
  states: new Map<string, object>(),
}));

vi.mock("@powerhousedao/reactor-browser", () => ({
  useConnectionStates: () => app.states,
  useDrives: () => app.drives,
  useRenownAuthAsync: () => ({ isResolving: app.isResolving }),
  useSelectedDriveId: () => app.selected,
  useSync: () => ({ list: () => app.remotes }),
}));

const REFUSED = { state: "error", requiresAuth: true };

function refuse(driveId: string) {
  app.remotes = [{ meta: { name: "remote", collectionId: { driveId } } }];
  app.states = new Map([["remote", REFUSED]]);
}

const render = () => renderToStaticMarkup(<UserNamePrompt />);

beforeEach(() => {
  app.drives = [];
  app.isResolving = false;
  app.selected = undefined;
  app.remotes = [];
  app.states = new Map();
  vi.stubGlobal("localStorage", { getItem: () => null });
});
afterEach(() => vi.unstubAllGlobals());

describe("the name prompt", () => {
  it("welcomes a user without a name once the app has loaded", () => {
    expect(render()).toContain("Welcome to Sektar");
  });

  it("does not ask a user who has a name", () => {
    vi.stubGlobal("localStorage", { getItem: () => "Marit" });
    expect(render()).toBe("");
  });

  it("waits for the drives", () => {
    app.drives = undefined;
    expect(render()).toBe("");
  });

  it("waits until it is known who is signed in", () => {
    app.isResolving = true;
    expect(render()).toBe("");
  });

  it("stays off the sign-in gate of a drive that refused the user", () => {
    app.selected = "drive-1";
    refuse("drive-1");
    expect(render()).toBe("");
  });

  it("is not held back by a drive the user did not open", () => {
    app.selected = "drive-1";
    refuse("drive-2");
    expect(render()).toContain("Welcome to Sektar");
  });
});
