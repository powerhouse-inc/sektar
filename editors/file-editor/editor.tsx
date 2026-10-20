import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedFileDocument } from "document-models/file";
import { FileWorkspace } from "../sektar/components/FileDetail.js";
import { Sprite } from "../sektar/kit/ui.js";

/**
 * The File document: Connect's toolbar on top, then the design system's
 * workspace — the file's details (title, description, tags, the source of
 * truth and its extracted content) beside a preview of whichever is picked.
 */
export default function Editor() {
  const [document, dispatch] = useSelectedFileDocument();
  return (
    <>
      <DocumentToolbar />
      <div className="sk-app sk-file-app" style={{ background: "transparent" }}>
        <Sprite />
        <FileWorkspace doc={document} dispatch={dispatch} />
      </div>
    </>
  );
}
