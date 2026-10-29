// The details pane's sections other than parties and lines: what the
// invoice is (kind, subject, dates, references), its currencies and
// exchange rates, the VAT breakdown and its legal mentions, how to pay, the
// documents at invoice level, and the notes.
import { useAttachments, useEditorFileDrop } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import {
  actions,
  CATEGORY_NEEDS_REASON,
  computeTotals,
  findRate,
  type AttachmentRole,
  type ExchangeRate,
  type InvoiceAction,
  type InvoiceAttachment,
  type InvoiceState,
  type VatCategory,
} from "document-models/invoice";
import { useMemo, useRef, useState } from "react";
import { useInvoiceNumbers, type InvoiceNumberRow } from "../../kit/finance-index.js";
import { bytes, fileKind } from "../../kit/files.js";
import { fmtDate, fromDateInput, money, PAYMENT_METHOD, toDateInput } from "../../kit/format.js";
import {
  ATTACHMENT_ROLES,
  CURRENCIES,
  fmtNumber,
  formatAccount,
  parseNumber,
  attachFile,
  guessRole,
  PAYMENT_MEANS,
  roleLabel,
  vatCategory,
  VATEX_PRESETS,
} from "../../kit/invoice.js";
import { Menu } from "../../kit/menu.js";
import { Button, cx, Field, Input, Modal, Segmented, Select, Textarea } from "../../kit/ui.js";
import { FileTypeTile } from "../FilePreview.js";
import { DateField, ReadField, TextField } from "./fields.js";

type Dispatch = (action: InvoiceAction | InvoiceAction[]) => void;

/* --------------------------------------------------------------- details */

export function DetailsSection({
  state,
  dispatch,
  locked,
  closed,
}: {
  state: InvoiceState;
  dispatch: Dispatch;
  /** Issued: what was invoiced is fixed */
  locked: boolean;
  /** Paid or void: nothing changes */
  closed: boolean;
}) {
  const [refsOpen, setRefsOpen] = useState(
    () => !!(state.references.orderReference || state.references.contractReference || state.references.projectReference),
  );
  const header = (patch: Parameters<typeof actions.setHeader>[0]) => dispatch(actions.setHeader(patch));
  const r = state.references;
  return (
    <div className="sk-inv-form">
      {!locked && (
        <div className="sk-inv-form__wide sk-inv-kinds">
          <Segmented
            value={state.kind}
            onChange={(kind) => header({ kind })}
            options={[
              { value: "INVOICE", label: "Invoice" },
              { value: "CREDIT_NOTE", label: "Credit note" },
            ]}
          />
          <Segmented
            value={state.direction}
            onChange={(direction) => header({ direction })}
            options={[
              { value: "OUTGOING", label: "We bill" },
              { value: "INCOMING", label: "We are billed" },
            ]}
          />
        </div>
      )}
      <TextField
        className="sk-inv-form__wide"
        label="Subject"
        value={state.subject}
        placeholder="What it is for, e.g. Powerhouse expenses, January 2026"
        locked={locked}
        onCommit={(subject) => header({ subject })}
      />
      <ReadField label={state.kind === "CREDIT_NOTE" ? "Credit note no." : "Invoice no."} value={state.number ?? <span className="sk-text-muted">Given when issued</span>} />
      <ReadField label="Issue date" value={state.issuedAt ? fmtDate(state.issuedAt) : <span className="sk-text-muted">Set when issued</span>} />
      <DateField
        label="Delivery date"
        hint={locked ? undefined : "When the goods or service were delivered"}
        value={state.deliveredAt}
        readValue={state.deliveredAt && fmtDate(state.deliveredAt)}
        locked={locked}
        onCommit={(deliveredAt) => header({ deliveredAt })}
      />
      <DateField
        label="Due date"
        value={state.dueAt}
        readValue={state.dueAt && fmtDate(state.dueAt)}
        locked={closed}
        onCommit={(dueAt) => header({ dueAt })}
      />
      <DateField
        label="Period from"
        value={state.period?.start}
        readValue={state.period?.start && fmtDate(state.period.start)}
        locked={locked}
        onCommit={(periodStart) => header({ periodStart })}
      />
      <DateField
        label="Period to"
        value={state.period?.end}
        readValue={state.period?.end && fmtDate(state.period.end)}
        locked={locked}
        onCommit={(periodEnd) => header({ periodEnd })}
      />
      <TextField
        label="Their reference"
        hint={locked ? undefined : "The buyer's reference or PO; Peppol asks for one of the two"}
        value={r.buyerReference}
        locked={locked}
        onCommit={(buyerReference) => header({ buyerReference })}
      />
      {refsOpen || locked ? (
        <>
          <TextField label="Order" value={r.orderReference} locked={locked} onCommit={(orderReference) => header({ orderReference })} />
          <TextField label="Contract" value={r.contractReference} locked={locked} onCommit={(contractReference) => header({ contractReference })} />
          <TextField label="Project" value={r.projectReference} locked={locked} onCommit={(projectReference) => header({ projectReference })} />
        </>
      ) : (
        <div className="sk-inv-form__end">
          <Button variant="link" size="sm" onClick={() => setRefsOpen(true)}>
            Order, contract or project reference
          </Button>
        </div>
      )}
      {state.kind === "CREDIT_NOTE" && <PrecedingInvoices state={state} dispatch={dispatch} locked={locked} />}
    </div>
  );
}

