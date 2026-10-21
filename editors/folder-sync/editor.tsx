import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedFolderSyncDocument } from "document-models/folder-sync";
import { FolderSyncDetail } from "../sektar/components/folder-sync/FolderSyncDetail.js";
import { SyncSprite } from "../sektar/kit/sync-glyphs.js";
import { Sprite } from "../sektar/kit/ui.js";

/**
 * A folder sync as a document: Connect's toolbar on top, then the mapping
 * (which drive folder goes where on disk), its options, and the runs the
 * Switchboard reported.
 */
export default function Editor() {
  const [document, dispatch] = useSelectedFolderSyncDocument();
  return (
    <>
      <DocumentToolbar />
      <div className="sk-app sk-page" style={{ minHeight: "100%", background: "transparent" }}>
        <Sprite />
        <SyncSprite />
        <div className="sk-container" style={{ maxWidth: 960, paddingBlock: "var(--sk-space-6)" }}>
          <FolderSyncDetail doc={document} dispatch={dispatch} />
        </div>
      </div>
    </>
  );
}
