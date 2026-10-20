// An email as a printable page: who sent it to whom and when, its files,
// then the message itself, laid out for A4. The Mail app prints it to make a
// PDF of a receipt that came as a message rather than as an attachment (an
// Apple or Figma receipt); scripts/file-quarter.mjs renders the same page to
// PDF with a headless browser. No imports, so Node runs this file as is.

export type PrintableAddress = { name?: string | null; address?: string | null };

export type PrintableEmail = {
  subject?: string | null;
  from?: readonly PrintableAddress[];
  to?: readonly PrintableAddress[];
  cc?: readonly PrintableAddress[];
  sentAt?: string | null;
  receivedAt?: string | null;
  capturedAt?: string | null;
  account?: { name?: string | null; address?: string | null } | null;
  html?: string | null;
  text?: string | null;
  attachments?: readonly {
    fileName: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    inline?: boolean | null;
    contentId?: string | null;
  }[];
};

export type PrintOptions = {
  /** The URL an inline image (cid:…) loads from; undefined drops the image. */
  resolveCid?: (contentId: string) => string | undefined;
  /** Time zone the date prints in. */
  timeZone?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const who = (a: PrintableAddress) =>
  a.name && a.address ? `${a.name} <${a.address}>` : (a.address ?? a.name ?? "");

const list = (as: readonly PrintableAddress[] | undefined) => (as ?? []).map(who).filter(Boolean).join(", ");

const bytes = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

/** When the message is dated: sent, else received, else captured. */
export function emailDate(email: PrintableEmail): string | null {
  return email.sentAt ?? email.receivedAt ?? email.capturedAt ?? null;
}

function fmtWhen(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * The message's own HTML, made safe to print: no scripts, frames, forms or
 * event handlers, inline images resolved (or dropped), and only its styles
 * and body kept so it sits below the header.
 */
export function printableBody(html: string, opts: PrintOptions = {}): { styles: string; body: string } {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|base|meta)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "");
  h = h.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = /src\s*=\s*(["'])cid:([^"']+)\1/i.exec(tag);
    if (!m) return tag;
    const url = opts.resolveCid?.(m[2]);
    return url ? tag.replace(m[0], `src="${esc(url)}"`) : "";
  });
  const styles = [...h.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((s) => s[0]).join("\n");
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(h);
  const body = (bodyMatch ? bodyMatch[1] : h.replace(/<\/?(html|head)[^>]*>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<title[\s\S]*?<\/title>/gi, ""));
  return { styles, body };
}

/** "20260921-apple-your-invoice-from-apple": a name for the printed file. */
export function emailPrintName(email: PrintableEmail): string {
  const date = (emailDate(email) ?? "").slice(0, 10).replace(/-/g, "");
  const sender = (email.from?.[0]?.name || email.from?.[0]?.address?.split("@")[0] || "mail")
    .toLowerCase();
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [date, slug(sender).slice(0, 24), slug(email.subject ?? "").slice(0, 48)].filter(Boolean);
  return parts.join("-") || "email";
}

/** The whole printable page, as an HTML document. */
export function emailPrintHtml(email: PrintableEmail, opts: PrintOptions = {}): string {
  const timeZone = opts.timeZone ?? "Europe/Brussels";
  const files = (email.attachments ?? []).filter((a) => !a.inline);
  const rows: [string, string][] = [
    ["From", list(email.from)],
    ["To", list(email.to)],
    ["Cc", list(email.cc)],
    ["Date", fmtWhen(emailDate(email), timeZone)],
    ["Mailbox", email.account?.address ? who(email.account) : ""],
    ["Attachments", files.map((f) => `${f.fileName}${f.sizeBytes ? ` (${bytes(f.sizeBytes)})` : ""}`).join(", ")],
  ];
  const head = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<div style="display:flex;gap:12px;margin:0 0 3px"><span style="flex:0 0 92px;color:#6b7280">${k}</span><span style="flex:1 1 auto;min-width:0;overflow-wrap:anywhere;color:#111827">${esc(v)}</span></div>`,
    )
    .join("");
  const content = email.html
    ? printableBody(email.html, opts)
    : {
        styles: "",
        body: `<pre style="white-space:pre-wrap;font:13px/1.55 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0">${esc(email.text ?? "")}</pre>`,
      };
  const title = emailPrintName(email);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  #sk-print-head { font: 12px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 0 0 12px; margin: 0 0 16px; border-bottom: 1px solid #d1d5db; }
  #sk-print-subject { font-size: 18px; font-weight: 600; line-height: 1.3; margin: 0 0 10px; }
  #sk-print-body img { max-width: 100% !important; height: auto; }
  #sk-print-body table { max-width: 100% !important; }
  @media print { #sk-print-head { break-inside: avoid; } }
</style>
${content.styles}
</head><body>
<header id="sk-print-head">
  <div id="sk-print-subject">${esc(email.subject || "(no subject)")}</div>
  ${head}
</header>
<main id="sk-print-body">${content.body}</main>
</body></html>`;
}
