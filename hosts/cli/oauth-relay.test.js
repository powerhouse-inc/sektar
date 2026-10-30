// @ts-check
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import plugin, {
  askRelay,
  readConfigOAuthApps,
  relayDecision,
  relayFor,
  relayOAuthApps,
  withRelay,
} from "./oauth-relay.js";

const WEB = "/client_secret_sektar-web-app.json";
const APPS = [
  {
    id: "sektar-google",
    clients: { desktop: "/client_secret_sektar_desktop-app.json", web: WEB },
  },
  { id: "other", clients: { web: "/other.json" } },
];

/**
 * A relay that answers each call in turn.
 * @param {...({ status: number; body?: unknown } | Error)} answers
 */
function relay(...answers) {
  const calls = /** @type {string[]} */ ([]);
  const fetchImpl = vi.fn((/** @type {string} */ url) => {
    calls.push(url);
    const next = answers.shift() ?? new Error("no more answers");
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: () => Promise.resolve(next.body),
    });
  });
  return { fetchImpl, calls };
}

describe("relayDecision", () => {
  it("leaves a developer's machine as configured", () => {
    expect(
      relayDecision({ publicUrl: undefined, webClientPresent: false }),
    ).toEqual({ ask: false, reason: "PUBLIC_URL is not set" });
    for (const publicUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:6540",
      "http://[::1]:3000",
      "nonsense",
    ]) {
      expect(relayDecision({ publicUrl, webClientPresent: false }).ask).toBe(
        false,
      );
    }
  });

  it("lets a mounted web client win", () => {
    expect(
      relayDecision({
        publicUrl: "https://sektar.example.com",
        webClientPresent: true,
      }),
    ).toEqual({ ask: false, reason: "its own web client is mounted" });
  });

  it("asks for the public host when no web client is mounted", () => {
    expect(
      relayDecision({
        publicUrl: "https://acme.vetra.io/",
        webClientPresent: false,
      }),
    ).toEqual({ ask: true, host: "acme.vetra.io" });
  });
});

describe("relayFor and withRelay", () => {
  it("adds the relay to the publisher app only", () => {
    const r = relayFor("https://staging.sektar.io/");
    expect(r).toEqual({
      clientId:
        "1081260940232-drh7cdlpoafbjt3f4mqj4bcp349hn5nb.apps.googleusercontent.com",
      redirectUri: "https://staging.sektar.io/api/oauth/callback",
      tokenUrl: "https://staging.sektar.io/api/oauth/token",
    });
    expect(relayFor(undefined).redirectUri).toBe(
      "https://sektar.vetra.io/api/oauth/callback",
    );
    const apps = withRelay(APPS, r);
    expect(apps[0]).toEqual({ ...APPS[0], relay: r });
    expect(apps[1]).toBe(APPS[1]);
  });
});

describe("askRelay", () => {
  const fast = { timeoutMs: 50, pauseMs: 0 };

  it("takes the relay's answer", async () => {
    const yes = relay({ status: 200, body: { accepted: true } });
    await expect(
      askRelay("acme.vetra.io", { ...fast, fetchImpl: yes.fetchImpl }),
    ).resolves.toBe("accepted");
    expect(yes.calls).toEqual([
      "https://sektar.vetra.io/api/oauth/hosts/acme.vetra.io",
    ]);
    const no = relay({ status: 200, body: { accepted: false } });
    await expect(
      askRelay("x.example.com", { ...fast, fetchImpl: no.fetchImpl }),
    ).resolves.toBe("refused");
  });

  it("tries again after a failure, and gives up after the attempts", async () => {
    const flaky = relay(new Error("ECONNRESET"), { status: 502 }, {
      status: 200,
      body: { accepted: true },
    });
    await expect(
      askRelay("acme.vetra.io", { ...fast, fetchImpl: flaky.fetchImpl }),
    ).resolves.toBe("accepted");
    expect(flaky.calls).toHaveLength(3);
    const down = relay(new Error("a"), new Error("b"), new Error("c"));
    await expect(
      askRelay("acme.vetra.io", { ...fast, fetchImpl: down.fetchImpl }),
    ).resolves.toBe("unreachable");
  });

  it("does not retry a client error", async () => {
    const bad = relay({ status: 404 });
    await expect(
      askRelay("acme.vetra.io", { ...fast, fetchImpl: bad.fetchImpl }),
    ).resolves.toBe("refused");
    expect(bad.calls).toHaveLength(1);
  });
});

