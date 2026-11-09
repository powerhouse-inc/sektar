import { describe, expect, it } from "vitest";
import { folderPathExample } from "./folder-sync.js";

describe("the folder field's example paths", () => {
  it("show Mac paths in the Desktop App on a Mac, where the Switchboard is this Mac", () => {
    const mac = folderPathExample(true, "MacIntel");
    expect(mac.placeholder).toBe("/Users/me/Dropbox/KSDC/kwartaalaangiftes/2026-Q3");
    expect(mac.example).toBe("/Users/me/Dropbox/KSDC/2026-Q3");
  });

  it("stay as they were anywhere else", () => {
    const before = {
      placeholder: String.raw`D:\Dropbox\KSDC\kwartaalaangiftes\2026-Q3`,
      example: String.raw`D:\Dropbox\KSDC\2026-Q3 or /home/me/ksdc`,
    };
    // a browser on a Mac may be using a Switchboard elsewhere
    expect(folderPathExample(false, "MacIntel")).toEqual(before);
    expect(folderPathExample(true, "Win32")).toEqual(before);
    expect(folderPathExample(true, "Linux x86_64")).toEqual(before);
  });
});
