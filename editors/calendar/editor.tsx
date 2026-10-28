import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { Sprite } from "../sektar/kit/ui.js";
import { CalendarWeek } from "./components/CalendarWeek.js";
import { editorConfig } from "./config.js";

/**
 * The Calendar drive app: the events calendar integrations bring in, one
 * sektar/calendar-event document each, as the design system's week view
 * (Patterns · Calendar). Read-only for now: events change at the provider.
 */
export default function Editor(_props: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div
      className="sk-app sk-calendar-app"
      style={{ background: "transparent" }}
    >
      <Sprite />
      <CalendarWeek />
    </div>
  );
}
