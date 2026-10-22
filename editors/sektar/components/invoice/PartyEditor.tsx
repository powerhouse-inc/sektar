// Seller and buyer: a card each, edited in a modal (a party is one thing to
// get right, not twelve fields to commit one by one). The other party can
// come from a contact; our side from the last invoice.
import {
  actions,
  type InvoiceAction,
  type InvoiceParty,
  type InvoiceState,
  type SetBuyerInput,
} from "document-models/invoice";
import { useMemo, useState } from "react";
import {
  latestOurParty,
  partyFromContact,
  useContacts,
  useInvoices,
} from "../../kit/data.js";
import { SCHEMES } from "../../kit/invoice.js";
import { Button, cx, Field, Icon, Input, Modal, Select } from "../../kit/ui.js";

type Dispatch = (action: InvoiceAction | InvoiceAction[]) => void;
type PartyKey = keyof SetBuyerInput;

const COUNTRIES = ["BE", "NL", "LU", "FR", "DE", "DK", "CH", "GB", "IE", "ES", "IT", "PT", "AT", "SE", "NO", "FI", "PL", "US", "CA"];

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function lines(p: InvoiceParty): string[] {
  const city = [p.postalCode, p.city].filter(Boolean).join(" ");
  return [p.street, p.additionalStreet, [city, p.region].filter(Boolean).join(", "), p.country && regionName(p.country)].filter(
    (x): x is string => !!x,
  );
}

