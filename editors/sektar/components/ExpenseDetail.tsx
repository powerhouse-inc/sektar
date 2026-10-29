// One expense claim: items, totals, the approval trail and the actions for
// the current status. Shared by the expenses board and the document editor.
import type {
  ExpenseReportDocument,
  ExpenseStatus,
  PaidWith,
} from "document-models/expense-report";
import type { TransactionCategory } from "document-models/bank-account";
import { useState } from "react";
import {
  addExpenseItem,
  approveReport,
  reimburseReport,
  rejectReport,
  removeExpenseItem,
  submitReport,
} from "../kit/data.js";
import {
  CATEGORY,
  CATEGORY_ORDER,
  EXPENSE_FLOW,
  EXPENSE_STATUS,
  expenseReimbursable,
  expenseTotal,
  fmtDate,
  fromDateInput,
  money,
  PAID_WITH,
  toDateInput,
  plural,
} from "../kit/format.js";
import { COMPANY } from "../kit/seed.js";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  DetailHeader,
  Field,
  Icon,
  Input,
  MetaStrip,
  Modal,
  Select,
  Steps,
  Table,
  Textarea,
  cx,
} from "../kit/ui.js";

/** Where a claim stands; the board passes its index row's status, the detail its document's. */
export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const { label, tone } = EXPENSE_STATUS[status];
  return (
    <Badge tone={tone} dot={status === "SUBMITTED"}>
      {label}
    </Badge>
  );
}

export function ExpenseDetail({ doc }: { doc: ExpenseReportDocument }) {
  const s = doc.state.global;
  const id = doc.header.id;
  const editable = s.status === "DRAFT" || s.status === "REJECTED";
  const total = expenseTotal(s);
  const reimbursable = expenseReimbursable(s);
  const [dialog, setDialog] = useState<"reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    void fn().finally(() => {
      setBusy(false);
      setDialog(null);
    });
  };

  return (
    <div className="sk-stack sk-stack--6">
      <DetailHeader
        media={<Avatar name={s.submitter.name} size="lg" variant="sage" />}
        name={s.title ?? "Expense claim"}
        sub={
          <>
            <b>{money(total, s.currency)}</b> ·{" "}
            {plural(s.items.length, "receipt")}
            {s.submitter.name ? ` · ${s.submitter.name}` : ""}
          </>
        }
        tags={<ExpenseStatusBadge status={s.status} />}
        actions={
          <>
          {editable && (
            <Button
              variant="primary"
              icon="arrow-right"
              disabled={busy || s.items.length === 0}
              onClick={() => run(() => submitReport(id))}
            >
              Submit for approval
            </Button>
          )}
          {s.status === "SUBMITTED" && (
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setDialog("reject")}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                icon="check"
                disabled={busy}
                onClick={() => run(() => approveReport(id, COMPANY.owner))}
              >
                Approve
              </Button>
            </>
          )}
          {s.status === "APPROVED" && (
            <Button
              variant="primary"
              icon="check-circle"
              disabled={busy}
              onClick={() => run(() => reimburseReport(id))}
            >
              Mark reimbursed
            </Button>
          )}
          </>
        }
      />

      <MetaStrip
        items={[
          { label: "Total", value: money(total, s.currency), icon: "wallet" },
          {
            label: "To reimburse",
            value: money(reimbursable, s.currency),
            icon: "customers",
          },
          {
            label: "Receipts attached",
            value: `${s.items.filter((i) => i.receiptName).length} of ${s.items.length}`,
            icon: "upload",
          },
        ]}
      />

      <div className="sk-card sk-card--subtle sk-card--compact">
        <Timeline
          status={s.status}
          submittedAt={s.submittedAt}
          decidedAt={s.decidedAt}
          reimbursedAt={s.reimbursedAt}
        />
      </div>

      <Table compact>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Category</th>
            <th>Paid with</th>
            <th className="is-num">Amount</th>
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {s.items.map((it) => (
            <tr key={it.id}>
              <td className="is-muted sk-nowrap">{fmtDate(it.spentAt)}</td>
              <td>
                <div className="sk-table__primary">{it.merchant}</div>
                {it.note && (
                  <div className="sk-table__secondary">{it.note}</div>
                )}
                {it.receiptName && (
                  <div className="sk-mt-1">
                    <Chip
                      name={it.receiptName}
                      kind={
                        /\.(png|jpe?g|heic|webp)$/i.test(it.receiptName)
                          ? "img"
                          : "pdf"
                      }
                    />
                  </div>
                )}
              </td>
              <td>
                <Badge tone={CATEGORY[it.category].tone}>
                  {CATEGORY[it.category].label}
                </Badge>
              </td>
              <td className="is-muted">{PAID_WITH[it.paidWith]}</td>
              <td className="is-num">{money(it.amount, s.currency)}</td>
              {editable && (
                <td className="is-num">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="close"
                    aria-label="Remove"
                    onClick={() => void removeExpenseItem(id, it.id)}
                  />
                </td>
              )}
            </tr>
          ))}
          {s.items.length === 0 && (
            <tr>
              <td colSpan={editable ? 6 : 5} className="is-muted">
                No expenses on this claim yet.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {editable && <AddItemForm reportId={id} currency={s.currency} />}

      {s.decisionNote && (
        <div
          className={cx(
            "sk-alert",
            s.status === "REJECTED" ? "sk-alert--danger" : "sk-alert--success",
          )}
        >
          <Icon
            name={s.status === "REJECTED" ? "info" : "check-circle"}
            size={20}
          />
          <div>
            <div className="sk-alert__title">
              {s.status === "REJECTED" ? "Rejected" : "Approved"} by{" "}
              {s.decidedBy} · {fmtDate(s.decidedAt)}
            </div>
            {s.decisionNote}
          </div>
        </div>
      )}

      {dialog === "reject" && (
        <RejectDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onReject={(note) => run(() => rejectReport(id, COMPANY.owner, note))}
        />
      )}
    </div>
  );
}

