// The invoice lines: a row each (what, how many, what it re-bills, its
// receipts, the amount), edited in a modal. Forward billing is first-class:
// a line can re-bill a cost in its own currency, its price follows the
// exchange rate, and its receipts sit on the line. Dropping receipts on the
// list makes one re-billed line per receipt; dropping a file on a row
// attaches it to that line.
import { useAttachments, useEditorFileDrop } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  actions,
  findRate,
  lineNet,
  lineProblem,
  originalRate,
  type InvoiceAction,
  type InvoiceAttachment,
  type InvoiceLine,
  type InvoiceState,
  type VatCategory,
} from "document-models/invoice";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { fileKind } from "../../kit/files.js";
import { fmtDate, fromDateInput, money, toDateInput } from "../../kit/format.js";
import { attachFile, describeFile, fmtNumber, parseNumber, unitLabel, UNITS, VAT_CATEGORIES, vatLabel } from "../../kit/invoice.js";
import { Menu } from "../../kit/menu.js";
import { Badge, Button, cx, Field, Icon, Input, Modal, Select, Textarea } from "../../kit/ui.js";
import { FileTypeTile } from "../FilePreview.js";


type Dispatch = (action: InvoiceAction | InvoiceAction[]) => void;

const CATEGORIES = ["Consultancy", "Software", "Hosting", "Travel", "Hotel", "Restaurant", "Hardware", "Office", "Training", "Subcontracting"];
const RATES = [21, 12, 6];

/** The VAT a new line starts with: the last line's, else 21 %. */
function lastVat(state: InvoiceState): { vatCategory: VatCategory; vatRate: number } {
  const last = state.lines.at(-1);
  return last ? { vatCategory: last.vatCategory, vatRate: last.vatRate } : { vatCategory: "STANDARD", vatRate: 21 };
}

/** The currency re-billed costs usually come in: the VAT currency, else the invoice's. */
function costCurrency(state: InvoiceState): string {
  return state.lines.find((l) => l.original)?.original?.currency ?? state.vatCurrency ?? state.currency;
}

