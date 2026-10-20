import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { TripSprite } from "../sektar/kit/trip-glyphs.js";
import { Sprite } from "../sektar/kit/ui.js";
import { TripsWorkspace } from "./components/TripsWorkspace.js";
import { editorConfig } from "./config.js";

/**
 * The Trips drive app: every business trip in the drive as the design
 * system's workspace — the trips, the picked trip's overview and what to add
 * next, side by side or stacked. A trip opened by URL is preselected; the
 * workspace keeps the document editor Connect would pass as children out of
 * the way, because the overview already is that view.
 */
export default function Editor(_props: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div className="sk-app sk-trips-app" style={{ background: "transparent" }}>
      <Sprite />
      <TripSprite />
      <TripsWorkspace />
    </div>
  );
}
