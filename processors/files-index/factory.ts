import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { DRIVE_DOCUMENT_TYPE, FILE_DOCUMENT_TYPE, FilesIndex } from "./processor.js";

/** The drive app whose drives are indexed: a listing is only ever asked of these. */
const FILES_APP = "files";

export const filesIndexFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    // Only drives the Files app opens. Every other drive (Mail with its
    // thousands of messages, the studio's) would replay its whole history
    // through this processor for nothing.
    const meta = driveHeader.meta as { preferredEditor?: string } | undefined;
    if (meta?.preferredEditor !== FILES_APP && driveHeader.slug !== "files") return [];

    const namespace = FilesIndex.getNamespace(driveHeader.id);
    const store = await module.relationalDb.createNamespace<FilesIndex>(namespace);

    // Two filters over one index: this drive's own operations (its nodes),
    // and every File document's. Processors are not routed by drive, so the
    // drive filter names the drive; a broad one would stream every drive's
    // history, each operation carrying that drive's whole node list. The two
    // processors share one write queue (see FilesIndex).
    // Scope "document" carries DELETE_DOCUMENT and PURGE_DOCUMENT.
    const driveFilter: ProcessorFilter = {
      branch: ["main"],
      documentId: [driveHeader.id],
      documentType: [DRIVE_DOCUMENT_TYPE],
      scope: ["global", "document"],
    };
    const fileFilter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: [FILE_DOCUMENT_TYPE],
      scope: ["global", "document"],
    };
    const nodes = new FilesIndex(namespace, driveFilter, store, driveHeader.id);
    const files = new FilesIndex(namespace, fileFilter, store, driveHeader.id);
    await nodes.initAndUpgrade();
    // Rows depend on the latest state alone: a replay needs only each
    // document's latest state, not every operation in between.
    return [
      { processor: nodes, filter: driveFilter, replayState: "collapse" },
      { processor: files, filter: fileFilter, replayState: "collapse" },
    ];
  };
