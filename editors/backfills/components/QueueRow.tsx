// One backfill in the list: what it is, how far it has got, and whether it
// is moving. The design system's rich row, with the progress bar as the
// row's extra line once a walk has begun. It reads the queue's index row
// (kit/integration-index), not the document.
import type { QueueListRow } from "../../sektar/kit/integration-index.js";
import {
  Badge,
  IconTile,
  ListItem,
  ProgressRow,
} from "../../sektar/kit/ui.js";
import {
  count,
  percentLabel,
  percentOf,
  plural,
  STATUS,
  statusOf,
} from "../lib.js";

export function QueueRow({
  row,
  selected,
  onClick,
}: {
  row: QueueListRow;
  selected: boolean;
  onClick: () => void;
}) {
  const s = statusOf(row);
  const status = STATUS[s];
  const total = row.total;
  const walking = s === "IN_PROGRESS" || s === "PAUSED";
  const shape =
    row.loops === 0
      ? "No loops yet"
      : `${plural(row.loops, "loop")} · ${plural(total, "position")}`;
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
          variant={s === "IN_PROGRESS" ? "forest" : undefined}
        />
      }
      title={row.name || "Untitled backfill"}
      sub={[
        row.description ? (
          <span key="desc" style={{ color: "var(--sk-text)" }}>
            {row.description}
          </span>
        ) : (
          <span key="desc" className="sk-text-muted">
            No description
          </span>
        ),
        shape,
      ]}
      extra={
        s !== "DRAFT" &&
        total > 0 && (
          <div className="sk-mt-1">
            <ProgressRow
              value={percentOf(row)}
              label={percentLabel(row)}
              variant={s === "FINISHED" ? "mint" : undefined}
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
              {count(row.iteration)} of {count(total)}
            </span>
          )}
          {row.awaitingValues && <span>waiting for values</span>}
          {row.errorCount > 0 && (
            <span className="sk-text-danger">
              {plural(row.errorCount, "failure")}
            </span>
          )}
        </>
      }
      chevron
    />
  );
}
