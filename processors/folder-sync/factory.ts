import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { DRIVE_TYPE, FILE_TYPE, FolderSync, SYNC_TYPE } from "./processor.js";

/** The drive app whose drives have folder syncs: the menu that makes them is the Files app's. */
const FILES_APP = "files";

export const folderSyncFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    // Only drives the Files app opens: every other drive (Mail with its
    // thousands of messages) would replay its whole history through here.
    const meta = driveHeader.meta as { preferredEditor?: string } | undefined;
    if (meta?.preferredEditor !== FILES_APP && driveHeader.slug !== "files") return [];

    const namespace = FolderSync.getNamespace(driveHeader.id);
    const store = await module.relationalDb.createNamespace<FolderSync>(namespace);

    // The mappings (every drive's; the processor keeps to its own), and what
    // an ON_CHANGE mapping watches: this drive's nodes and the Files' content.
    const mappingFilter: ProcessorFilter = { branch: ["main"], documentId: ["*"], documentType: [SYNC_TYPE], scope: ["global"] };
    const driveFilter: ProcessorFilter = { branch: ["main"], documentId: [driveHeader.id], documentType: [DRIVE_TYPE], scope: ["global"] };
    const fileFilter: ProcessorFilter = { branch: ["main"], documentId: ["*"], documentType: [FILE_TYPE], scope: ["global"] };

    const processor = new FolderSync(namespace, mappingFilter, store, driveHeader.id).withRuntime(driveHeader.id, {
      read: module.read,
      attachments: module.attachments,
      dispatch: module.dispatch,
    });
    await processor.initAndUpgrade();

    return [
      // Reads the drive through the client and ignores history: a replay
      // needs no state.
      { processor, filter: mappingFilter, replayState: "operations" },
      { processor, filter: driveFilter, replayState: "operations" },
      { processor, filter: fileFilter, replayState: "operations" },
    ];
  };
