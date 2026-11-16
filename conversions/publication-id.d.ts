export function parsePublicationRowId(id: unknown): {
  generationId: string;
  role: "markdown" | "manifest";
} | null;
