import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { ModelStore } from "./store.js";
import type { ModelAsset } from "./catalogue.js";
import type { ModelProgress } from "./contracts.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "sektar-scanner-test-"));
  const data = Buffer.from("verified scanner content\n".repeat(2000));
  let mode: "ok" | "short" | "long" | "wrong" | "gzip" = "ok";
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    const body =
      mode === "short"
        ? data.subarray(0, 100)
        : mode === "long"
          ? Buffer.concat([data, data])
          : mode === "wrong"
            ? Buffer.alloc(data.length)
            : mode === "gzip"
              ? gzipSync(data)
              : data;
    if (mode === "gzip") {
      response.setHeader("content-encoding", "gzip");
      response.setHeader("content-length", body.length);
    }
    response.write(body.subarray(0, Math.floor(body.length / 2)));
    setTimeout(
      () => response.end(body.subarray(Math.floor(body.length / 2))),
      15,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server");
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const asset: ModelAsset = {
    id: "test",
    file: "model",
    label: "Test scanner",
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    url: `http://127.0.0.1:${address.port}/model`,
  };
  return {
    store: new ModelStore(directory),
    asset,
    data,
    requests: () => requests,
    mode: (next: typeof mode) => {
      mode = next;
    },
  };
}

describe("verified scanner files", () => {
  it("streams truthful bytes, verifies, reuses files and deduplicates concurrent preparation", async () => {
    const f = await fixture();
    const progress: ModelProgress[] = [];
    expect((await f.store.inspectAssets([f.asset])).ready).toBe(false);
    await Promise.all([
      f.store.downloadMissingAssets([f.asset], (next) => progress.push(next)),
      f.store.downloadMissingAssets([f.asset], () => undefined),
    ]);
    expect(f.requests()).toBe(1);
    expect(
      progress.some(
        (entry) =>
          entry.transferredBytes > 0 && entry.transferredBytes < f.asset.bytes,
      ),
    ).toBe(true);
    expect(progress.some((entry) => entry.phase === "verifying")).toBe(true);
    expect(progress.at(-1)).toMatchObject({
      transferredBytes: f.asset.bytes,
      readyFiles: 1,
      phase: "applying",
    });
    expect(await readFile(f.store.path(f.asset))).toEqual(f.data);
    await f.store.downloadMissingAssets([f.asset], () => undefined);
    expect(f.requests()).toBe(1);
    const offline = new ModelStore(f.store.directory, () =>
      Promise.reject(new Error("Network forbidden")),
    );
    expect((await offline.inspectAssets([f.asset])).ready).toBe(true);
  });
  it.each(["short", "long", "wrong"] as const)(
    "never publishes %s content, and retries cleanly",
    async (mode) => {
      const f = await fixture();
      f.mode(mode);
      await expect(
        f.store.downloadMissingAssets([f.asset], () => undefined),
      ).rejects.toThrow();
      expect((await f.store.inspectAssets([f.asset])).ready).toBe(false);
      expect(await readdir(join(f.store.directory, f.asset.sha256))).toEqual(
        [],
      );
      f.mode("ok");
      await f.store.downloadMissingAssets([f.asset], () => undefined);
      expect((await f.store.inspectAssets([f.asset])).ready).toBe(true);
      await writeFile(f.store.path(f.asset), Buffer.alloc(f.data.length));
      expect((await f.store.inspectAssets([f.asset])).ready).toBe(false);
    },
  );
  it("verifies decoded dictionary bytes despite an encoded Content-Length", async () => {
    const f = await fixture();
    f.mode("gzip");
    await f.store.downloadMissingAssets([f.asset], () => undefined);
    expect((await f.store.inspectAssets([f.asset])).ready).toBe(true);
  });
});
