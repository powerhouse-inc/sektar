import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ConversionProfile, RecognitionSelection } from "../contracts.js";
import {
  profileAssets,
  recognitionAssets,
  type ModelAsset,
} from "./catalogue.js";
import type { ModelProgress, ModelReadiness } from "./contracts.js";

export const modelCacheDirectory = () =>
  join(homedir(), ".cache", "sektar", "ocr-models", "v1");
export class ModelDownloadError extends Error {
  override readonly name = "ModelDownloadError";
}
export class ModelsNotReady extends Error {
  override readonly name = "ModelsNotReady";
  constructor() {
    super(
      "The scanner in Settings isn't downloaded on this host yet. Download it in Settings → Document conversion.",
    );
  }
}

export class ModelStore {
  private readonly verified = new Map<string, string>();
  private readonly transfers = new Map<
    string,
    {
      promise: Promise<void>;
      progress: { bytes: number; verifying: boolean };
      listeners: Set<() => void>;
    }
  >();
  constructor(
    readonly directory = modelCacheDirectory(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  path(asset: ModelAsset) {
    return join(this.directory, asset.sha256, asset.file);
  }
  async isReady(asset: ModelAsset): Promise<boolean> {
    const path = this.path(asset);
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size !== asset.bytes) return false;
      const identity = `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      if (this.verified.get(path) === identity) return true;
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path)) {
        if (!Buffer.isBuffer(chunk)) return false;
        hash.update(chunk);
      }
      if (hash.digest("hex") !== asset.sha256) return false;
      this.verified.set(path, identity);
      return true;
    } catch {
      return false;
    }
  }
  async inspectAssets(assets: readonly ModelAsset[]): Promise<ModelReadiness> {
    const files = await Promise.all(
      assets.map(async (asset) => ({
        id: asset.id,
        label: asset.label,
        bytes: asset.bytes,
        ready: await this.isReady(asset),
      })),
    );
    return {
      files,
      totalBytes: files.reduce((n, file) => n + file.bytes, 0),
      missingBytes: files.reduce(
        (n, file) => n + (file.ready ? 0 : file.bytes),
        0,
      ),
      ready: files.every((file) => file.ready),
    };
  }
  inspect(profile: ConversionProfile) {
    return this.inspectAssets(profileAssets(profile));
  }
  async require(
    selection: RecognitionSelection | null,
  ): Promise<readonly ModelAsset[]> {
    const assets = recognitionAssets(selection);
    if (!(await this.inspectAssets(assets)).ready) throw new ModelsNotReady();
    return assets;
  }
  async downloadMissingAssets(
    assets: readonly ModelAsset[],
    report: (progress: ModelProgress) => void,
  ): Promise<void> {
    const initial = await this.inspectAssets(assets);
    const missing = assets.filter(
      (asset) =>
        !initial.files.some((file) => file.id === asset.id && file.ready),
    );
    let finished = 0;
    let readyFiles = assets.length - missing.length;
    const progress = (
      phase: ModelProgress["phase"],
      file: string | null,
      bytes = 0,
    ) =>
      report({
        phase,
        file,
        transferredBytes: finished + bytes,
        totalBytes: initial.missingBytes,
        readyFiles,
        totalFiles: assets.length,
      });
    progress("queued", null);
    for (const asset of missing) {
      let active = this.transfers.get(asset.sha256);
      if (!active) {
        const listeners = new Set<() => void>();
        const state = { bytes: 0, verifying: false };
        const promise = this.download(asset, (bytes, verifying) => {
          state.bytes = bytes;
          state.verifying = verifying;
          for (const listener of listeners) listener();
        });
        active = { promise, progress: state, listeners };
        this.transfers.set(asset.sha256, active);
        void promise
          .finally(() => this.transfers.delete(asset.sha256))
          .catch(() => undefined);
      }
      const transfer = active;
      const notify = () =>
        progress(
          transfer.progress.verifying ? "verifying" : "downloading",
          asset.label,
          transfer.progress.bytes,
        );
      transfer.listeners.add(notify);
      notify();
      try {
        await transfer.promise;
      } finally {
        transfer.listeners.delete(notify);
      }
      finished += asset.bytes;
      readyFiles++;
      progress("verifying", asset.label);
    }
    progress("applying", null);
  }
  private async download(
    asset: ModelAsset,
    report: (bytes: number, verifying: boolean) => void,
  ): Promise<void> {
    const directory = join(this.directory, asset.sha256);
    await mkdir(directory, { recursive: true });
    for (const name of await readdir(directory)) {
      if (!name.endsWith(".part")) continue;
      const path = join(directory, name);
      const match = /\.(\d+)-[0-9a-f-]+\.part$/.exec(name);
      let running = true;
      if (match) {
        try {
          process.kill(Number(match[1]), 0);
        } catch (error) {
          running = !(
            error instanceof Error &&
            "code" in error &&
            error.code === "ESRCH"
          );
        }
      }
      const info = await stat(path).catch(() => null);
      if (!running || (info && Date.now() - info.mtimeMs > 20 * 60_000))
        await rm(path, { force: true });
    }
    const temporary = join(
      directory,
      `${asset.file}.${process.pid}-${randomUUID()}.part`,
    );
    const abort = new AbortController();
    const signal = AbortSignal.any([
      abort.signal,
      AbortSignal.timeout(15 * 60_000),
    ]);
    let received = 0;
    try {
      const response = await this.fetcher(asset.url, {
        signal,
        redirect: "follow",
      });
      if (!response.ok || !response.body)
        throw new ModelDownloadError(
          "The scanner server did not provide the file. Retry when online.",
        );
      const length = response.headers.get("content-length");
      if (
        !response.headers.get("content-encoding") &&
        length !== null &&
        Number(length) !== asset.bytes
      ) {
        await response.body.cancel();
        throw new ModelDownloadError(
          "The scanner download has an unexpected size. Retry the download.",
        );
      }
      const file = await open(temporary, "wx");
      const hash = createHash("sha256");
      try {
        for await (const chunk of response.body) {
          received += chunk.byteLength;
          if (received > asset.bytes)
            throw new ModelDownloadError(
              "The scanner download is larger than expected.",
            );
          hash.update(chunk);
          await file.writeFile(chunk);
          report(received, false);
        }
        report(received, true);
        if (received !== asset.bytes || hash.digest("hex") !== asset.sha256)
          throw new ModelDownloadError(
            "The scanner download could not be verified. Retry to download a clean copy.",
          );
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.path(asset));
      this.verified.delete(this.path(asset));
    } finally {
      abort.abort();
      await rm(temporary, { force: true });
    }
  }
}
export const modelStore = new ModelStore();
