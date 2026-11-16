// Small, exact PDFs for tests: real text layers, blank pages, image-only
// "scanned" pages with readable text, and password-protected files. Written
// by hand so each test states what its PDF holds.
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";

export type PdfPage =
  | { readonly kind: "text"; readonly lines: readonly string[] }
  | { readonly kind: "blank" }
  /** An image of text with no text layer, as a scanner makes. */
  | { readonly kind: "scan"; readonly lines: readonly string[] };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const SCAN_DPI = 150;
const PADDING = [0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a];

function escapeText(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

/** A grayscale bitmap of the lines, like a page from a flatbed scanner. */
function scanImage(lines: readonly string[]): { width: number; height: number; data: Uint8Array } {
  const width = Math.round((PAGE_WIDTH / 72) * SCAN_DPI);
  const height = Math.round((PAGE_HEIGHT / 72) * SCAN_DPI);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.font = "36px sans-serif";
  lines.forEach((line, index) => context.fillText(line, 120, 200 + index * 64));
  const rgba = context.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let pixel = 0; pixel < gray.length; pixel += 1) gray[pixel] = Number(rgba[pixel * 4]);
  return { width, height, data: gray };
}

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + Number(state[i]) + Number(key[i % key.length])) % 256;
    [state[i], state[j]] = [Number(state[j]), Number(state[i])];
  }
  const out = new Uint8Array(data.length);
  let a = 0;
  let b = 0;
  for (let k = 0; k < data.length; k += 1) {
    a = (a + 1) % 256;
    b = (b + Number(state[a])) % 256;
    [state[a], state[b]] = [Number(state[b]), Number(state[a])];
    out[k] = Number(data[k]) ^ Number(state[(Number(state[a]) + Number(state[b])) % 256]);
  }
  return out;
}

function padded(password: string): Uint8Array {
  const bytes = new TextEncoder().encode(password).slice(0, 32);
  const out = new Uint8Array(32);
  out.set(bytes);
  out.set(PADDING.slice(0, 32 - bytes.length), bytes.length);
  return out;
}

const md5 = (...parts: Uint8Array[]) => {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return new Uint8Array(hash.digest());
};

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

/** The Standard security handler, revision 2: what a reader needs to ask for a password. */
function encryption(userPassword: string, id: Uint8Array): { dictionary: string } {
  const owner = rc4(md5(padded(`${userPassword}-owner`)).slice(0, 5), padded(userPassword));
  const permissions = -4;
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, permissions, true);
  const key = md5(padded(userPassword), owner, p, id).slice(0, 5);
  const user = rc4(key, Uint8Array.from(PADDING));
  return { dictionary: `<< /Filter /Standard /V 1 /R 2 /O <${hex(owner)}> /U <${hex(user)}> /P ${permissions} >>` };
}

/** A PDF with the given pages; with `userPassword` it is protected and cannot be opened without it. */
export function makePdf(pages: readonly PdfPage[], options: { readonly userPassword?: string } = {}): Uint8Array {
  const objects: (string | Uint8Array)[] = [];
  const add = (body: string | Uint8Array) => {
    objects.push(body);
    return objects.length;
  };
  const stream = (dictionary: string, data: Uint8Array): Uint8Array => {
    const head = new TextEncoder().encode(`${dictionary.replace(/>>$/, `/Length ${data.length} >>`)}\nstream\n`);
    const tail = new TextEncoder().encode("\nendstream");
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head);
    out.set(data, head.length);
    out.set(tail, head.length + data.length);
    return out;
  };
  const catalog = add("");
  const pagesId = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    let content = "";
    let resources = `<< /Font << /F1 ${font} 0 R >> >>`;
    if (page.kind === "text") {
      content = `BT /F1 14 Tf 72 720 Td 18 TL ${page.lines.map((line) => `(${escapeText(line)}) Tj T*`).join(" ")} ET`;
    } else if (page.kind === "scan") {
      const image = scanImage(page.lines);
      const imageId = add(stream(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, deflateSync(image.data)));
      resources = `<< /XObject << /Im1 ${imageId} 0 R >> >>`;
      content = `q ${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm /Im1 Do Q`;
    }
    const contents = add(stream("<< >>", new TextEncoder().encode(content)));
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resources} /Contents ${contents} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const id = md5(new TextEncoder().encode(`sektar-test-${pages.length}-${options.userPassword ?? ""}`));
  const encrypt = options.userPassword !== undefined ? add(encryption(options.userPassword, id).dictionary) : null;

  const chunks: Uint8Array[] = [new TextEncoder().encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  let offset = chunks[0]?.length ?? 0;
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    const head = new TextEncoder().encode(`${index + 1} 0 obj\n`);
    const content = typeof body === "string" ? new TextEncoder().encode(body) : body;
    const tail = new TextEncoder().encode("\nendobj\n");
    chunks.push(head, content, tail);
    offset += head.length + content.length + tail.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`)].join("");
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /ID [<${hex(id)}> <${hex(id)}>]${encrypt ? ` /Encrypt ${encrypt} 0 R` : ""} >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(new TextEncoder().encode(xref + trailer));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Bytes that start like a PDF and are not one. */
export function damagedPdf(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R\nthis is not a pdf\n");
}
