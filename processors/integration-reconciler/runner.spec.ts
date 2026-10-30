import { describe, expect, it } from "vitest";
import { isLoopbackHostname, publicHost, runnerIdentity } from "./runner.js";

describe("runnerIdentity", () => {
  it("is the machine without a PUBLIC_URL, as before", () => {
    expect(runnerIdentity(undefined, "wouters-pc")).toEqual({
      me: { reactorId: "switchboard@wouters-pc", label: "wouters-pc" },
      environment: false,
    });
    expect(runnerIdentity("", "wouters-pc").me.reactorId).toBe(
      "switchboard@wouters-pc",
    );
  });

  it("is the machine when PUBLIC_URL is loopback or malformed", () => {
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1:4001",
      "http://[::1]:3000",
      "http://sektar.localhost",
      "not a url",
    ]) {
      expect(runnerIdentity(url, "pc")).toEqual({
        me: { reactorId: "switchboard@pc", label: "pc" },
        environment: false,
      });
    }
  });

  it("is the public host in an environment, whatever the pod is called", () => {
    expect(
      runnerIdentity("https://acme-sektar.vetra.io", "cli-7f9c-x2k"),
    ).toEqual({
      me: {
        reactorId: "switchboard@acme-sektar.vetra.io",
        label: "acme-sektar.vetra.io",
      },
      environment: true,
    });
    // A port or a path does not change who it is
    expect(
      runnerIdentity("https://sektar.example.com:8443/app/", "pod").me,
    ).toEqual({
      reactorId: "switchboard@sektar.example.com",
      label: "sektar.example.com",
    });
  });
});

describe("publicHost", () => {
  it("drops loopback hosts", () => {
    expect(publicHost("http://127.0.0.2")).toBeNull();
    expect(publicHost("https://x.vetra.io")).toBe("x.vetra.io");
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("example.com")).toBe(false);
  });
});
