/**
 * A text file's bytes as text: the charset it is served with when it names
 * one, else UTF-8, else Windows-1252 (old mail attachments: “quotes” that are
 * not UTF-8 would otherwise show as replacement characters).
 */
export function decodeText(
  bytes: ArrayBuffer,
  contentType: string | null,
): string {
  const declared = /charset=([^;]+)/i.exec(contentType ?? "")?.[1]?.trim();
  if (declared) {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // an unknown charset name: guess as below
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