export function LineList({
  state,
  documentId,
  dispatch,
  locked,
  attachmentsOpen,
  activeAttachment,
  onShowAttachment,
}: {
  state: InvoiceState;
  documentId: string;
  dispatch: Dispatch;
  locked: boolean;
  /** Receipts can still be added (anything but void) */
  attachmentsOpen: boolean;
  activeAttachment: string | null;
  onShowAttachment: (id: string) => void;
}) {
  const client = useAttachments();
  const [editing, setEditing] = useState<InvoiceLine | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const run = (label: string, work: () => Promise<unknown>) => {
    setError(null);
    setBusy(label);
    work()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };

  /** One re-billed line per receipt, the receipt on it; amounts to fill in. */
  const rebill = (files: File[]) => {
    if (!client || !files.length) return;
    const vat = lastVat(state);
    const currency = costCurrency(state);
    run(`Adding ${files.length === 1 ? files[0].name : `${files.length} receipts`}…`, async () => {
      for (const file of files) {
        const id = generateId();
        dispatch(
          actions.addLine({
            id,
            description: describeFile(file.name),
            quantity: 1,
            unitPrice: 0,
            ...vat,
            originalAmount: 0,
            originalCurrency: currency,
          }),
        );
        await attachFile(client, documentId, file, { lineId: id, role: "RECEIPT" });
      }
    });
  };
  const listDrop = useEditorFileDrop({ onFiles: (files) => rebill(files) });

  const attachTo = (lineId: string, files: File[]) => {
    if (!client || !files.length) return;
    run(`Attaching ${files.length === 1 ? files[0].name : `${files.length} files`}…`, async () => {
      for (const file of files) await attachFile(client, documentId, file, { lineId, role: "RECEIPT" });
    });
  };

  return (
    <div className="sk-inv-lines">
      {state.lines.length > 0 && (
        <ol className="sk-inv-lines__list">
          {state.lines.map((line, index) => (
            <LineRow
              key={line.id}
              line={line}
              index={index}
              count={state.lines.length}
              state={state}
              locked={locked}
              canAttach={attachmentsOpen && !!client}
              activeAttachment={activeAttachment}
              onEdit={() => setEditing(line)}
              onShowAttachment={onShowAttachment}
              onAttach={(files) => attachTo(line.id, files)}
              dispatch={dispatch}
            />
          ))}
        </ol>
      )}
      {!locked && (
        <div
          {...listDrop.dragProps}
          className={cx("sk-inv-lines__add", listDrop.isDragOver && "is-over", state.lines.length === 0 && "is-empty")}
        >
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              rebill(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button variant="secondary" icon="plus" onClick={() => setEditing("new")}>
            Add a line
          </Button>
          <Button variant="ghost" icon="upload" disabled={!client || busy !== null} onClick={() => picker.current?.click()}>
            Re-bill receipts
          </Button>
          <span className="sk-caption sk-inv-lines__drop-hint">
            {client
              ? "Or drop receipts here: each becomes a re-billed line with its receipt attached"
              : "Receipts need a switchboard behind the drive"}
          </span>
        </div>
      )}
      {busy && <p className="sk-caption">{busy}</p>}
      {error && <p className="sk-small sk-text-danger">{error}</p>}
      {editing && (
        <LineModal
          state={state}
          line={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(action) => {
            dispatch(action);
            setEditing(null);
          }}
          onRemove={
            editing === "new"
              ? undefined
              : () => {
                  dispatch(actions.removeLine({ id: editing.id }));
                  setEditing(null);
                }
          }
        />
      )}
      {state.lines.length > 0 && <span className="sk-caption">{lineSummary(state)}</span>}
    </div>
  );
}

function lineSummary(state: InvoiceState): string {
  const rebilled = state.lines.filter((l) => l.original).length;
  const receipts = state.lines.reduce((n, l) => n + l.attachments.length, 0);
  const parts = [`${state.lines.length} line${state.lines.length === 1 ? "" : "s"}`];
  if (rebilled) parts.push(`${rebilled} re-billed`);
  if (receipts) parts.push(`${receipts} receipt${receipts === 1 ? "" : "s"} attached`);
  return parts.join(" · ");
}

function LineRow({
  line,
  index,
  count,
  state,
  locked,
  canAttach,
  activeAttachment,
  onEdit,
  onShowAttachment,
  onAttach,
  dispatch,
}: {
  line: InvoiceLine;
  index: number;
  count: number;
  state: InvoiceState;
  locked: boolean;
  canAttach: boolean;
  activeAttachment: string | null;
  onEdit: () => void;
  onShowAttachment: (id: string) => void;
  onAttach: (files: File[]) => void;
  dispatch: Dispatch;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cur = state.currency;
  const rate = originalRate(state, line);
  const o = line.original;
  const toFill = !!o && o.amount === 0;
  const noRate = !!o && o.currency !== cur && rate === null;
  const meta = [
    `${fmtNumber(line.quantity)} ${line.unitCode === "C62" ? "×" : unitLabel(line.unitCode, line.quantity)} ${money(line.unitPrice, cur)}`,
    vatLabel(line),
    line.category,
  ].filter(Boolean);

  // A file dropped on a row is a receipt for that line.
  const drop = canAttach
    ? {
        "data-editor-file-drop": "",
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: DragEvent) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          onAttach(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <li className={cx("sk-inv-line", over && "is-over", (toFill || noRate) && "is-flagged")} {...drop}>
      <div className="sk-inv-line__row">
        <button type="button" className="sk-inv-line__main" onClick={onEdit} disabled={locked}>
          <span className="sk-inv-line__no">{index + 1}</span>
          <span className="sk-inv-line__body">
            <span className="sk-inv-line__title">{line.description}</span>
            <span className="sk-inv-line__meta">{meta.join(" · ")}</span>
            {o && (
              <span className={cx("sk-inv-line__rebill", (toFill || noRate) && "is-warn")}>
                <Icon name="arrow-right" size={16} />
                {toFill
                  ? "Re-billed cost: fill in what it cost"
                  : o.currency === cur
                    ? `Re-bills ${money(o.amount, o.currency)}`
                    : rate === null
                      ? `Re-bills ${money(o.amount, o.currency)} · no ${o.currency}–${cur} rate yet`
                      : `Re-bills ${money(o.amount, o.currency)} at ${fmtNumber(rate)}${o.rate !== null ? " (own rate)" : ""}`}
              </span>
            )}
            {line.note && <span className="sk-inv-line__note">{line.note}</span>}
            {(line.period?.start || line.period?.end) && (
              <span className="sk-inv-line__note">
                {fmtDate(line.period.start)} – {fmtDate(line.period.end)}
              </span>
            )}
          </span>
          <span className="sk-inv-line__amount">{money(lineNet(line), cur)}</span>
        </button>
        {!locked && (
          <Menu
            label="Line actions"
            align="end"
            items={[
              { label: "Edit", onSelect: onEdit },
              { label: "Attach a receipt", disabled: !canAttach, onSelect: () => input.current?.click() },
              { label: "Move up", disabled: index === 0, onSelect: () => dispatch(actions.moveLine({ id: line.id, index: index - 1 })) },
              { label: "Move down", disabled: index === count - 1, onSelect: () => dispatch(actions.moveLine({ id: line.id, index: index + 1 })) },
              {
                label: "Duplicate",
                onSelect: () =>
                  dispatch(
                    actions.addLine({
                      id: generateId(),
                      description: line.description,
                      note: line.note,
                      quantity: line.quantity,
                      unitCode: line.unitCode,
                      unitPrice: line.unitPrice,
                      vatCategory: line.vatCategory,
                      vatRate: line.vatRate,
                      category: line.category,
                      periodStart: line.period?.start,
                      periodEnd: line.period?.end,
                      originalAmount: line.original?.amount,
                      originalCurrency: line.original?.currency,
                      originalRate: line.original?.rate,
                      position: index + 1,
                    }),
                  ),
              },
              { label: "Remove", danger: true, onSelect: () => dispatch(actions.removeLine({ id: line.id })) },
            ]}
            trigger={(open, toggle) => (
              <button type="button" className="sk-more" aria-haspopup="menu" aria-expanded={open} aria-label="Line actions" onClick={toggle}>
                <span />
              </button>
            )}
          />
        )}
        {locked && canAttach && (
          <Button size="sm" variant="ghost" iconOnly icon="upload" aria-label="Attach a receipt" title="Attach a receipt" onClick={() => input.current?.click()} />
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onAttach(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {line.attachments.length > 0 && (
        <ul className="sk-inv-chips">
          {line.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} active={a.id === activeAttachment} onShow={() => onShowAttachment(a.id)} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AttachmentChip({
  attachment,
  active,
  onShow,
}: {
  attachment: InvoiceAttachment;
  active: boolean;
  onShow: () => void;
}) {
  return (
    <li>
      <button type="button" className={cx("sk-inv-chip", active && "is-active")} onClick={onShow} title={attachment.fileName}>
        <FileTypeTile kind={fileKind(attachment.mimeType, attachment.fileName)} small />
        <span className="sk-inv-chip__name">{attachment.fileName}</span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------ the modal */

type Draft = {
  description: string;
  note: string;
  category: string;
  quantity: string;
  unitCode: string;
  unitPrice: string;
  vatCategory: VatCategory;
  vatRate: string;
  periodStart: string;
  periodEnd: string;
  rebill: boolean;
  originalAmount: string;
  originalCurrency: string;
  ownRate: boolean;
  originalRate: string;
};

function toDraft(state: InvoiceState, line: InvoiceLine | null): Draft {
  const vat = line ?? lastVat(state);
  return {
    description: line?.description ?? "",
    note: line?.note ?? "",
    category: line?.category ?? "",
    quantity: line ? fmtNumber(line.quantity) : "1",
    unitCode: line?.unitCode ?? "C62",
    unitPrice: line ? fmtNumber(line.unitPrice) : "",
    vatCategory: vat.vatCategory,
    vatRate: fmtNumber(vat.vatRate),
    periodStart: toDateInput(line?.period?.start),
    periodEnd: toDateInput(line?.period?.end),
    rebill: !!line?.original,
    originalAmount: line?.original ? fmtNumber(line.original.amount) : "",
    originalCurrency: line?.original?.currency ?? costCurrency(state),
    ownRate: line?.original?.rate !== null && line?.original?.rate !== undefined,
    originalRate: line?.original?.rate ? fmtNumber(line.original.rate) : "",
  };
}

function LineModal({
  state,
  line,
  onClose,
  onSave,
  onRemove,
}: {
  state: InvoiceState;
  line: InvoiceLine | null;
  onClose: () => void;
  onSave: (action: InvoiceAction) => void;
  onRemove?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(state, line));
  // The period and the note are seldom needed: folded unless the line has them.
  const [more, setMore] = useState(() => !!(line?.note || line?.period));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const cur = state.currency;

  // The line as it would be saved, priced the way the reducer prices it.
  const candidate = useMemo((): { line: InvoiceLine; rate: number | null; problem: string | null } => {
    const quantity = parseNumber(d.quantity);
    const amount = parseNumber(d.originalAmount);
    const own = d.ownRate ? parseNumber(d.originalRate) : null;
    const original = d.rebill
      ? { amount: amount ?? 0, currency: d.originalCurrency.trim().toUpperCase(), rate: own }
      : null;
    const rate = original
      ? (original.rate ?? findRate(state.exchangeRates, original.currency, cur))
      : null;
    const typed = parseNumber(d.unitPrice);
    const unitPrice =
      original && rate !== null ? Math.round(original.amount * rate * 100) / 100 : (typed ?? 0);
    const next: InvoiceLine = {
      id: line?.id ?? "new",
      description: d.description.trim(),
      note: d.note.trim() || null,
      quantity: quantity ?? 0,
      unitCode: d.unitCode,
      unitPrice,
      vatCategory: d.vatCategory,
      vatRate: d.vatCategory === "STANDARD" ? (parseNumber(d.vatRate) ?? 0) : 0,
      category: d.category.trim() || null,
      period: d.periodStart || d.periodEnd ? { start: d.periodStart ? fromDateInput(d.periodStart) : null, end: d.periodEnd ? fromDateInput(d.periodEnd) : null } : null,
      original,
      attachments: line?.attachments ?? [],
    };
    let problem = lineProblem(next);
    if (!problem && quantity === null) problem = "The quantity must be a number";
    if (!problem && d.rebill && amount === null) problem = "Fill in what the cost was";
    if (!problem && d.ownRate && own === null) problem = "Fill in the rate, or use the invoice's";
    return { line: next, rate, problem };
  }, [d, line, state.exchangeRates, cur]);

  const derived = d.rebill && candidate.rate !== null;
  const invoiceRate = d.rebill ? findRate(state.exchangeRates, d.originalCurrency.trim().toUpperCase(), cur) : null;

  const save = () => {
    if (candidate.problem) return;
    const n = candidate.line;
    const common = {
      description: n.description,
      note: n.note,
      category: n.category,
      quantity: n.quantity,
      unitCode: n.unitCode,
      unitPrice: n.unitPrice,
      vatCategory: n.vatCategory,
      vatRate: n.vatRate,
      periodStart: n.period?.start ?? null,
      periodEnd: n.period?.end ?? null,
      originalAmount: n.original ? n.original.amount : null,
      originalCurrency: n.original ? n.original.currency : null,
      originalRate: n.original ? n.original.rate : null,
    };
    if (!line) {
      onSave(actions.addLine({ id: generateId(), ...common }));
      return;
    }
    onSave(actions.updateLine({ id: line.id, ...common }));
  };

  return (
    <Modal
      title={line ? "Edit the line" : "Add a line"}
      onClose={onClose}
      footer={
        <>
          {onRemove && (
            <Button variant="ghost" className="sk-inv-modal__remove" onClick={onRemove}>
              Remove
            </Button>
          )}
          <span className="sk-grow" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!!candidate.problem} onClick={save}>
            {line ? "Save" : "Add"} · {money(lineNet(candidate.line), cur)}
          </Button>
        </>
      }
    >
      <div className="sk-inv-form sk-inv-line-form">
        <Field label="Description" required className="sk-inv-form__wide">
          <Input value={d.description} onChange={(e) => set("description", e.target.value)} placeholder="What is being invoiced" autoFocus />
        </Field>

        <div className="sk-inv-form__wide sk-inv-switchrow">
          <label className="sk-check">
            <input type="checkbox" checked={d.rebill} onChange={(e) => set("rebill", e.target.checked)} />
            <span>Re-bill a cost</span>
          </label>
          <span className="sk-caption">Forward billing: what it cost, in the currency of the receipt</span>
        </div>

        {d.rebill && (
          <div className="sk-inv-form__wide sk-inv-rebill">
            <div className="sk-inv-form__pair">
              <Field label="It cost">
                <Input inputMode="decimal" value={d.originalAmount} onChange={(e) => set("originalAmount", e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Currency">
                <Input value={d.originalCurrency} onChange={(e) => set("originalCurrency", e.target.value.toUpperCase())} maxLength={3} />
              </Field>
            </div>
            {d.originalCurrency.trim().toUpperCase() !== cur && (
              <div className="sk-inv-rebill__rate">
                <label className="sk-check">
                  <input type="checkbox" checked={d.ownRate} onChange={(e) => set("ownRate", e.target.checked)} />
                  <span>This cost has its own rate</span>
                </label>
                {d.ownRate ? (
                  <Field label={`1 ${d.originalCurrency || "…"} in ${cur}`} hint="E.g. the rate on the card statement">
                    <Input inputMode="decimal" value={d.originalRate} onChange={(e) => set("originalRate", e.target.value)} />
                  </Field>
                ) : (
                  <span className={cx("sk-small", invoiceRate === null && "sk-text-danger")}>
                    {invoiceRate === null
                      ? `No ${d.originalCurrency}–${cur} rate on the invoice yet: add it under Currency, or give this cost its own.`
                      : `At the invoice's rate: 1 ${d.originalCurrency} = ${fmtNumber(invoiceRate)} ${cur}`}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="sk-inv-form__triple sk-inv-form__wide">
          <Field label="Quantity">
            <Input inputMode="decimal" value={d.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Unit">
            <Select value={d.unitCode} onChange={(e) => set("unitCode", e.target.value)}>
              {!UNITS.some((u) => u.code === d.unitCode) && <option value={d.unitCode}>{d.unitCode}</option>}
              {UNITS.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Price per ${unitLabel(d.unitCode)} (${cur})`} hint={derived ? "From the cost and the rate" : "Excluding VAT"}>
            <Input
              inputMode="decimal"
              value={derived ? fmtNumber(candidate.line.unitPrice, 2) : d.unitPrice}
              readOnly={derived}
              onChange={(e) => set("unitPrice", e.target.value)}
            />
          </Field>
        </div>

        <div className="sk-inv-form__pair sk-inv-form__wide">
          <Field label="VAT" hint={VAT_CATEGORIES.find((c) => c.value === d.vatCategory)?.hint}>
            <Select value={d.vatCategory} onChange={(e) => set("vatCategory", e.target.value as VatCategory)}>
              {VAT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {d.vatCategory === "STANDARD" ? (
            <Field label="Rate">
              <span className="sk-inv-rates">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={cx("sk-inv-rate", parseNumber(d.vatRate) === r && "is-active")}
                    onClick={() => set("vatRate", String(r))}
                  >
                    {r} %
                  </button>
                ))}
                <Input className="sk-inv-rate-input" inputMode="decimal" value={d.vatRate} onChange={(e) => set("vatRate", e.target.value)} aria-label="Other rate" />
              </span>
            </Field>
          ) : (
            <ReadRate />
          )}
        </div>

        <Field label="Category" hint="For the books: Software, Travel…">
          <Input value={d.category} onChange={(e) => set("category", e.target.value)} list="sk-inv-categories" />
        </Field>
        <datalist id="sk-inv-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {more ? (
          <>
          <div className="sk-inv-form__pair">
            <Field label="From">
              <Input type="date" value={d.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={d.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
            </Field>
          </div>
          <Field label="Note on the line" className="sk-inv-form__wide">
            <Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
            </>
        ) : (
          <div className="sk-inv-form__end">
            <Button variant="link" size="sm" onClick={() => setMore(true)}>
              Period and note
            </Button>
          </div>
        )}
        {candidate.problem && d.description.trim() && (
          <p className="sk-small sk-text-danger sk-inv-form__wide">{candidate.problem}</p>
        )}
        {line && line.attachments.length > 0 && (
          <div className="sk-inv-form__wide">
            <Badge tone="outline">
              {line.attachments.length} receipt{line.attachments.length === 1 ? "" : "s"} on this line
            </Badge>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReadRate() {
  return (
    <Field label="Rate" hint="No VAT is charged in this category">
      <Input value="0 %" readOnly />
    </Field>
  );
}
