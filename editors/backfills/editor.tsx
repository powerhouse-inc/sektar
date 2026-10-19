import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { Sprite } from "../sektar/kit/ui.js";
import { BackfillsWorkspace } from "./components/BackfillsWorkspace.js";
import { editorConfig } from "./config.js";

/**
 * The Backfills drive app: every Original Source Queue in the drive, as the
 * design system's workspace — the list of backfills, the definition of the
 * one picked (its loops and queues), and its walk (position, controls,
 * failures, memory), side by side or stacked one screen at a time. A queue
 * opened by URL is preselected. The document editor Connect would pass as
 * children stays out of the way: the definition pane is that view.
 */
export default function Editor(_props: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div className="sk-app sk-backfills-app" style={{ background: "transparent" }}>
      <Sprite />
      <BackfillsWorkspace />
    </div>
  );
}