describe("relayOAuthApps", () => {
  const run = (
    /** @type {Record<string, string | undefined>} */ env,
    /** @type {ReturnType<typeof relay>} */ r,
    /** @type {(file: string) => boolean} */ exists = () => false,
  ) => {
    const lines = /** @type {string[]} */ ([]);
    const result = relayOAuthApps({
      env,
      apps: APPS,
      fetchImpl: r.fetchImpl,
      exists,
      log: (line) => lines.push(line),
      timeoutMs: 50,
      pauseMs: 0,
    });
    return { result, lines };
  };

  it("changes nothing and asks nobody locally", async () => {
    const r = relay();
    const { result, lines } = run({ PUBLIC_URL: "http://localhost:3000" }, r);
    await expect(result).resolves.toBeUndefined();
    expect(r.calls).toEqual([]);
    expect(lines).toEqual([
      "[sektar:oauth-relay] Google sign-in as configured: PUBLIC_URL is loopback or not a URL",
    ]);
  });

  it("changes nothing where the web client file is mounted", async () => {
    const r = relay();
    const { result } = run(
      { PUBLIC_URL: "https://sektar.example.com" },
      r,
      (file) => file === WEB,
    );
    await expect(result).resolves.toBeUndefined();
    expect(r.calls).toEqual([]);
  });

  it("adds the relay only when sektar.io accepts the host, at the base the env names", async () => {
    const r = relay({ status: 200, body: { accepted: true } });
    const { result, lines } = run(
      {
        PUBLIC_URL: "https://acme.vetra.io",
        SEKTAR_OAUTH_RELAY_BASE: "https://staging.sektar.io",
      },
      r,
    );
    const apps = await result;
    expect(r.calls).toEqual([
      "https://staging.sektar.io/api/oauth/hosts/acme.vetra.io",
    ]);
    expect(apps?.[0]?.relay?.tokenUrl).toBe(
      "https://staging.sektar.io/api/oauth/token",
    );
    expect(apps?.[1]).toEqual(APPS[1]);
    expect(lines).toEqual([
      "[sektar:oauth-relay] Google sign-in through the relay at https://staging.sektar.io for acme.vetra.io",
    ]);
  });

  it("changes nothing when sektar.io refuses or does not answer", async () => {
    const refused = run(
      { PUBLIC_URL: "https://my.example.com" },
      relay({ status: 200, body: { accepted: false } }),
    );
    await expect(refused.result).resolves.toBeUndefined();
    expect(refused.lines[0]).toContain("does not relay for my.example.com");
    const down = run(
      { PUBLIC_URL: "https://acme.vetra.io" },
      relay(new Error("a"), new Error("b"), new Error("c")),
    );
    await expect(down.result).resolves.toBeUndefined();
    expect(down.lines[0]).toContain("did not answer for acme.vetra.io");
  });
});

describe("the plugin", () => {
  it("reads the config's apps as the switchboard does, and leaves the options alone locally", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oauth-relay-"));
    const configFile = path.join(dir, "powerhouse.config.json");
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        workflows: {
          oauthApps: [
            { id: "sektar-google", clients: { web: "../web.json" } },
            { clients: {} },
          ],
        },
      }),
    );
    expect(readConfigOAuthApps(configFile)).toEqual([
      {
        id: "sektar-google",
        clients: { web: path.resolve(dir, "../web.json") },
      },
    ]);
    expect(readConfigOAuthApps(path.join(dir, "missing.json"))).toEqual([]);

    const before = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "http://localhost:3000";
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const options = { configFile, workflows: { enabled: true } };
      await expect(
        plugin.hooks.transformServerOptions(options),
      ).resolves.toBe(options);
    } finally {
      log.mockRestore();
      if (before === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = before;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