export function PartyCards({
  state,
  dispatch,
  locked,
  flagged,
}: {
  state: InvoiceState;
  dispatch: Dispatch;
  locked: boolean;
  flagged: { seller: boolean; buyer: boolean };
}) {
  const [editing, setEditing] = useState<"seller" | "buyer" | null>(null);
  const outgoing = state.direction === "OUTGOING";
  const cards = [
    { key: "seller" as const, title: "From", party: state.seller, ours: outgoing },
    { key: "buyer" as const, title: state.kind === "CREDIT_NOTE" ? "Credited to" : "Bill to", party: state.buyer, ours: !outgoing },
  ];
  return (
    <div className="sk-inv-parties">
      {cards.map((c) => (
        <PartyCard
          key={c.key}
          title={c.title}
          ours={c.ours}
          party={c.party}
          locked={locked}
          flagged={flagged[c.key]}
          onEdit={() => setEditing(c.key)}
        />
      ))}
      {editing && (
        <PartyModal
          which={editing}
          state={state}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (Object.keys(patch).length)
              dispatch(editing === "seller" ? actions.setSeller(patch) : actions.setBuyer(patch));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * A party read in full, for a preview pane: who, where, and every identifier
 * the invoice carries for them. Nothing to edit here; the editor does that.
 */
export function PartyDetails({ role, party, ours }: { role: string; party: InvoiceParty; ours: boolean }) {
  const ids: [string, string | null][] = [
    ["VAT number", party.vatId ?? null],
    ["Registration", party.registrationId ? `${party.registrationScheme ? `${party.registrationScheme}: ` : ""}${party.registrationId}` : null],
    ["Peppol address", party.endpointId ? `${party.endpointScheme ? `${party.endpointScheme}:` : ""}${party.endpointId}` : null],
    ["Email", party.email ?? null],
    ["Phone", party.phone ?? null],
  ];
  return (
    <div className="sk-inv-partyview">
      <div className="sk-inv-party__top">
        <span className="sk-eyebrow">{role}</span>
        {ours && <span className="sk-inv-party__ours">You</span>}
      </div>
      {party.name ? (
        <>
          <h3 className="sk-inv-partyview__name">{party.name}</h3>
          <address className="sk-inv-partyview__address">
            {lines(party).map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
          <dl className="sk-inv-partyview__ids">
            {ids.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={cx(!value && "sk-text-muted")}>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="sk-small sk-text-muted">Not filled in on this invoice.</p>
      )}
    </div>
  );
}

function PartyCard({
  title,
  ours,
  party,
  locked,
  flagged,
  onEdit,
}: {
  title: string;
  ours: boolean;
  party: InvoiceParty;
  locked: boolean;
  flagged: boolean;
  onEdit: () => void;
}) {
  const empty = !party.name;
  const body = (
    <>
      <span className="sk-inv-party__top">
        <span className="sk-eyebrow">{title}</span>
        {ours && <span className="sk-inv-party__ours">You</span>}
        {flagged && <span className="sk-inv-flag" title="Something to check here">!</span>}
        {!locked && <Icon name="chevron-right" className="sk-inv-party__go" />}
      </span>
      {empty ? (
        <span className="sk-inv-party__empty">
          <Icon name="plus-circle" />
          {ours ? "Add your company details" : "Add who this is for"}
        </span>
      ) : (
        <>
          <span className="sk-inv-party__name">{party.name}</span>
          {lines(party).map((l) => (
            <span key={l} className="sk-inv-party__line">
              {l}
            </span>
          ))}
          <span className="sk-inv-party__ids">
            {party.vatId && <span>VAT {party.vatId}</span>}
            {party.registrationId && party.registrationId !== party.vatId && <span>No. {party.registrationId}</span>}
            {party.endpointId && (
              <span title="Peppol address">
                Peppol {party.endpointScheme ? `${party.endpointScheme}:` : ""}
                {party.endpointId}
              </span>
            )}
          </span>
        </>
      )}
    </>
  );
  return locked ? (
    <div className={cx("sk-inv-party", empty && "is-empty")}>{body}</div>
  ) : (
    <button type="button" className={cx("sk-inv-party", empty && "is-empty", flagged && "is-flagged")} onClick={onEdit}>
      {body}
    </button>
  );
}

function PartyModal({
  which,
  state,
  onClose,
  onSave,
}: {
  which: "seller" | "buyer";
  state: InvoiceState;
  onClose: () => void;
  onSave: (patch: SetBuyerInput) => void;
}) {
  const current = state[which];
  const ours = (which === "seller") === (state.direction === "OUTGOING");
  const [draft, setDraft] = useState<Record<PartyKey, string>>(() => toDraft(current));
  const contacts = useContacts();
  const invoices = useInvoices();
  const last = useMemo(() => latestOurParty(invoices, state.direction), [invoices, state.direction]);
  const pool = contacts.filter((c) => c.state.global.status === "ACTIVE");
  const set = (key: PartyKey) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  // Copies what the source has; fields it leaves out keep what was typed.
  const fill = (p: SetBuyerInput) =>
    setDraft((d) => {
      const next = { ...d };
      for (const k of KEYS) if (p[k] !== undefined) next[k] = p[k] ?? "";
      return next;
    });

  const save = () => {
    const patch: SetBuyerInput = {};
    for (const key of Object.keys(draft) as PartyKey[]) {
      const next = draft[key].trim() || null;
      if (next !== (current[key] ?? null)) patch[key] = next;
    }
    onSave(patch);
  };

  return (
    <Modal
      title={ours ? "Your company on this invoice" : which === "buyer" ? "Who this invoice is for" : "Who sent this bill"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="sk-inv-form sk-inv-party-form">
        {!ours && pool.length > 0 && (
          <Field label="From a contact" hint="Copies the contact's details onto the invoice" className="sk-inv-form__wide">
            <Select
              value={draft.contactId}
              onChange={(e) => {
                const c = pool.find((x) => x.header.id === e.target.value);
                if (c) fill(partyFromContact(c));
                else setDraft((d) => ({ ...d, contactId: "" }));
              }}
            >
              <option value="">Not linked to a contact</option>
              {pool.map((c) => (
                <option key={c.header.id} value={c.header.id}>
                  {c.state.global.name ?? "Unnamed contact"}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {ours && last && (
          <div className="sk-inv-form__wide sk-inv-hintbar">
            <span className="sk-small">Your details as on your last invoice: {last.name}</span>
            <Button size="sm" variant="soft" onClick={() => fill(last)}>
              Use them
            </Button>
          </div>
        )}
        <Field label="Name" required className="sk-inv-form__wide">
          <Input value={draft.name} onChange={set("name")} placeholder="Company or person" autoFocus />
        </Field>
        <Field label="Street">
          <Input value={draft.street} onChange={set("street")} />
        </Field>
        <Field label="Address line 2">
          <Input value={draft.additionalStreet} onChange={set("additionalStreet")} />
        </Field>
        <div className="sk-inv-form__pair">
          <Field label="Postal code">
            <Input value={draft.postalCode} onChange={set("postalCode")} />
          </Field>
          <Field label="City">
            <Input value={draft.city} onChange={set("city")} />
          </Field>
        </div>
        <div className="sk-inv-form__pair">
          <Field label="Region">
            <Input value={draft.region} onChange={set("region")} />
          </Field>
          <Field label="Country" required hint="Two letters: BE, CH, DK…">
            <Input
              value={draft.country}
              onChange={set("country")}
              list="sk-inv-countries"
              maxLength={2}
              style={{ textTransform: "uppercase" }}
            />
          </Field>
        </div>
        <datalist id="sk-inv-countries">
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {regionName(c)}
            </option>
          ))}
        </datalist>
        <Field label="VAT number" hint="With the country prefix, e.g. BE0545965488">
          <Input value={draft.vatId} onChange={set("vatId")} />
        </Field>
        <div className="sk-inv-form__pair">
          <Field label="Company number">
            <Input value={draft.registrationId} onChange={set("registrationId")} />
          </Field>
          <Field label="Number scheme">
            <SchemeSelect value={draft.registrationScheme} onChange={set("registrationScheme")} />
          </Field>
        </div>
        <div className="sk-inv-form__pair">
          <Field label="Peppol address" hint="Where Peppol delivers the invoice">
            <Input value={draft.endpointId} onChange={set("endpointId")} placeholder={draft.registrationId || undefined} />
          </Field>
          <Field label="Address scheme">
            <SchemeSelect value={draft.endpointScheme} onChange={set("endpointScheme")} />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" value={draft.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input value={draft.phone} onChange={set("phone")} />
        </Field>
      </div>
    </Modal>
  );
}

function SchemeSelect({ value, onChange }: { value: string; onChange: (e: { target: { value: string } }) => void }) {
  const known = SCHEMES.some((s) => s.code === value);
  return (
    <Select value={value} onChange={onChange}>
      <option value="">None</option>
      {!known && value && <option value={value}>{value}</option>}
      {SCHEMES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}

const KEYS: PartyKey[] = [
  "name",
  "contactId",
  "vatId",
  "registrationId",
  "registrationScheme",
  "endpointId",
  "endpointScheme",
  "email",
  "phone",
  "street",
  "additionalStreet",
  "postalCode",
  "city",
  "region",
  "country",
];

function toDraft(p: Partial<Record<PartyKey, string | null | undefined>>): Record<PartyKey, string> {
  return Object.fromEntries(KEYS.map((k) => [k, p[k] ?? ""])) as Record<PartyKey, string>;
}