function Timeline({
  status,
  submittedAt,
  decidedAt,
  reimbursedAt,
}: {
  status: ExpenseReportDocument["state"]["global"]["status"];
  submittedAt?: string | null;
  decidedAt?: string | null;
  reimbursedAt?: string | null;
}) {
  // Steps before the current one are done; the current one is the status
  // reached. A rejection ends the flow at the decision step.
  const current = status === "REJECTED" ? 2 : EXPENSE_FLOW.indexOf(status);
  return (
    <Steps
      current={current}
      failed={status === "REJECTED" ? 2 : undefined}
      steps={[
        { title: "Draft", desc: "Receipts collected" },
        {
          title: "Submitted",
          desc: "Waiting on a decision",
          meta: submittedAt ? fmtDate(submittedAt) : undefined,
        },
        {
          title: status === "REJECTED" ? "Rejected" : "Approved",
          desc:
            status === "REJECTED"
              ? "Returned to the submitter"
              : "Ready to reimburse",
          meta: decidedAt ? fmtDate(decidedAt) : undefined,
        },
        {
          title: "Reimbursed",
          desc: "Paid out",
          meta: reimbursedAt ? fmtDate(reimbursedAt) : undefined,
        },
      ]}
    />
  );
}

function AddItemForm({
  reportId,
  currency,
}: {
  reportId: string;
  currency: string;
}) {
  const [spentAt, setSpentAt] = useState(toDateInput(new Date().toISOString()));
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("TRAVEL");
  const [amount, setAmount] = useState("");
  const [paidWith, setPaidWith] = useState<PaidWith>("PERSONAL");
  const [note, setNote] = useState("");
  const valid = merchant.trim() && Number(amount) > 0;
  return (
    <form
      className="sk-card sk-card--subtle sk-card--compact sk-stack sk-stack--3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void addExpenseItem(reportId, {
          spentAt: fromDateInput(spentAt),
          merchant: merchant.trim(),
          category,
          amount: Number(amount),
          vatAmount: Math.round(((Number(amount) * 0.21) / 1.21) * 100) / 100,
          paidWith,
          note: note.trim() || null,
        });
        setMerchant("");
        setAmount("");
        setNote("");
      }}
    >
      <div className="sk-eyebrow">Add an expense</div>
      <div className="sk-row sk-row--2 sk-row--wrap sk-row--start">
        <Field label="Date" style={{ width: 150 }}>
          <Input
            type="date"
            value={spentAt}
            onChange={(e) => setSpentAt(e.target.value)}
          />
        </Field>
        <Field label="Merchant" className="sk-grow">
          <Input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Where"
          />
        </Field>
        <Field label="Category" style={{ width: 150 }}>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as TransactionCategory)}
          >
            {CATEGORY_ORDER.filter(
              (c) => c !== "UNCATEGORIZED" && c !== "SALES" && c !== "TRANSFER",
            ).map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Amount (${currency})`} style={{ width: 130 }}>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Paid with" style={{ width: 170 }}>
          <Select
            value={paidWith}
            onChange={(e) => setPaidWith(e.target.value as PaidWith)}
          >
            {(Object.keys(PAID_WITH) as PaidWith[]).map((p) => (
              <option key={p} value={p}>
                {PAID_WITH[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="sk-row sk-row--2 sk-row--start">
        <Field label="Note" className="sk-grow">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <div style={{ paddingTop: 26 }}>
          <Button variant="soft" icon="plus" disabled={!valid}>
            Add
          </Button>
        </div>
      </div>
    </form>
  );
}

function RejectDialog({
  busy,
  onClose,
  onReject,
}: {
  busy: boolean;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Modal
      title="Reject this claim?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy || !note.trim()}
            onClick={() => onReject(note.trim())}
          >
            Reject
          </Button>
        </>
      }
    >
      <div className="sk-stack sk-stack--3">
        <p className="sk-text-secondary">
          The submitter can fix the claim and resubmit it. Tell them what to
          change.
        </p>
        <Field label="Reason" required>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Missing receipt for…"
          />
        </Field>
      </div>
    </Modal>
  );
}
