// The batches this browser started and has not seen end, so a batch can be
// followed and cancelled after its dialog, or the page, was closed. The host
// holds the batch; this is only where to ask for it.
import { z } from "zod";

const KEY = "sektar:conversion-batches";
/** More than a person follows at once; older ones fall off. */
const MOST = 20;

const storedSchema = z.array(
  z.object({ host: z.string(), id: z.string().min(1) }),
);
type Stored = z.infer<typeof storedSchema>;

function read(): Stored {
  try {
    const parsed = storedSchema.safeParse(
      JSON.parse(localStorage.getItem(KEY) ?? "[]"),
    );
    return parsed.success ? parsed.data : [];
  } catch {
    // No storage here, or what is kept is not JSON: nothing is remembered.
    return [];
  }
}

function write(entries: Stored): void {
  try {
    if (entries.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MOST)));
  } catch {
    // Storage is unavailable: the batch is followed for this visit only.
  }
}

/** The batches started from this browser on `host`, newest first. */
export function rememberedBatches(host: string): string[] {
  return read()
    .filter((entry) => entry.host === host)
    .map((entry) => entry.id);
}

export function rememberBatch(host: string, id: string): void {
  write([
    { host, id },
    ...read().filter((entry) => entry.host !== host || entry.id !== id),
  ]);
}

export function forgetBatch(host: string, id: string): void {
  const kept = read();
  const next = kept.filter((entry) => entry.host !== host || entry.id !== id);
  if (next.length !== kept.length) write(next);
}
