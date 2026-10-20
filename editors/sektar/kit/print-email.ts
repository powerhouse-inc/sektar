// Printing a message from the Mail app: the printable page (email-print.ts)
// with its inline images loaded from the file store, through the browser's
// print dialog (kit/print.ts).
import type { EmailDocument } from "document-models/email";
import { emailPrintHtml } from "./email-print.js";
import type { AttachmentClient } from "./files.js";
import { printHtml } from "./print.js";

const cidKey = (cid: string) => cid.trim().replace(/^<|>$/g, "").toLowerCase();

export async function printEmail(doc: EmailDocument, client: AttachmentClient | undefined): Promise<void> {
  const s = doc.state.global;
  const urls = new Map<string, string>();
  const revokes: (() => void)[] = [];
  if (client) {
    await Promise.all(
      s.attachments
        .filter((a) => a.contentId)
        .map(async (a) => {
          try {
            const o = await client.downloadObjectUrl({ documentId: doc.header.id, ref: a.ref });
            urls.set(cidKey(a.contentId ?? ""), o.url);
            revokes.push(o.revoke);
          } catch {
            // an inline image that will not load is left out of the print
          }
        }),
    );
  }
  const html = emailPrintHtml(s, { resolveCid: (cid) => urls.get(cidKey(cid)) });
  await printHtml(html, { onDone: () => revokes.forEach((r) => r()) });
}
