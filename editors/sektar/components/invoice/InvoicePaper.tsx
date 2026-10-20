// The invoice as the customer reads it: a sheet with both parties, the
// dates, the lines (re-billed costs with what they cost and the rate), the
// VAT breakdown and its legal mentions, the totals and how to pay. It reads
// the document only, so the preview pane and the side panels share it.
import {
  computeTotals,
  findRate,
  originalRate,
  type InvoiceParty,
  type InvoiceState,
} from "document-models/invoice";
import type { ReactNode } from "react";
import { fmtDate, money } from "../../kit/format.js";
import {
  formatAccount,
  meansLabel,
  unitLabel,
  vatCategory,
} from "../../kit/invoice.js";
import { cx } from "../../kit/ui.js";

const fmtRate = (n: number) => String(Number(n.toFixed(6)));

function PartyBlock({ title, party }: { title: string; party: InvoiceParty }) {
  const city = [party.postalCode, party.city].filter(Boolean).join(" ");
  return (
    <div className="sk-inv-paper__party">
      <div className="sk-inv-paper__eyebrow">{title}</div>
      <div className="sk-inv-paper__party-name">{party.name ?? <span className="sk-inv-paper__missing">Name</span>}</div>
      {party.street && <div>{party.street}</div>}
      {party.additionalStreet && <div>{party.additionalStreet}</div>}
      {(city || party.region) && <div>{[city, party.region].filter(Boolean).join(", ")}</div>}
      {party.country && <div>{regionName(party.country)}</div>}
      {party.vatId && <div className="sk-inv-paper__id">VAT {party.vatId}</div>}
      {party.registrationId && party.registrationId !== party.vatId && (
        <div className="sk-inv-paper__id">Company no. {party.registrationId}</div>
      )}
      {party.email && <div className="sk-inv-paper__id">{party.email}</div>}
    </div>
  );
}

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function InvoicePaper({ state, className }: { state: InvoiceState; className?: string }) {
  const t = computeTotals(state);
  const cur = state.currency;
  const credit = state.kind === "CREDIT_NOTE";
  const toVat = state.vatCurrency ? findRate(state.exchangeRates, cur, state.vatCurrency) : null;
  const meta: [string, ReactNode][] = [
    [credit ? "Credit note no." : "Invoice no.", state.number ?? <span key="n" className="sk-inv-paper__missing">on issue</span>],
    ["Date", state.issuedAt ? fmtDate(state.issuedAt) : <span key="d" className="sk-inv-paper__missing">on issue</span>],
  ];
  if (state.deliveredAt) meta.push(["Delivery", fmtDate(state.deliveredAt)]);
  if (state.period?.start || state.period?.end)
    meta.push(["Period", `${fmtDate(state.period.start)} – ${fmtDate(state.period.end)}`]);
  if (state.dueAt) meta.push(["Due", fmtDate(state.dueAt)]);
  if (state.references.buyerReference) meta.push(["Your reference", state.references.buyerReference]);
  if (state.references.orderReference) meta.push(["Order", state.references.orderReference]);
  if (state.references.contractReference) meta.push(["Contract", state.references.contractReference]);
  if (state.references.projectReference) meta.push(["Project", state.references.projectReference]);

  return (
    <article className={cx("sk-inv-paper", className)} aria-label="Invoice preview">
      <header className="sk-inv-paper__head">
        <div>
          <div className="sk-inv-paper__seller">{state.seller.name ?? "Your company"}</div>
          <h1 className="sk-inv-paper__title">{credit ? "Credit note" : "Invoice"}</h1>
          {state.subject && <p className="sk-inv-paper__subject">{state.subject}</p>}
        </div>
        <dl className="sk-inv-paper__meta">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="sk-inv-paper__parties">
        <PartyBlock title="From" party={state.seller} />
        <PartyBlock title={credit ? "Credited to" : "Bill to"} party={state.buyer} />
      </div>

      {credit && state.precedingInvoices.length > 0 && (
        <p className="sk-inv-paper__note">
          Corrects invoice{state.precedingInvoices.length > 1 ? "s" : ""}{" "}
          {state.precedingInvoices
            .map((p) => (p.issuedAt ? `${p.number} of ${fmtDate(p.issuedAt)}` : p.number))
            .join(", ")}
          .
        </p>
      )}

      <div className="sk-inv-paper__scroll">
      <table className="sk-inv-paper__lines">
        <thead>
          <tr>
            <th>Description</th>
            <th className="is-num">Qty</th>
            <th className="is-num">Price</th>
            <th className="is-num">VAT</th>
            <th className="is-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {state.lines.length === 0 && (
            <tr>
              <td colSpan={5} className="sk-inv-paper__missing">
                No lines yet
              </td>
            </tr>
          )}
          {state.lines.map((l) => {
            const rate = originalRate(state, l);
            return (
              <tr key={l.id}>
                <td>
                  <div className="sk-inv-paper__desc">{l.description}</div>
                  <div className="sk-inv-paper__sub sk-inv-paper__narrow">
                    {l.quantity} × {money(l.unitPrice, cur)} · {l.vatRate} %
                  </div>
                  {l.original && l.original.currency !== cur && (
                    <div className="sk-inv-paper__sub">
                      {money(l.original.amount, l.original.currency)}
                      {rate !== null ? ` × ${fmtRate(rate)}` : " · rate to come"}
                    </div>
                  )}
                  {l.note && <div className="sk-inv-paper__sub">{l.note}</div>}
                  {(l.period?.start || l.period?.end) && (
                    <div className="sk-inv-paper__sub">
                      {fmtDate(l.period.start)} – {fmtDate(l.period.end)}
                    </div>
                  )}
                </td>
                <td className="is-num">
                  {l.quantity} {l.unitCode !== "C62" && <span className="sk-inv-paper__unit">{unitLabel(l.unitCode, l.quantity)}</span>}
                </td>
                <td className="is-num">{money(l.unitPrice, cur)}</td>
                <td className="is-num">{l.vatRate} %</td>
                <td className="is-num">{money(Math.round(l.quantity * l.unitPrice * 100) / 100, cur)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="sk-inv-paper__foot">
        <div className="sk-inv-paper__legal">
          {t.groups.length > 1 && (
            <table className="sk-inv-paper__vat">
              <thead>
                <tr>
                  <th>VAT</th>
                  <th className="is-num">Taxable</th>
                  <th className="is-num">VAT</th>
                </tr>
              </thead>
              <tbody>
                {t.groups.map((g) => (
                  <tr key={`${g.category}-${g.rate}`}>
                    <td>{g.category === "STANDARD" ? `${g.rate} %` : vatCategory(g.category).label}</td>
                    <td className="is-num">{money(g.taxable, cur)}</td>
                    <td className="is-num">{money(g.tax, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {state.vatReasons
            .filter((r) => state.lines.some((l) => l.vatCategory === r.category))
            .map((r) => (
              <p key={r.category} className="sk-inv-paper__mention">
                {r.text ?? r.code}
              </p>
            ))}
        </div>
        <dl className="sk-inv-paper__totals">
          <div>
            <dt>Total excl. VAT</dt>
            <dd>{money(t.net, cur)}</dd>
          </div>
          {t.groups
            .filter((g) => g.category === "STANDARD")
            .map((g) => (
              <div key={g.rate}>
                <dt>VAT {g.rate} %</dt>
                <dd>{money(g.tax, cur)}</dd>
              </div>
            ))}
          {!t.groups.some((g) => g.category === "STANDARD") && (
            <div>
              <dt>VAT</dt>
              <dd>{money(0, cur)}</dd>
            </div>
          )}
          {t.rounding !== 0 && (
            <div>
              <dt>Rounding</dt>
              <dd>{money(t.rounding, cur)}</dd>
            </div>
          )}
          <div className="sk-inv-paper__grand">
            <dt>Total</dt>
            <dd>{money(t.gross + t.rounding, cur)}</dd>
          </div>
          {state.vatCurrency && (
            <div className="sk-inv-paper__fx">
              <dt>VAT in {state.vatCurrency}</dt>
              <dd>{t.vatInVatCurrency === null ? "rate to come" : money(t.vatInVatCurrency, state.vatCurrency)}</dd>
            </div>
          )}
          {state.vatCurrency && toVat !== null && (
            <div className="sk-inv-paper__fx">
              <dt>Rate</dt>
              <dd>
                1 {cur} = {fmtRate(toVat)} {state.vatCurrency}
              </dd>
            </div>
          )}
          {t.paid > 0 && (
            <>
              <div>
                <dt>Paid</dt>
                <dd>{money(t.paid, cur)}</dd>
              </div>
              <div className="sk-inv-paper__grand">
                <dt>{t.due > 0 ? "Due" : "Settled"}</dt>
                <dd>{money(Math.max(0, t.due), cur)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <PaymentBlock state={state} />
      {state.notes && <p className="sk-inv-paper__note">{state.notes}</p>}
    </article>
  );
}

function PaymentBlock({ state }: { state: InvoiceState }) {
  const p = state.paymentInstructions;
  const lines = [
    meansLabel(p.meansCode),
    p.meansText,
    p.account && `${/^[A-Z]{2}\d{2}/.test(p.account) ? "IBAN " : ""}${formatAccount(p.account)}`,
    p.bic && `BIC ${p.bic}`,
    p.accountName && `In the name of ${p.accountName}`,
    p.remittance && `Reference ${p.remittance}`,
    state.paymentTerms,
  ].filter(Boolean);
  if (!lines.length) return null;
  return (
    <div className="sk-inv-paper__pay">
      <div className="sk-inv-paper__eyebrow">How to pay</div>
      <p>{lines.join(" · ")}</p>
    </div>
  );
}
