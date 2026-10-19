// One contact: profile, address, bank details, terms, tags, people, and the
// invoices and transactions that reference it.
import type { TransactionCategory } from "document-models/bank-account";
import type { ContactDocument, ContactKind } from "document-models/contact";
import { useState } from "react";
import {
  addContactPerson,
  addContactTag,
  archiveContact,
  removeContactPerson,
  removeContactTag,
  setContactAddress,
  setContactBank,
  setContactProfile,
  setContactTerms,
  useInvoices,
  useTransactions,
} from "../kit/data.js";
import {
  CATEGORY,
  CATEGORY_ORDER,
  CONTACT_KIND,
  fmtDate,
  invoiceTotals,
  money,
  plural,
} from "../kit/format.js";
import {
  Avatar,
  Badge,
  Button,
  DetailHeader,
  Field,
  Icon,
  Input,
  Select,
  Table,
  Textarea,
} from "../kit/ui.js";
import { InvoiceStatusBadge } from "./InvoiceDetail.js";

export function ContactKindBadge({ doc }: { doc: ContactDocument }) {
  const { label, tone } = CONTACT_KIND[doc.state.global.kind];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ContactDetail({
  doc,
  onOpenInvoice,
}: {
  doc: ContactDocument;
  onOpenInvoice?: (invoiceId: string) => void;
}) {
  const s = doc.state.global;
  const id = doc.header.id;
  const invoices = useInvoices().filter(
    (i) => i.state.global.counterparty.contactId === id,
  );
  const transactions = useTransactions().filter(
    ({ tx }) => tx.contactId === id,
  );
  const [editing, setEditing] = useState(false);
  const open = invoices.filter((i) => i.state.global.status === "OPEN");
  const openTotal = open.reduce(
    (sum, i) => sum + invoiceTotals(i.state.global).outstanding,
    0,
  );

  return (
    <div className="sk-stack sk-stack--6">
      <DetailHeader
        media={
          <Avatar
            name={s.name}
            size="lg"
            variant={s.kind === "CUSTOMER" ? "sage" : "forest"}
          />
        }
        name={s.name ?? "Contact"}
        sub={
          [s.email, s.phone, s.website].filter(Boolean).join(" · ") ||
          "No contact details yet"
        }
        tags={
          <>
            <ContactKindBadge doc={doc} />
            {s.status === "ARCHIVED" && <Badge tone="neutral">Archived</Badge>}
            {s.tags.map((t) => (
              <Badge key={t} tone="outline">
                {t}
              </Badge>
            ))}
          </>
        }
        actions={
          <>
          <Button
            variant={editing ? "soft" : "secondary"}
            icon={editing ? "check" : "settings"}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void archiveContact(id, s.status !== "ARCHIVED")}
          >
            {s.status === "ARCHIVED" ? "Restore" : "Archive"}
          </Button>
          </>
        }
      />

      {editing ? (
        <EditForms doc={doc} />
      ) : (
        <div className="sk-grid sk-grid--3">
          <div className="sk-card sk-card--subtle sk-card--compact sk-stack sk-stack--2">
            <div className="sk-eyebrow">Address</div>
            {s.address.street || s.address.city ? (
              <div className="sk-small">
                {s.address.street && <div>{s.address.street}</div>}
                <div>
                  {[s.address.postalCode, s.address.city]
                    .filter(Boolean)
                    .join(" ")}
                </div>
                {s.address.country && (
                  <div className="sk-text-muted">{s.address.country}</div>
                )}
              </div>
            ) : (
              <div className="sk-small sk-text-muted">Not set</div>
            )}
            {s.vatId && <div className="sk-caption">VAT {s.vatId}</div>}
            {s.registrationNumber && (
              <div className="sk-caption">Reg. {s.registrationNumber}</div>
            )}
          </div>
          <div className="sk-card sk-card--subtle sk-card--compact sk-stack sk-stack--2">
            <div className="sk-eyebrow">Bank</div>
            {s.bank.iban ? (
              <div className="sk-small">
                <div className="sk-font-mono">{s.bank.iban}</div>
                <div className="sk-text-muted">
                  {[s.bank.bic, s.bank.accountHolder]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            ) : (
              <div className="sk-small sk-text-muted">No bank details</div>
            )}
          </div>
          <div className="sk-card sk-card--subtle sk-card--compact sk-stack sk-stack--2">
            <div className="sk-eyebrow">Terms</div>
            <div className="sk-small">
              {s.paymentTermsDays === 0
                ? "Due on receipt"
                : plural(s.paymentTermsDays, "day")}
            </div>
            <div className="sk-row sk-row--2 sk-small">
              <span className="sk-text-muted">Default category</span>
              <Badge tone={CATEGORY[s.defaultCategory].tone}>
                {CATEGORY[s.defaultCategory].label}
              </Badge>
            </div>
            {open.length > 0 && (
              <div className="sk-small">
                <span className="sk-text-muted">Open</span> {open.length} ·{" "}
                {money(openTotal)}
              </div>
            )}
          </div>
        </div>
      )}

      <section className="sk-stack sk-stack--3">
        <div className="sk-row sk-row--between">
          <div className="sk-eyebrow">People</div>
          <AddPerson contactId={id} />
        </div>
        {s.people.length === 0 ? (
          <div className="sk-small sk-text-muted">No people yet.</div>
        ) : (
          <ul className="sk-list sk-list--divided">
            {s.people.map((p) => (
              <li key={p.id} className="sk-list-item">
                <Avatar name={p.name} size="sm" />
                <span className="sk-list-item__body">
                  <span className="sk-list-item__title">{p.name}</span>
                  <span className="sk-list-item__meta">
                    {[p.role, p.email, p.phone].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon="close"
                  aria-label="Remove person"
                  onClick={() => void removeContactPerson(id, p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoices.length > 0 && (
        <section className="sk-stack sk-stack--3">
          <div className="sk-eyebrow">Invoices</div>
          <Table compact>
            <thead>
              <tr>
                <th>Number</th>
                <th>Issued</th>
                <th>Status</th>
                <th className="is-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.header.id}
                  onClick={
                    onOpenInvoice
                      ? () => onOpenInvoice(inv.header.id)
                      : undefined
                  }
                  style={onOpenInvoice ? { cursor: "pointer" } : undefined}
                >
                  <td className="sk-weight-medium">
                    {inv.state.global.number ?? "Draft"}
                  </td>
                  <td className="is-muted">
                    {fmtDate(inv.state.global.issuedAt)}
                  </td>
                  <td>
                    <InvoiceStatusBadge doc={inv} />
                  </td>
                  <td className="is-num">
                    {money(
                      invoiceTotals(inv.state.global).gross,
                      inv.state.global.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {transactions.length > 0 && (
        <section className="sk-stack sk-stack--3">
          <div className="sk-eyebrow">Bank activity</div>
          <Table compact>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th className="is-num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 8).map(({ tx, account }) => (
                <tr key={tx.id}>
                  <td className="is-muted sk-nowrap">{fmtDate(tx.bookedAt)}</td>
                  <td>{tx.description ?? tx.counterparty}</td>
                  <td className="is-muted">{account.state.global.name}</td>
                  <td
                    className={
                      tx.amount > 0 ? "is-num sk-amount--in" : "is-num"
                    }
                  >
                    {money(tx.amount, account.state.global.currency, {
                      signed: true,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {s.notes && !editing && (
        <p className="sk-small sk-text-secondary">{s.notes}</p>
      )}
    </div>
  );
}

function EditForms({ doc }: { doc: ContactDocument }) {
  const s = doc.state.global;
  const id = doc.header.id;
  const [profile, setProfile] = useState({
    name: s.name ?? "",
    kind: s.kind,
    email: s.email ?? "",
    phone: s.phone ?? "",
    website: s.website ?? "",
    vatId: s.vatId ?? "",
    registrationNumber: s.registrationNumber ?? "",
    notes: s.notes ?? "",
  });
  const [address, setAddress] = useState({
    street: s.address.street ?? "",
    postalCode: s.address.postalCode ?? "",
    city: s.address.city ?? "",
    country: s.address.country ?? "",
  });
  const [bank, setBank] = useState({
    iban: s.bank.iban ?? "",
    bic: s.bank.bic ?? "",
    accountHolder: s.bank.accountHolder ?? "",
  });
  const [terms, setTerms] = useState({
    days: String(s.paymentTermsDays),
    category: s.defaultCategory,
  });
  const [tag, setTag] = useState("");
  const nul = (v: string) => v.trim() || null;
  const saveProfile = () =>
    void setContactProfile(id, {
      name: profile.name.trim() || s.name || "Contact",
      kind: profile.kind,
      email: nul(profile.email),
      phone: nul(profile.phone),
      website: nul(profile.website),
      vatId: nul(profile.vatId),
      registrationNumber: nul(profile.registrationNumber),
      notes: nul(profile.notes),
    });
  return (
    <div className="sk-stack sk-stack--4">
      <div className="sk-grid sk-grid--2">
        <Field label="Name" required>
          <Input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            onBlur={saveProfile}
          />
        </Field>
        <Field label="Relationship">
          <Select
            value={profile.kind}
            onChange={(e) => {
              const kind = e.target.value as ContactKind;
              setProfile({ ...profile, kind });
              void setContactProfile(id, { kind });
            }}
          >
            {(Object.keys(CONTACT_KIND) as ContactKind[]).map((k) => (
              <option key={k} value={k}>
                {CONTACT_KIND[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            onBlur={saveProfile}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            onBlur={saveProfile}
          />
        </Field>
        <Field label="Website">
          <Input
            value={profile.website}
            onChange={(e) =>
              setProfile({ ...profile, website: e.target.value })
            }
            onBlur={saveProfile}
          />
        </Field>
        <Field label="VAT ID">
          <Input
            value={profile.vatId}
            onChange={(e) => setProfile({ ...profile, vatId: e.target.value })}
            onBlur={saveProfile}
          />
        </Field>
      </div>
      <div className="sk-grid sk-grid--4">
        <Field label="Street" className="sk-span-2">
          <Input
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
            onBlur={() => void setContactAddress(id, address)}
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={address.postalCode}
            onChange={(e) =>
              setAddress({ ...address, postalCode: e.target.value })
            }
            onBlur={() => void setContactAddress(id, address)}
          />
        </Field>
        <Field label="City">
          <Input
            value={address.city}
            onChange={(e) => setAddress({ ...address, city: e.target.value })}
            onBlur={() => void setContactAddress(id, address)}
          />
        </Field>
        <Field label="Country">
          <Input
            value={address.country}
            onChange={(e) =>
              setAddress({ ...address, country: e.target.value })
            }
            onBlur={() => void setContactAddress(id, address)}
          />
        </Field>
        <Field label="IBAN">
          <Input
            value={bank.iban}
            onChange={(e) => setBank({ ...bank, iban: e.target.value })}
            onBlur={() => void setContactBank(id, bank)}
          />
        </Field>
        <Field label="BIC">
          <Input
            value={bank.bic}
            onChange={(e) => setBank({ ...bank, bic: e.target.value })}
            onBlur={() => void setContactBank(id, bank)}
          />
        </Field>
        <Field label="Account holder">
          <Input
            value={bank.accountHolder}
            onChange={(e) =>
              setBank({ ...bank, accountHolder: e.target.value })
            }
            onBlur={() => void setContactBank(id, bank)}
          />
        </Field>
      </div>
      <div className="sk-grid sk-grid--3">
        <Field label="Payment terms (days)">
          <Input
            type="number"
            min={0}
            value={terms.days}
            onChange={(e) => setTerms({ ...terms, days: e.target.value })}
            onBlur={() =>
              void setContactTerms(
                id,
                Math.max(0, Number(terms.days) || 0),
                terms.category,
              )
            }
          />
        </Field>
        <Field label="Default category">
          <Select
            value={terms.category}
            onChange={(e) => {
              const category = e.target.value as TransactionCategory;
              setTerms({ ...terms, category });
              void setContactTerms(id, Number(terms.days) || 0, category);
            }}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" hint="Enter to add">
          <div className="sk-row sk-row--2 sk-row--wrap">
            {s.tags.map((t) => (
              <span
                key={t}
                className="sk-badge sk-badge--outline sk-row sk-row--2"
                style={{ gap: 4 }}
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => void removeContactTag(id, t)}
                  style={{
                    border: 0,
                    background: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                  }}
                >
                  <Icon name="close" size={16} mono />
                </button>
              </span>
            ))}
            <Input
              size="sm"
              value={tag}
              placeholder="Add tag"
              style={{ width: 120 }}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tag.trim()) {
                  e.preventDefault();
                  void addContactTag(id, tag.trim());
                  setTag("");
                }
              }}
            />
          </div>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea
          value={profile.notes}
          onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
          onBlur={saveProfile}
        />
      </Field>
    </div>
  );
}

function AddPerson({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  if (!open)
    return (
      <Button
        variant="ghost"
        size="sm"
        icon="plus"
        onClick={() => setOpen(true)}
      >
        Add person
      </Button>
    );
  return (
    <form
      className="sk-row sk-row--2 sk-row--wrap"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        void addContactPerson(contactId, {
          name: name.trim(),
          role: role.trim() || undefined,
          email: email.trim() || undefined,
        });
        setName("");
        setRole("");
        setEmail("");
        setOpen(false);
      }}
    >
      <Input
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        style={{ width: 140 }}
        autoFocus
      />
      <Input
        size="sm"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role"
        style={{ width: 120 }}
      />
      <Input
        size="sm"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        style={{ width: 180 }}
      />
      <Button variant="soft" size="sm" disabled={!name.trim()}>
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
