export function parsePublicationRowId(id) {
  if (typeof id !== "string") return null;
  const match = /^sektar-pdf:v1:([^:\r\n]+):(markdown|manifest)$/.exec(id);
  if (!match || match[0] !== id) return null;
  return { generationId: match[1], role: match[2] };
}
