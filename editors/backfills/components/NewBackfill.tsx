// Creating a backfill: a name, a line on what it does, and the first loop
// ready-made, because "every week back to a date" and "pages 1 to 50" are
// what most backfills start as.
import { useState } from "react";
import {
  Button,
  Field,
  Input,
  Modal,
  Segmented,
  Select,
  Textarea,
} from "../../sektar/kit/ui.js";
import {
  fromLocalInput,
  STEP_PRESETS,
  todayIso,
  toLocalInput,
  yearsAgoIso,
  type NewBackfill as Draft,
  type NewCursor,
} from "../lib.js";

type Start = "time" | "numbers" | "blank";
const STARTS: { value: Start; label: string }[] = [
  { value: "time", label: "Time range" },
  { value: "numbers", label: "Numbers" },
  { value: "blank", label: "Blank" },
];

export function NewBackfill({
  onCreate,
  onClose,
  busy,
}: {
  onCreate: (draft: Draft) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState<Start>("time");
  const [loopName, setLoopName] = useState("Week");
  const [from, setFrom] = useState(() => toLocalInput(todayIso()));
  const [to, setTo] = useState(() => toLocalInput(yearsAgoIso(2)));
  const [delta, setDelta] = useState(String(86400 * 7));
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState("50");

  const cursor = (): NewCursor | null | undefined => {
    if (start === "blank") return undefined;
    if (start === "time") {
      const a = fromLocalInput(from);
      const b = fromLocalInput(to);
      return a && b && a !== b
        ? { kind: "datetime", name: loopName, first: a, last: b, deltaSeconds: Number(delta) }
        : null;
    }
    const a = Number(first);
    const b = Number(last);
    return Number.isFinite(a) && Number.isFinite(b)
      ? { kind: "number", name: loopName, first: a, last: b, step: 1 }
      : null;
  };
  const firstLoop = cursor();
  const ready = name.trim() !== "" && firstLoop !== null && !busy;

  return (
    <Modal
      title="New backfill"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="plus"
            disabled={!ready}
            onClick={() =>
              onCreate({
                name,
                description,
                cursors: firstLoop ? [firstLoop] : [],
                collections: [],
              })
            }
          >
            {busy ? "Creating…" : "Create backfill"}
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        <Field label="Name" required>
          <Input
            autoFocus
            value={name}
            placeholder="Gmail since 2019"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="What it backfills">
          <Textarea
            rows={2}
            value={description}
            placeholder="Every week of the Powerhouse mailbox, newest first"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="First loop" hint="More loops and queues can be added afterwards, while it is a draft.">
          <Segmented value={start} options={STARTS} onChange={setStart} />
        </Field>
        {start !== "blank" && (
          <div className="sk-grid sk-grid--2">
            <Field label="Loop name">
              <Input value={loopName} onChange={(e) => setLoopName(e.target.value)} />
            </Field>
            {start === "time" ? (
              <>
                <Field label="Step">
                  <Select value={delta} onChange={(e) => setDelta(e.target.value)}>
                    {STEP_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="From" hint="Later than To: newest first.">
                  <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="Back to">
                  <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <Field label="From">
                  <Input type="number" value={first} onChange={(e) => setFirst(e.target.value)} />
                </Field>
                <Field label="To">
                  <Input type="number" value={last} onChange={(e) => setLast(e.target.value)} />
                </Field>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
