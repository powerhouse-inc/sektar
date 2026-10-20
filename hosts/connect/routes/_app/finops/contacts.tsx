import { createFileRoute } from "@tanstack/react-router";
import type { ContactDocument, ContactKind } from "document-models/contact";
import { useEffect, useState } from "react";
import {
  ContactDetail,
  ContactKindBadge,
} from "../../../../../editors/sektar/components/ContactDetail.js";
import {
  InvoiceDetail,
} from "../../../../../editors/sektar/components/InvoiceDetail.js";
import {
  useContacts,
  useInvoices,
  useSektarDrive,
  useTransactions,
} from "../../../../../editors/sektar/kit/data.js";
import {
  counterparty,
  bookTotals,
  invoiceTotals,
  money,
  plural,
} from "../../../../../editors/sektar/kit/format.js";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ListItem,
  PageHeader,
  Pills,
  SidePanel,
} from "../../../../../editors/sektar/kit/ui.js";
import artDark from "../../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import artLight from "../../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-light.svg";
import { NewContactPanel } from "../../-shared/forms.js";
import { matches, useSearch } from "../../-shared/search.js";
import { SetupState } from "../../-shared/setup.js";

export const Route = createFileRoute("/_app/finops/contacts")({
  validateSearch: (raw: Record<string, unknown>): { open?: string } => ({
    ...(typeof raw.open === "string" ? { open: raw.open } : {}),
  }),
  head: () => ({ meta: [{ title: "Contacts · Sektar" }] }),
  component: ContactsPage,
});

type Filter = "ALL" | "CUSTOMERS" | "SUPPLIERS" | "ARCHIVED";

function ContactsPage() {
  const drive = useSektarDrive();
  const contacts = useContacts();
  const invoices = useInvoices();
  const rows = useTransactions();
  const { query } = useSearch();
  const [filter, setFilter] = useState<Filter>("ALL");
  const { open: openParam } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(
    openParam ?? null,
  );
  useEffect(() => {
    if (openParam) setSelectedId(openParam);
  }, [openParam]);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const isKind = (c: ContactDocument, kinds: ContactKind[]) =>
    kinds.includes(c.state.global.kind);
  const visible = contacts
    .filter((c) =>
      filter === "ARCHIVED"
        ? c.state.global.status === "ARCHIVED"
        : c.state.global.status === "ACTIVE",
    )
    .filter((c) =>
      filter === "CUSTOMERS"
        ? isKind(c, ["CUSTOMER", "BOTH"])
        : filter === "SUPPLIERS"
          ? isKind(c, ["SUPPLIER", "BOTH"])
          : true,
    )
    .filter((c) =>
      matches(
        query,
        c.state.global.name,
        c.state.global.email,
        c.state.global.address.city,
        ...c.state.global.tags,
      ),
    )
    .sort((a, b) =>
      (a.state.global.name ?? "").localeCompare(b.state.global.name ?? ""),
    );
  const selected = contacts.find((c) => c.header.id === selectedId);
  const openInvoice = invoices.find((i) => i.header.id === invoiceId);

  const openFor = (id: string) =>
    invoices.filter(
      (i) =>
        counterparty(i.state.global).contactId === id &&
        i.state.global.status === "OPEN",
    );
  const activityFor = (id: string) =>
    rows.filter((r) => r.tx.contactId === id).length;
  const active = contacts.filter((c) => c.state.global.status === "ACTIVE");
  const counts: Record<Filter, number> = {
    ALL: active.length,
    CUSTOMERS: active.filter((c) => isKind(c, ["CUSTOMER", "BOTH"])).length,
    SUPPLIERS: active.filter((c) => isKind(c, ["SUPPLIER", "BOTH"])).length,
    ARCHIVED: contacts.length - active.length,
  };

  if (!drive || contacts.length === 0) return <SetupState what="contacts" />;

  return (
    <div className="sk-page sk-stack sk-stack--6">
      <PageHeader
        eyebrow="Customers & suppliers"
        title="Contacts"
        lead="Everyone you invoice and everyone who invoices you."
        art={{ light: artLight, dark: artDark }}
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setCreating(true)}
          >
            New contact
          </Button>
        }
      />

      <Pills
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "ALL", label: "All", count: counts.ALL },
          { value: "CUSTOMERS", label: "Customers", count: counts.CUSTOMERS },
          { value: "SUPPLIERS", label: "Suppliers", count: counts.SUPPLIERS },
          { value: "ARCHIVED", label: "Archived", count: counts.ARCHIVED },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState icon="customers" title="No contacts here">
          {query
            ? `Nothing matches “${query}”.`
            : "Add a customer or supplier to get going."}
        </EmptyState>
      ) : (
        <Card compact className="sk-p-0">
          <ul className="sk-list sk-list--rich">
            {visible.map((c) => {
              const s = c.state.global;
              const open = openFor(c.header.id);
              const outstanding = open.reduce(
                (sum, i) => sum + bookTotals(i.state.global).outstanding,
                0,
              );
              return (
                <li key={c.header.id}>
                  <ListItem
                    rich
                    selected={selectedId === c.header.id}
                    onClick={() => setSelectedId(c.header.id)}
                    icon={
                      <Avatar
                        name={s.name}
                        variant={s.kind === "CUSTOMER" ? "sage" : "forest"}
                      />
                    }
                    title={s.name}
                    sub={[
                      [s.address.city, s.address.country]
                        .filter(Boolean)
                        .join(", ") || s.email,
                      `${
                        s.paymentTermsDays === 0
                          ? "On receipt"
                          : `${s.paymentTermsDays}-day terms`
                      } · ${plural(activityFor(c.header.id), "transaction")}`,
                    ].filter(Boolean)}
                    tags={
                      s.tags.length > 0
                        ? s.tags.map((t) => (
                            <Badge key={t} tone="outline">
                              {t}
                            </Badge>
                          ))
                        : undefined
                    }
                    aside={
                      <>
                        <ContactKindBadge doc={c} />
                        {open.length > 0 ? (
                          <span className="sk-small sk-weight-medium sk-tabular sk-text">
                            {money(outstanding)} open
                          </span>
                        ) : (
                          <span>Settled</span>
                        )}
                      </>
                    }
                    chevron
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {selected && (
        <SidePanel eyebrow="Contact" onClose={() => setSelectedId(null)}>
          <ContactDetail
            doc={selected}
            onOpenInvoice={(id) => setInvoiceId(id)}
          />
        </SidePanel>
      )}
      {openInvoice && (
        <SidePanel
          eyebrow={
            openInvoice.state.global.direction === "OUTGOING"
              ? "Sales invoice"
              : "Purchase bill"
          }
          onClose={() => setInvoiceId(null)}
        >
          <InvoiceDetail doc={openInvoice} />
        </SidePanel>
      )}
      {creating && (
        <NewContactPanel
          drive={drive}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
