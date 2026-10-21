import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { SyncSprite } from "../sektar/kit/sync-glyphs.js";
import { Sprite } from "../sektar/kit/ui.js";
import { FilesWorkspace } from "./components/FilesWorkspace.js";
import { editorConfig } from "./config.js";

/**
 * The Files drive app: folders, the folder's contents and a preview, as the
 * design system's panes workspace. A document that is opened (Connect passes
 * its editor as children) fills the app.
 */
export default function Editor({ children }: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div className="sk-app sk-files-app" style={{ background: "transparent" }}>
      <Sprite />
      <SyncSprite />
      <FilesWorkspace>{children}</FilesWorkspace>
    </div>
  );
}
