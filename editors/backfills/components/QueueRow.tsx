// One backfill in the list: what it is, how far it has got, and whether it
// is moving. The design system's rich row, with the progress bar as the
// row's extra line once a walk has begun.
import type { OriginalSourceQueueDocument } from "document-models/original-source-queue";
import {
  Badge,
  IconTile,
  ListItem,
  ProgressRow,
} from "../../sektar/kit/ui.js";
import {
  count,
  iterationOf,
  percentLabel,
  percentOf,
  plural,
  STATUS,
  totalOf,
} from "../lib.js";

export function QueueRow({
  doc,
  selected,
  onClick,
}: {
  doc: OriginalSourceQueueDocument;
  selected: boolean;
  onClick: () => void;
}) {
  const s = doc.state.global;
  const status = STATUS[s.status];
  const total = totalOf(s);
  const walking = s.status === "IN_PROGRESS" || s.status === "PAUSED";
  const shape =
    s.cursors.length === 0
      ? "No loops yet"
      : `${plural(s.cursors.length, "loop")} · ${plural(total, "position")}`;
  return (
    <ListItem
      rich
      selected={selected}
      onClick={onClick}
      drill={2}
      icon={
        <IconTile
          name={status.icon}
          size="sm"
          variant={s.status === "IN_PROGRESS" ? "forest" : undefined}
        />
      }
      title={doc.header.name || "Untitled backfill"}
      sub={[
        s.description ? (
          <span key="desc" style={{ color: "var(--sk-text)" }}>
            {s.description}
          </span>
        ) : (
          <span key="desc" className="sk-text-muted">
            No description
          </span>
        ),
        shape,
      ]}
      extra={
        s.status !== "DRAFT" &&
        total > 0 && (
          <div className="sk-mt-1">
            <ProgressRow
              value={percentOf(s)}
              label={percentLabel(s)}
              variant={s.status === "FINISHED" ? "mint" : undefined}
            />
          </div>
        )
      }
      aside={
        <>
          <Badge tone={status.tone} dot pill>
            {status.label}
          </Badge>
          {walking && total > 0 && (
            <span className="sk-tabular">
              {count(iterationOf(s))} of {count(total)}
            </span>
          )}
          {s.awaitingValues && <span>waiting for values</span>}
          {s.errors.length > 0 && (
            <span className="sk-text-danger">
              {plural(s.errors.length, "failure")}
            </span>
          )}
        </>
      }
      chevron
    />
  );
}
