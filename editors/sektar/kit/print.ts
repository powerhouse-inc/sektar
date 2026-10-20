// Printing a page the app builds (a message, an invoice): the HTML in a
// hidden frame, its images loaded, then the browser's print dialog, where
// "Save as PDF" makes the PDF. The page's title is the file name the dialog
// suggests.

export async function printHtml(html: string, opts: { onDone?: () => void } = {}): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await loaded;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    frame.remove();
    opts.onDone?.();
  };
  const win = frame.contentWindow;
  if (!win) return cleanup();
  // Wait for the images (logos, product pictures) so they make it onto the page.
  const pending = Array.from(win.document.images).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(
      pending.map(
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

/** Hands bytes to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
