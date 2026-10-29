import { describe, expect, it } from "vitest";
import { bindsTo, findDrive, pinnedDriveId, resolveDriveId, supersededDrive } from "./index.js";

const FILES = pinnedDriveId("files")!;
const drive = (id: string, slug: string, preferredEditor?: string) => ({
  header: { id, slug, meta: preferredEditor ? { preferredEditor } : {} },
});
const reader = (ids: string[], slugs: Record<string, string> = {}) => ({
  get: (key: string) =>
    ids.includes(key)
      ? Promise.resolve({ header: { id: key } })
      : key in slugs
        ? Promise.resolve({ header: { id: slugs[key] } })
        : Promise.reject(new Error("not found")),
});

describe("drive pins", () => {
  it("finds the converted drive before the one under the slug", () => {
    const legacy = drive("files-legacy", "files", "files");
    const converted = drive(FILES, FILES, "files");
    expect(findDrive([legacy, converted], "files")).toBe(converted);
    expect(findDrive([legacy], "files")).toBe(legacy);
    expect(findDrive([drive("x", "unpinned")], "unpinned")?.header.id).toBe("x");
  });

  it("leaves a legacy drive out of lists once its converted drive is there", () => {
    const legacy = drive("files-legacy", "files");
    const converted = drive(FILES, FILES);
    expect(supersededDrive([legacy, converted], legacy)).toBe(true);
    expect(supersededDrive([legacy, converted], converted)).toBe(false);
    expect(supersededDrive([legacy], legacy)).toBe(false);
  });

  it("resolves a slug to the converted drive where the store has it", async () => {
    expect(await resolveDriveId(reader([FILES]), "files")).toBe(FILES);
    expect(await resolveDriveId(reader([], { files: "legacy" }), "files")).toBe("legacy");
    expect(await resolveDriveId(reader([]), "files")).toBeNull();
  });

  it("binds a writing processor to one drive per store", async () => {
    const legacy = { id: "files-legacy", slug: "files", meta: { preferredEditor: "files" } };
    const converted = { id: FILES, slug: FILES, meta: {} };
    const both = reader([FILES, "files-legacy"]);
    expect(await bindsTo(both, converted, "files", "files")).toBe(true);
    expect(await bindsTo(both, legacy, "files", "files")).toBe(false);
    // a store without the converted drive keeps the drive under the slug
    expect(await bindsTo(reader(["files-legacy"]), legacy, "files", "files")).toBe(true);
    expect(await bindsTo(both, { id: "other", slug: "other", meta: {} }, "files", "files")).toBe(false);
  });
});

describe("the vetra host's pins", () => {
  it("are the ids the code looks drives up by", async () => {
    const pins = (await import("./drive-ids.json", { with: { type: "json" } })).default;
    // a host file has no declarations: read it as data
    const hostFile = "../../hosts/vetra/host.js";
    const vetra = ((await import(hostFile)) as { default: unknown }).default as {
      children: { "vetra-switchboard": { reactor: { drives: { slug: string; id?: string }[] } } };
    };
    const served = vetra.children["vetra-switchboard"].reactor.drives;
    for (const [slug, id] of Object.entries(pins)) {
      expect(served.find((d) => d.slug === slug)?.id, slug).toBe(id);
    }
  });
});
