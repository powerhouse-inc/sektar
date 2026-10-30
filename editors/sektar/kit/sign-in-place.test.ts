import { afterEach, describe, expect, it, vi } from "vitest";
import {
  explainSignInFailure,
  signInPlace,
  speaksOfEnvironment,
} from "./sign-in-place.js";
import { signInMode } from "./workflow-runtime.js";

describe("signInPlace", () => {
  it("is the local flow on a loopback page, whatever the switchboard says", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(signInPlace(host, null)).toBe("local");
      expect(signInPlace(host, "RELAY")).toBe("local");
      expect(signInPlace(host, "NONE")).toBe("local");
    }
  });

  it("is the cloud flow where the sign-in finishes in this environment", () => {
    expect(signInPlace("acme.vetra.io", "RELAY")).toBe("cloud");
    expect(signInPlace("sektar.example.com", "WEB")).toBe("cloud");
  });

  it("hands the sign-in over otherwise, and while nobody has answered", () => {
    expect(signInPlace("acme.vetra.io", "DESKTOP")).toBe("handoff");
    expect(signInPlace("acme.vetra.io", "NONE")).toBe("handoff");
    expect(signInPlace("acme.vetra.io", "UNKNOWN")).toBe("handoff");
    expect(signInPlace("my-pc.tail1234.ts.net", null)).toBe("handoff");
  });
});

describe("speaksOfEnvironment", () => {
  it("speaks of the environment in the cloud flow, never in the local one", () => {
    expect(speaksOfEnvironment("cloud", "pc", "acme.vetra.io")).toBe(true);
    expect(speaksOfEnvironment("local", "localhost", "localhost")).toBe(false);
  });

  it("speaks of the environment when the runner is the page's own host", () => {
    expect(
      speaksOfEnvironment("handoff", "acme.vetra.io", "acme.vetra.io"),
    ).toBe(true);
    expect(speaksOfEnvironment("handoff", "wouters-pc", "acme.vetra.io")).toBe(
      false,
    );
    expect(speaksOfEnvironment("handoff", null, "acme.vetra.io")).toBe(false);
  });
});

describe("signInMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const answer = (body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(body)))),
    );

  it("is the switchboard's answer", async () => {
    answer({ data: { workflowRuntime: { oauthSignIn: "RELAY" } } });
    await expect(signInMode("http://x/graphql/workflow-runtime", "a")).resolves.toBe("RELAY");
  });

  it("is UNKNOWN on a framework without the query, or any failure", async () => {
    answer({
      errors: [{ message: 'Cannot query field "oauthSignIn" on type "WorkflowRuntime".' }],
    });
    await expect(signInMode("http://x", "a")).resolves.toBe("UNKNOWN");
    answer({ data: { workflowRuntime: { oauthSignIn: "SOMETHING_NEW" } } });
    await expect(signInMode("http://x", "a")).resolves.toBe("UNKNOWN");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(signInMode("http://x", "a")).resolves.toBe("UNKNOWN");
  });
});

describe("explainSignInFailure", () => {
  it("says nobody set up Google sign-in where the switchboard has no client", () => {
    const raw =
      'OAuth app "sektar-google" has no web client on this host; mount its client file';
    expect(explainSignInFailure(new Error(raw))).toEqual({
      text: "This Sektar can't sign in to Google yet: ask whoever runs it to set up Google sign-in.",
      detail: raw,
    });
    expect(
      explainSignInFailure(new Error('OAuth app "x" has no desktop client')).text,
    ).toContain("can't sign in to Google yet");
  });

  it("says the server is out of reach when the request never got there", () => {
    expect(explainSignInFailure(new TypeError("Failed to fetch"))).toEqual({
      text: "Couldn't reach Sektar's server. Try again.",
      detail: null,
    });
    expect(
      explainSignInFailure(new TypeError("NetworkError when attempting to fetch resource.")).text,
    ).toBe("Couldn't reach Sektar's server. Try again.");
  });

  it("leaves anything else as the switchboard said it", () => {
    expect(explainSignInFailure(new Error("Forbidden"))).toEqual({
      text: "Forbidden",
      detail: null,
    });
  });
});
