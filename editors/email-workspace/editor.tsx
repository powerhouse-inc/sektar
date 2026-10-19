import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { Sprite } from "../sektar/kit/ui.js";
import { MailWorkspace } from "./components/MailWorkspace.js";
import { editorConfig } from "./config.js";

/**
 * The Mail drive app: every captured email in the drive, as the design
 * system's workspace — inboxes, the list, the message and its attachments,
 * side by side or stacked. A message opened by URL is preselected; the
 * workspace keeps the document editor Connect would pass as children out of
 * the way, because the message pane already is that view.
 */
export default function Editor(_props: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div className="sk-app sk-mail-app" style={{ background: "transparent" }}>
      <Sprite />
      <MailWorkspace />
    </div>
  );
}
