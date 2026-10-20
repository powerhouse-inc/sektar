// Printing a message from the Mail app: the printable page (email-print.ts)
// in a hidden frame, its inline images loaded from the file store, then the
// browser's print dialog, where "Save as PDF" makes the PDF. The page title
// is the file name the dialog suggests.
import type { EmailDocument } from "document-models/email";
import { emailPrintHtml } from "./email-print.js";
import type { AttachmentClient } from "./files.js";

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
            const o = await client.downloadObjectUrl({
              documentId: doc.header.id,
              ref: a.ref,
            });
            urls.set(cidKey(a.contentId ?? ""), o.url);
            revokes.push(o.revoke);
          } catch {
            // an inline image that will not load is left out of the print
          }
        }),
    );
  }
  const html = emailPrintHtml(s, { resolveCid: (cid) => urls.get(cidKey(cid)) });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  const cleanup = () => {
    frame.remove();
    for (const r of revokes) r();
  };
  if (!win) return cleanup();
  // Wait for the images (logos, product pictures) so they make it onto the page.
  const images = Array.from(win.document.images).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  win.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
  // Some browsers never fire afterprint for a frame: clean up anyway.
  setTimeout(cleanup, 5 * 60_000);
  win.focus();
  win.print();
}
