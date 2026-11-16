import { useAttachments } from "@powerhousedao/reactor-browser";
import type { PHDocument } from "document-model";
import { useEffect, useRef, useState } from "react";
import {
  publicationRows,
  publicationRowSignature,
  type PublicationInspection,
} from "../../../conversions/model-adapter.js";
import { parsePublicationRowId } from "../../../conversions/publication-id.js";
import { inspectPublications } from "../../../conversions/read-publications.js";

export function useConversionPublications(document: PHDocument, host: string) {
  const client = useAttachments();
  const latest = useRef(document);
  latest.current = document;
  const documentId = document.header.id;
  const generations = new Set(
    publicationRows(document).flatMap((row) => {
      const identity = parsePublicationRowId(row.id);
      return identity ? [identity.generationId] : [];
    }),
  );
  const signature = [...generations]
    .sort()
    .map((id) => publicationRowSignature(document, id))
    .join("\n");
  const [held, setHeld] = useState<{
    documentId: string;
    host: string;
    client: typeof client;
    signature: string;
    inspections: PublicationInspection[];
  } | null>(null);
  useEffect(() => {
    if (!signature) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      let inspections: PublicationInspection[];
      try {
        inspections = await inspectPublications({
          document: latest.current,
          signal: abort.signal,
          read: async (input) => {
            const attachments = client;
            if (!attachments)
              throw new Error("The attachment store is not connected.");
            const { blob, header } = await attachments.downloadBlob(input);
            if (header.status !== "available")
              throw new Error("The saved conversion is still arriving.");
            return new Uint8Array(await blob.arrayBuffer());
          },
        });
      } catch (error) {
        if (abort.signal.aborted) return;
        const ids = new Set(
          publicationRows(latest.current).flatMap((row) => {
            const identity = parsePublicationRowId(row.id);
            return identity ? [identity.generationId] : [];
          }),
        );
        inspections = [...ids].map((id) => ({
          kind: "pending",
          id,
          reason:
            error instanceof Error
              ? error.message
              : "The saved conversion could not be read.",
        }));
      }
      if (abort.signal.aborted) return;
      setHeld({ documentId, host, client, signature, inspections });
      if (inspections.some((entry) => entry.kind === "pending"))
        timer = setTimeout(() => {
          void read();
        }, 2000);
    };
    void read();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [documentId, signature, client, host]);

  const current =
    held?.documentId === documentId &&
    held.host === host &&
    held.client === client
      ? held
      : null;
  const inspections = current?.inspections ?? [];
  return {
    inspections,
    pending:
      Boolean(signature) &&
      (current?.signature !== signature ||
        inspections.some((entry) => entry.kind === "pending")),
  };
}
