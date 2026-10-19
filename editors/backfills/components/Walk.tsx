// The walk: where the backfill has got to, the controls that move it, what
// failed, and what the workflow behind it is holding on to. Only the
// transitions the document will accept are offered; the reducers refuse the
// rest by name, and a button certain to produce an error is worse than none.
import type { OriginalSourceQueueDocument } from "document-models/original-source-queue";
import { actions, cursorLabel } from "document-models/original-source-queue";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Dl,
  Progress,
  Ring,
} from "../../sektar/kit/ui.js";
import { PaneSection } from "../../sektar/kit/workspace.js";
import {
  count,
  iterationOf,
  KIND,
  kindOf,
  percentLabel,
  percentOf,
  plural,
  readingFor,
  STATUS,
  str,
  totalOf,
  whereOf,
  type Dispatch,
} from "../lib.js";

export function Walk({
  doc,
  dispatch,
}: {
  doc: OriginalSourceQueueDocument;
  dispatch: Dispatch;
}) {
  const s = doc.state.global;
  const status = STATUS[s.status];
  const total = totalOf(s);
  const iteration = iterationOf(s);
  const [failuresOpen, setFailuresOpen] = useState(true);
  const [memoryOpen, setMemoryOpen] = useState(false);

  return (
    <div className="sk-stack sk-stack--6 sk-backfills__walk">
      <div className="sk-card sk-card--compact sk-backfills__status">
        <div className="sk-row sk-row--4">
          <Ring
            small
            value={percentOf(s)}
            label={s.status === "DRAFT" ? "—" : percentLabel(s)}
          />
          <div className="sk-stack sk-stack--2" style={{ minWidth: 0 }}>
            <Badge tone={status.tone} dot pill>
              {status.label}
            </Badge>
            <span className="sk-h4 sk-tabular">
              {total === 0
                ? "Nothing to walk"
                : s.status === "DRAFT"
                  ? `${plural(total, "position")} to walk`
                  : `${count(iteration)} of ${count(total)}`}
            </span>
            <span className="sk-caption">{status.hint}</span>
          </div>
        </div>
        <Controls status={s.status} canStart={s.cursors.length > 0} dispatch={dispatch} />
      </div>

      {s.awaitingValues && (
        <Alert tone="warning" title="Waiting for values">
          A queue this walk depends on is empty. Not an error and not the end:
          it carries on as soon as something is pushed onto it.
        </Alert>
      )}

      <PaneSection title="Position">
        {s.cursors.length === 0 ? (
          <p className="sk-small sk-text-muted">Add a loop to describe the space to walk.</p>
        ) : (
          <div className="sk-backfills__odometer">
            {s.cursors.map((cursor, depth) => {
              const draft = s.status === "DRAFT";
              const reading = draft
                ? { main: "Not started", sub: null }
                : readingFor(cursor, s.collections);
              const at = cursor.count > 0 && !draft ? cursor.position + 1 : 0;
              const share = cursor.count > 0 ? (at / cursor.count) * 100 : 0;
              return (
                <div key={cursor.id} className="sk-card sk-card--subtle sk-backfills__dial">
                  <div className="sk-row sk-row--between sk-row--wrap">
                    <span className="sk-row sk-row--2">
                      <span className="sk-weight-semibold">{cursorLabel(cursor)}</span>
                      <Badge tone="outline">{KIND[kindOf(cursor)].label}</Badge>
                    </span>
                    <span className="sk-caption">
                      {s.cursors.length > 1 ? `depth ${String(depth + 1)}` : ""}
                    </span>
                  </div>
                  <div className={draft ? "sk-backfills__reading sk-text-muted" : "sk-backfills__reading"}>
                    {reading.main}
                  </div>
                  {reading.sub !== null && (
                    <div className="sk-backfills__next">{reading.sub}</div>
                  )}
                  <div className="sk-backfills__dial-progress">
                    <Progress value={share} variant={cursor.finished && !draft ? "mint" : undefined} />
                    <span className="sk-caption sk-tabular">
                      {draft
                        ? `${count(cursor.count)} to walk`
                        : `${count(at)} of ${count(cursor.count)}`}
                      {cursor.finished && !draft ? " · last" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PaneSection>

      <PaneSection
        title="Failures"
        count={s.errors.length}
        collapsed={!failuresOpen}
        onToggle={() => setFailuresOpen((v) => !v)}
      >
        {s.errors.length === 0 ? (
          <p className="sk-small sk-text-muted">None reported.</p>
        ) : (
          <ul className="sk-backfills__failures">
            {[...s.errors]
              .reverse()
              .slice(0, 8)
              .map((error) => (
                <li key={error.id}>
                  <div className="sk-small">{error.message}</div>
                  <div className="sk-caption">{whereOf(error, s.cursors) || "no position recorded"}</div>
                </li>
              ))}
            {s.errors.length > 8 && (
              <li className="sk-caption">and {s.errors.length - 8} earlier</li>
            )}
          </ul>
        )}
      </PaneSection>

      <PaneSection
        title="Memory"
        count={s.memory.length}
        collapsed={!memoryOpen}
        onToggle={() => setMemoryOpen((v) => !v)}
      >
        {s.memory.length === 0 ? (
          <p className="sk-small sk-text-muted">
            Empty. A workflow leaves values here for its next turn, such as a page token.
          </p>
        ) : (
          <Dl
            tight
            rows={s.memory.map((entry) => ({
              label: entry.key,
              value: <span className="sk-backfills__value">{str(entry.value)}</span>,
            }))}
          />
        )}
      </PaneSection>
    </div>
  );
}

function Controls({
  status,
  canStart,
  dispatch,
}: {
  status: OriginalSourceQueueDocument["state"]["global"]["status"];
  canStart: boolean;
  dispatch: Dispatch;
}) {
  return (
    <div className="sk-row sk-row--2 sk-row--wrap sk-mt-4">
      {status === "DRAFT" && (
        <Button
          variant="primary"
          size="sm"
          icon="arrow-right"
          disabled={!canStart}
          title={
            canStart
              ? "Begin the walk and hand out the first position."
              : "Add at least one loop first."
          }
          onClick={() => void dispatch(actions.start({}))}
        >
          Start
        </Button>
      )}
      {status === "IN_PROGRESS" && (
        <>
          <Button
            variant="secondary"
            size="sm"
            title="Hand out the next position by hand. The For Every trigger does this on its own."
            onClick={() => void dispatch(actions.proceed({}))}
          >
            Step
          </Button>
          <Button size="sm" onClick={() => void dispatch(actions.pause({}))}>
            Pause
          </Button>
        </>
      )}
      {status === "PAUSED" && (
        <Button
          variant="primary"
          size="sm"
          icon="arrow-right"
          onClick={() => void dispatch(actions.unpause({}))}
        >
          Resume
        </Button>
      )}
      {(status === "IN_PROGRESS" || status === "PAUSED") && (
        <Button
          variant="ghost"
          size="sm"
          title="Stop for good without walking the rest."
          onClick={() => void dispatch(actions.terminate({}))}
        >
          End
        </Button>
      )}
      {status !== "DRAFT" && (
        <Button
          variant="ghost"
          size="sm"
          title="Back to a draft. Loops and queued values stay; position, failures and memory are cleared."
          onClick={() => void dispatch(actions.reset({}))}
        >
          Reset
        </Button>
      )}
    </div>
  );
}
