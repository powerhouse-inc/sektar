import { describe, expect, it } from "vitest";
import { isPrivateAddress, onScreenOf } from "./on-screen.js";

const UA = "Mozilla/5.0 (Windows NT 10.0) Chrome/130";

describe("who is on screen", () => {
  it("takes the first forwarded address and the browser", () => {
    expect(onScreenOf({ "x-forwarded-for": "81.82.83.84, 10.0.0.2", "user-agent": UA })).toEqual({
      ipAddress: "81.82.83.84",
      userAgent: UA,
    });
  });

  it("names nobody without a public address or a browser", () => {
    expect(onScreenOf({ "user-agent": UA })).toBeNull();
    expect(onScreenOf({ "x-forwarded-for": "192.168.0.89", "user-agent": UA })).toBeNull();
    expect(onScreenOf({ "x-forwarded-for": "81.82.83.84" })).toBeNull();
  });

  it("knows the private ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.2"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["81.82.83.84", "172.32.0.1", "100.128.0.1", "2a02:1810::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