function PrecedingInvoices({ state, dispatch, locked }: { state: InvoiceState; dispatch: Dispatch; locked: boolean }) {
  // The numbered invoices of the direction, from the finance index.
  const numbers = useInvoiceNumbers(state.direction);
  const pool = numbers.filter(
    (i) =>
      i.kind === "INVOICE" &&
      i.number &&
      !state.precedingInvoices.some((p) => p.number === i.number),
  );
  const [typed, setTyped] = useState("");
  const add = (row: InvoiceNumberRow | null, number: string) =>
    dispatch(
      actions.addPrecedingInvoice({
        id: generateId(),
        number,
        issuedAt: row?.issuedAt ?? null,
        documentId: row?.id ?? null,
      }),
    );
  return (
    <div className="sk-inv-form__wide sk-inv-preceding">
      <span className="sk-label">Corrects</span>
      {state.precedingInvoices.length === 0 && <span className="sk-small sk-text-muted">No invoice yet</span>}
      <ul className="sk-inv-tokens">
        {state.precedingInvoices.map((p) => (
          <li key={p.id} className="sk-inv-token">
            {p.number}
            {p.issuedAt && <span className="sk-caption"> · {fmtDate(p.issuedAt)}</span>}
            {!locked && (
              <button type="button" aria-label={`Remove ${p.number}`} onClick={() => dispatch(actions.removePrecedingInvoice({ id: p.id }))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="sk-inv-preceding__add">
          {pool.length > 0 && (
            <Select
              value=""
              onChange={(e) => {
                const row = pool.find((i) => i.id === e.target.value);
                if (row?.number) add(row, row.number);
              }}
            >
              <option value="">Pick an invoice…</option>
              {pool.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {fmtDate(i.issuedAt)}
                </option>
              ))}
            </Select>
          )}
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type its number" />
          <Button
            size="sm"
            variant="secondary"
            disabled={!typed.trim()}
            onClick={() => {
              add(null, typed.trim());
              setTyped("");
            }}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- currency */

export function CurrencySection({ state, dispatch, locked }: { state: InvoiceState; dispatch: Dispatch; locked: boolean }) {
  const [editing, setEditing] = useState<Partial<ExchangeRate> | null>(null);
  const cur = state.currency;
  // Pairs the invoice needs a rate for and does not have yet.
  const missing = useMemo(() => {
    const need = new Set<string>();
    if (state.vatCurrency && findRate(state.exchangeRates, cur, state.vatCurrency) === null) need.add(state.vatCurrency);
    for (const l of state.lines)
      if (l.original && l.original.rate === null && findRate(state.exchangeRates, l.original.currency, cur) === null)
        need.add(l.original.currency);
    return [...need];
  }, [state, cur]);
  const options = (exclude?: string) => CURRENCIES.filter((c) => c !== exclude);

  return (
    <div className="sk-inv-form">
      {locked ? (
        <>
          <ReadField label="Invoice currency" value={cur} />
          <ReadField label="VAT reported in" value={state.vatCurrency ?? cur} />
        </>
      ) : (
        <>
          <Field label="Invoice currency" hint="What the customer pays in">
            <Select value={cur} onChange={(e) => dispatch(actions.setCurrency({ currency: e.target.value, ...(state.vatCurrency === e.target.value ? { vatCurrency: null } : {}) }))}>
              {!CURRENCIES.includes(cur) && <option value={cur}>{cur}</option>}
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="VAT reported in" hint="For an invoice in a foreign currency: the VAT total in yours">
            <Select value={state.vatCurrency ?? ""} onChange={(e) => dispatch(actions.setCurrency({ vatCurrency: e.target.value || null }))}>
              <option value="">{cur}, the invoice currency</option>
              {options(cur).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
      <div className="sk-inv-form__wide">
        <span className="sk-label">Exchange rates</span>
        {state.exchangeRates.length === 0 && missing.length === 0 && (
          <p className="sk-small sk-text-muted sk-inv-quiet">
            None needed: every amount is in {cur}. Re-billed costs in another currency and VAT reported in another currency use a rate from here.
          </p>
        )}
        {state.exchangeRates.length > 0 && (
          <ul className="sk-file-rows sk-inv-rates-list">
            {state.exchangeRates.map((r) => (
              <li key={`${r.base}${r.quote}`} className="sk-file-row">
                <button type="button" className="sk-file-row__main" disabled={locked} onClick={() => setEditing(r)}>
                  <span className="sk-inv-fx">
                    {r.base}
                    <span>→</span>
                    {r.quote}
                  </span>
                  <span className="sk-file-row__body">
                    <span className="sk-file-row__name">
                      1 {r.base} = {fmtNumber(r.rate)} {r.quote}
                    </span>
                    <span className="sk-file-row__meta">
                      1 {r.quote} = {fmtNumber(1 / r.rate)} {r.base}
                      {r.date && ` · ${fmtDate(r.date)}`}
                      {r.source && ` · ${r.source}`}
                    </span>
                  </span>
                </button>
                {!locked && (
                  <span className="sk-file-row__actions">
                    <Button size="sm" variant="ghost" onClick={() => dispatch(actions.removeExchangeRate({ base: r.base, quote: r.quote }))}>
                      Remove
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {!locked && (
          <div className="sk-inv-actions">
            {missing.map((c) => (
              <Button key={c} size="sm" variant="soft" icon="plus" onClick={() => setEditing({ base: c, quote: cur })}>
                {c} → {cur} rate
              </Button>
            ))}
            <Button size="sm" variant="ghost" icon="plus" onClick={() => setEditing({ base: state.vatCurrency ?? "EUR", quote: cur === "EUR" ? "USD" : cur })}>
              Add a rate
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <RateModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(rate) => {
            dispatch(actions.setExchangeRate(rate));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RateModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<ExchangeRate>;
  onClose: () => void;
  onSave: (rate: { base: string; quote: string; rate: number; date: string | null; source: string | null }) => void;
}) {
  const [base, setBase] = useState(initial.base ?? "EUR");
  const [quote, setQuote] = useState(initial.quote ?? "USD");
  const [rate, setRate] = useState(initial.rate ? fmtNumber(initial.rate) : "");
  const [date, setDate] = useState(toDateInput(initial.date));
  const [source, setSource] = useState(initial.source ?? "");
  const n = parseNumber(rate);
  const problem =
    base === quote ? "Pick two different currencies" : n === null || n <= 0 ? "The rate is a positive number" : null;
  return (
    <Modal
      title="Exchange rate"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!!problem}
            onClick={() => onSave({ base, quote, rate: n ?? 0, date: date ? fromDateInput(date) : null, source: source.trim() || null })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="sk-inv-form">
        <div className="sk-inv-form__wide sk-inv-ratebox">
          <span className="sk-inv-ratebox__one">1</span>
          <CurrencyPicker value={base} onChange={setBase} label="From" />
          <span className="sk-inv-ratebox__eq">=</span>
          <Input className="sk-inv-ratebox__rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1,173094" autoFocus aria-label="Rate" />
          <CurrencyPicker value={quote} onChange={setQuote} label="To" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBase(quote);
              setQuote(base);
              if (n) setRate(fmtNumber(1 / n));
            }}
          >
            Swap
          </Button>
        </div>
        {n !== null && n > 0 && base !== quote && (
          <p className="sk-small sk-text-muted sk-inv-form__wide">
            1 {quote} = {fmtNumber(1 / n)} {base}
          </p>
        )}
        <Field label="Date" hint="The day the rate applies to">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Source" hint="ECB, the bank, the contract…">
          <Input value={source} onChange={(e) => setSource(e.target.value)} />
        </Field>
        {problem && rate && <p className="sk-small sk-text-danger sk-inv-form__wide">{problem}</p>}
      </div>
    </Modal>
  );
}

function CurrencyPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="sk-inv-ratebox__cur">
      {!CURRENCIES.includes(value) && <option value={value}>{value}</option>}
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}

/* ------------------------------------------------------------------- VAT */

export function VatSection({ state, dispatch, locked }: { state: InvoiceState; dispatch: Dispatch; locked: boolean }) {
  const t = computeTotals(state);
  const cur = state.currency;
  const used = [...new Set(state.lines.map((l) => l.vatCategory))];
  const needing = used.filter((c) => CATEGORY_NEEDS_REASON[c]);
  const orphans = state.vatReasons.filter((r) => !used.includes(r.category));
  return (
    <div className="sk-inv-vat">
      {t.groups.length > 0 ? (
        <table className="sk-table sk-table--compact sk-inv-vat__table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="is-num">Taxable</th>
              <th className="is-num">VAT</th>
            </tr>
          </thead>
          <tbody>
            {t.groups.map((g) => (
              <tr key={`${g.category}${g.rate}`}>
                <td>
                  {vatCategory(g.category).label}
                  {g.category === "STANDARD" && ` · ${g.rate} %`}
                  <span className="sk-caption"> · {vatCategory(g.category).code}</span>
                </td>
                <td className="is-num">{money(g.taxable, cur)}</td>
                <td className="is-num">{money(g.tax, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="sk-small sk-text-muted">The breakdown appears with the first line.</p>
      )}
      {needing.map((c) => (
        <ReasonEditor key={c} category={c} state={state} dispatch={dispatch} locked={locked} />
      ))}
      {!locked &&
        orphans.map((r) => (
          <div key={r.category} className="sk-inv-hintbar">
            <span className="sk-small">
              A mention for {vatCategory(r.category).label.toLowerCase()} remains, but no line uses it.
            </span>
            <Button size="sm" variant="ghost" onClick={() => dispatch(actions.removeVatReason({ category: r.category }))}>
              Remove it
            </Button>
          </div>
        ))}
    </div>
  );
}

function ReasonEditor({ category, state, dispatch, locked }: { category: VatCategory; state: InvoiceState; dispatch: Dispatch; locked: boolean }) {
  const reason = state.vatReasons.find((r) => r.category === category);
  const presets = VATEX_PRESETS[category];
  const [text, setText] = useState(reason?.text ?? "");
  const [code, setCode] = useState(reason?.code ?? "");
  const dirty = (text.trim() || null) !== (reason?.text ?? null) || (code.trim() || null) !== (reason?.code ?? null);
  const label = vatCategory(category).label;
  if (locked)
    return (
      <div className="sk-inv-reason">
        <span className="sk-label">{label}: legal mention</span>
        <p className="sk-inv-reason__text">{reason?.text ?? reason?.code ?? <span className="sk-text-danger">None</span>}</p>
        {reason?.code && <span className="sk-caption">{reason.code}</span>}
      </div>
    );
  return (
    <div className={cx("sk-inv-reason", !reason && "is-missing")}>
      <span className="sk-label sk-label--required">{label}: why no VAT</span>
      {presets.length > 0 && (
        <span className="sk-inv-presets">
          {presets.map((p) => (
            <button
              key={p.text}
              type="button"
              className={cx("sk-inv-preset", text === p.text && "is-active")}
              title={p.code || undefined}
              onClick={() => {
                setText(p.text);
                setCode(p.code);
              }}
            >
              {p.text}
            </button>
          ))}
        </span>
      )}
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="The mention as it appears on the invoice" />
      <div className="sk-inv-reason__foot">
        <Input className="sk-inv-reason__code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VATEX code" aria-label="VATEX code" />
        <span className="sk-grow" />
        {dirty && (
          <Button
            size="sm"
            variant="primary"
            disabled={!text.trim() && !code.trim()}
            onClick={() => dispatch(actions.setVatReason({ category, text: text.trim() || null, code: code.trim() || null }))}
          >
            Save the mention
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- payment */

export function PaymentSection({
  state,
  dispatch,
  locked,
  closed,
  onRecord,
}: {
  state: InvoiceState;
  dispatch: Dispatch;
  locked: boolean;
  closed: boolean;
  onRecord: () => void;
}) {
  const p = state.paymentInstructions;
  const set = (patch: Parameters<typeof actions.setPaymentInstructions>[0]) => dispatch(actions.setPaymentInstructions(patch));
  const t = computeTotals(state);
  return (
    <div className="sk-inv-form">
      {locked ? (
        <ReadField label="Means" value={PAYMENT_MEANS.find((m) => m.code === p.meansCode)?.label ?? p.meansCode} />
      ) : (
        <Field label="Means">
          <Select value={p.meansCode ?? ""} onChange={(e) => set({ meansCode: e.target.value || null })}>
            <option value="">Not said</option>
            {PAYMENT_MEANS.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <TextField label="Account" hint={locked ? undefined : "An IBAN, or a wallet address"} mono value={p.account} display={formatAccount(p.account)} locked={locked} onCommit={(account) => set({ account })} />
      <TextField label="In the name of" value={p.accountName} locked={locked} onCommit={(accountName) => set({ accountName })} />
      <TextField label="BIC" value={p.bic} upper locked={locked} onCommit={(bic) => set({ bic })} />
      <TextField label="Payment reference" placeholder={state.number ?? "The invoice number"} value={p.remittance} locked={locked} onCommit={(remittance) => set({ remittance })} />
      <TextField label="Payment terms" placeholder="30 days" value={state.paymentTerms} locked={closed} onCommit={(paymentTerms) => dispatch(actions.setHeader({ paymentTerms }))} />
      {p.meansCode === "ZZZ" || p.meansText ? (
        <TextField className="sk-inv-form__wide" label="How to pay" value={p.meansText} locked={locked} onCommit={(meansText) => set({ meansText })} />
      ) : null}

      {state.status !== "DRAFT" && (
        <div className="sk-inv-form__wide sk-inv-payments">
          <span className="sk-label">
            Payments
            <span className="sk-caption">
              {" "}
              · {money(t.paid, state.currency)} of {money(t.gross + t.rounding, state.currency)}
            </span>
          </span>
          {state.payments.length > 0 && (
            <ul className="sk-file-rows">
              {state.payments.map((pay) => (
                <li key={pay.id} className="sk-file-row">
                  <span className="sk-file-row__main sk-inv-static">
                    <span className="sk-file-row__body">
                      <span className="sk-file-row__name">{money(pay.amount, state.currency)}</span>
                      <span className="sk-file-row__meta">
                        {fmtDate(pay.paidAt)} · {PAYMENT_METHOD[pay.method]}
                        {pay.transactionId && ` · ${pay.transactionId}`}
                      </span>
                    </span>
                  </span>
                  {state.status !== "VOID" && (
                    <span className="sk-file-row__actions">
                      <Button size="sm" variant="ghost" onClick={() => dispatch(actions.removePayment({ id: pay.id }))}>
                        Remove
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {state.status === "OPEN" && (
            <div className="sk-inv-actions">
              <Button size="sm" variant="secondary" icon="check" onClick={onRecord}>
                Record a payment
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- attachments */

export function AttachmentSection({
  state,
  documentId,
  dispatch,
  open,
  active,
  onShow,
}: {
  state: InvoiceState;
  documentId: string;
  dispatch: Dispatch;
  /** Anything but void takes documents */
  open: boolean;
  active: string | null;
  onShow: (id: string) => void;
}) {
  const client = useAttachments();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = (files: File[]) => {
    if (!client || !files.length) return;
    setError(null);
    setBusy(`Storing ${files.length === 1 ? files[0].name : `${files.length} files`}…`);
    (async () => {
      for (const f of files) await attachFile(client, documentId, f, { role: guessRole(f, state, false) });
    })()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };
  const { dragProps, isDragOver } = useEditorFileDrop({ onFiles: add });
  const onLines = state.lines.reduce((n, l) => n + l.attachments.length, 0);

  return (
    <div {...(open ? dragProps : {})} className={cx("sk-inv-docs", isDragOver && "is-over")}>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {state.attachments.length > 0 && (
        <ul className="sk-file-rows">
          {state.attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} active={a.id === active} open={open} onShow={() => onShow(a.id)} dispatch={dispatch} />
          ))}
        </ul>
      )}
      {open && (
        <div className={cx("sk-inv-docs__add", state.attachments.length === 0 && "is-empty")}>
          <Button variant="secondary" icon="upload" disabled={!client || busy !== null} onClick={() => input.current?.click()}>
            Add documents
          </Button>
          <span className="sk-caption">
            {client
              ? "Or drop them here: the PDF as sent, the editable original, timesheets, supporting material"
              : "Documents need a switchboard behind the drive"}
          </span>
        </div>
      )}
      {onLines > 0 && (
        <span className="sk-caption">
          And {onLines} receipt{onLines === 1 ? "" : "s"} on the lines.
        </span>
      )}
      {busy && <p className="sk-caption">{busy}</p>}
      {error && <p className="sk-small sk-text-danger">{error}</p>}
    </div>
  );
}

function AttachmentRow({
  attachment: a,
  active,
  open,
  onShow,
  dispatch,
}: {
  attachment: InvoiceAttachment;
  active: boolean;
  open: boolean;
  onShow: () => void;
  dispatch: Dispatch;
}) {
  const setRole = (role: AttachmentRole) => dispatch(actions.updateAttachment({ id: a.id, role }));
  return (
    <li className={cx("sk-file-row", active && "is-active")}>
      <button type="button" className="sk-file-row__main" onClick={onShow}>
        <FileTypeTile kind={fileKind(a.mimeType, a.fileName)} />
        <span className="sk-file-row__body">
          <span className="sk-file-row__name">{a.fileName}</span>
          <span className="sk-file-row__meta">
            {[roleLabel(a.role), a.description, bytes(a.sizeBytes), `added ${fmtDate(a.addedAt)}`].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
      {open && (
        <span className="sk-file-row__actions">
          <Menu
            label="Document actions"
            align="end"
            items={[
              ...ATTACHMENT_ROLES.map((r, i) => ({
                label: r.label,
                section: i === 0 ? "What it is" : undefined,
                active: r.value === a.role,
                onSelect: () => setRole(r.value),
              })),
              { label: "Remove", danger: true, section: "This document", onSelect: () => dispatch(actions.removeAttachment({ id: a.id })) },
            ]}
            trigger={(isOpen, toggle) => (
              <button type="button" className="sk-more" aria-haspopup="menu" aria-expanded={isOpen} aria-label="Document actions" onClick={toggle}>
                <span />
              </button>
            )}
          />
        </span>
      )}
    </li>
  );
}

/* ----------------------------------------------------------------- notes */

export function NotesSection({ state, dispatch, closed }: { state: InvoiceState; dispatch: Dispatch; closed: boolean }) {
  return (
    <TextField
      label="Notes on the invoice"
      multiline
      value={state.notes}
      placeholder="Thanks for your business"
      locked={closed}
      onCommit={(notes) => dispatch(actions.setHeader({ notes }))}
    />
  );
}
