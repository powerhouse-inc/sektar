import { DocumentToolbar } from "@powerhousedao/design-system/connect";
import { useSelectedTripDocument } from "document-models/trip";
import { TripOverview } from "../sektar/components/trip/TripOverview.js";
import { TripSide } from "../sektar/components/trip/TripSide.js";
import { TripSprite } from "../sektar/kit/trip-glyphs.js";
import { Sprite } from "../sektar/kit/ui.js";

/**
 * A trip as a document: Connect's toolbar on top, then the trip's overview
 * (why and where, the figures, the itinerary, the costs, the documents) beside
 * what to add next and where Sektar found it.
 */
export default function Editor() {
  const [document, dispatch] = useSelectedTripDocument();
  return (
    <>
      <DocumentToolbar />
      <div className="sk-app sk-trips-app sk-trip-editor" style={{ background: "transparent" }}>
        <Sprite />
        <TripSprite />
        <div className="sk-trip-editor__main">
          <TripOverview doc={document} dispatch={dispatch} />
        </div>
        <aside className="sk-trip-editor__side">
          <TripSide doc={document} dispatch={dispatch} />
        </aside>
      </div>
    </>
  );
}
