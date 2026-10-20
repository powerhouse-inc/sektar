// Picks the mail that belongs in the 2026-Q3 and 2026-Q4 kwartaalaangiftes
// folders, by supplier rule, and writes the plan the filing script runs:
// each item either takes the mail's invoice attachments or prints the mail.
import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
const gql = async (query, variables) => {
  const r = await fetch("http://localhost:7540/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 400));
  return j.data;
};

const ymd = (iso) => iso.slice(0, 10).replace(/-/g, "");
const quarter = (iso) => (iso < "2026-10-01" ? "2026-Q3" : "2026-Q4");

/**
 * Supplier rules, after the folders of earlier quarters. `take`:
 * "attachments" keeps the PDFs whose names match `files` (default: every
 * PDF); "print" prints the mail; "auto" takes attachments when there are
 * PDFs, else prints. `name` names a printed file.
 */
const RULES = [
  { folder: "anthropic", from: /invoice\+statements@mail\.anthropic\.com/, take: "attachments", files: /^Invoice-/ },
  { folder: "aws", from: /invoicing@aws\.com/, subject: /Invoice Available/, take: "attachments" },
  { folder: "aws", from: /aws|contact@ksdc\.be/, subject: /Billing Statement Available \[Account: 841162698850\]/, take: "print", name: (r) => `${ymd(r.when)}-aws-billing-statement-841162698850.pdf` },
  { folder: "google", from: /payments-noreply@google\.com/, subject: /invoice is available/, take: "attachments" },
  { folder: "windmill", from: /Windmill|acct_1MCt8dGU3NdFi9eL/, subject: /receipt/i, take: "attachments", files: /^Invoice-/ },
  { folder: "toggl", from: /invoice\+statements@track\.toggl\.com/, take: "attachments", files: /^Invoice-/ },
  { folder: "gitbook", from: /acct_1040Dd4z3ukbMzIv/, take: "attachments", files: /^Invoice-/ },
  { folder: "calendly", from: /acct_14GBQ34YpZGElkrt@stripe/, subject: /receipt/i, take: "attachments", files: /^Invoice-/ },
  { folder: "excalidraw", from: /no-reply@excalidraw\.com/, subject: /invoice/i, take: "attachments" },
  { folder: "hetzner", from: /billing@hetzner\.com|noreply\.billing@hetzner\.com/, subject: /Invoice/, take: "attachments" },
  { folder: "heroku", from: /herokumanager\.com/, subject: /Heroku Invoice for/, take: "print", name: (r) => `heroku-${/#(\d+)/.exec(r.subject)?.[1] ?? ymd(r.when)}.pdf` },
  { folder: "webflow", from: /billing@webflow\.com/, subject: /receipt/i, take: "auto", name: (r) => `${ymd(r.when)}-webflow-receipt.pdf` },
  { folder: "figma", from: /figma\.com/, subject: /Receipt for subscription payment/, take: "print", name: (r) => `${ymd(r.when)}-figma-receipt.pdf` },
  { folder: "namecheap", from: /support@namecheap\.com/, subject: /Order Summary/, take: "print", name: (r) => `namecheap-order-${/Order# ?(\d+)/.exec(r.subject)?.[1]}.pdf` },
  { folder: "apple", from: /no_reply@email\.apple\.com/, subject: /Your invoice from Apple/, take: "print", name: (r) => `${ymd(r.when)}-icloud.pdf` },
  { folder: "github", from: /noreply@github\.com/, subject: /Payment Receipt/, take: "attachments" },
  { folder: "paddle", from: /help@paddle\.com/, subject: /receipt/i, take: "attachments" },
  { folder: "proton", from: /no-reply@notify\.proton\.me/, subject: /Purchase confirmation/, take: "auto", name: (r) => `${ymd(r.when)}-proton.pdf` },
  { folder: "openrouter", from: /receipts@openrouter\.ai/, take: "print", name: (r) => `${ymd(r.when)}-openrouter-receipt.pdf` },
  { folder: "Mobile Vikings", from: /info@mobilevikings\.be/, subject: /Invoice\/payment invitation/, take: "print", name: (r) => `${ymd(r.when)}-mobile-vikings.pdf` },
  { folder: "proximus", from: /billing\.service@proximus\.com/, subject: /payment statement/, take: "print", name: (r) => `${ymd(r.when)}-proximus-payment-statement.pdf` },
  { folder: "dewaele", from: /merel\.vandevelde@dewaele\.com|jeroen\.pieraerts@gerantis\.be/, subject: /Provisie|Afrekening/, take: "attachments", files: /^OS_/ },
  { folder: "warfid", from: /boekhouding@warfid\.be/, subject: /herinnering/i, take: "attachments", files: /^\d/ },
  { folder: "farys", from: /noreply@farys\.be/, subject: /waterfactuur/, take: "attachments" },
  { folder: "berlin-hotels", from: /guest@michelbergerhotel\.com/, subject: /Invoice/, take: "attachments" },
  { folder: "brussels-airlines", from: /booking@information\.brusselsairlines\.com/, subject: /Thank you for booking/, take: "attachments" },
  { folder: "nmbs", from: /no-reply@sales\.belgiantrain\.be/, subject: /AHSVRSH2/, take: "attachments" },
  { folder: "nmbs", from: /no-reply@sales\.belgiantrain\.be/, subject: /Mobile Ticket/, take: "print", name: (r) => `${ymd(r.when)}-nmbs-mobile-ticket.pdf` },
  { folder: "schwarz-digits", from: /Finanzbuchhaltung-Rechnungen@mail\.schwarz/, take: "attachments" },
  { folder: "coolblue", from: /no-reply@coolblue\.be/, subject: /bestelling komt naar je toe/, take: "attachments" },
  { folder: "travel", from: /trip\.com|amadeus\.com/, subject: /confirmation/i, take: "attachments" },
  { folder: "gdw-scheir", from: /kantoor@gdwscheir\.be/, take: "attachments" },
];

const plan = [];
for (const r of rows.sort((a, b) => a.when.localeCompare(b.when))) {
  const rule = RULES.find((x) => x.from.test(`${r.fromName ?? ""} <${r.fromAddress ?? ""}>`) && (!x.subject || x.subject.test(r.subject ?? "")));
  if (!rule) continue;
  const item = { mail: r.id, when: r.when, subject: r.subject, from: r.fromAddress, quarter: quarter(r.when), folder: `accounts-payable/${rule.folder}`, take: rule.take, files: [] };
  if (rule.take !== "print") {
    const d = await gql(`query ($id: String!) { document(idOrSlug: $id) { document { state } } }`, { id: r.id });
    const atts = (d.document.document.state.global.attachments ?? []).filter((a) => !a.inline && (/pdf$/i.test(a.mimeType ?? "") || /\.pdf$/i.test(a.fileName)));
    const kept = atts.filter((a) => !rule.files || rule.files.test(a.fileName));
    // The same file mailed twice (a resend) is filed once.
    item.files = kept.map((a) => ({ fileName: a.fileName, ref: a.ref, sizeBytes: a.sizeBytes }));
    if (rule.take === "auto" && item.files.length === 0) item.take = "print";
    else if (rule.take === "auto") item.take = "attachments";
    if (item.take === "attachments" && item.files.length === 0) item.note = `no PDF attached (${atts.map((a) => a.fileName).join(", ") || "nothing"})`;
  }
  if (item.take === "print") item.name = rule.name?.(r) ?? `${ymd(r.when)}-${rule.folder}.pdf`;
  plan.push(item);
}
// One copy of each file per quarter folder (a resent invoice, a refs dedup).
const seen = new Set();
for (const p of plan) {
  p.files = p.files.filter((f) => {
    const k = `${p.quarter}/${p.folder}/${f.fileName}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
// Attachment items left with nothing to file (a resend) drop out.
const keep = plan.filter((p) => p.take === "print" || p.files.length);
plan.length = 0;
plan.push(...keep);
writeFileSync(OUT, JSON.stringify(plan, null, 1));
for (const p of plan)
  console.log(
    `${p.quarter} ${p.when.slice(0, 10)} ${p.folder.replace("accounts-payable/", "").padEnd(18)} ${p.take === "print" ? `🖨 ${p.name}` : `📎 ${p.files.map((f) => f.fileName).join(", ") || "—"}`}${p.note ? `  ! ${p.note}` : ""}`,
  );
console.log(plan.length, "items");
