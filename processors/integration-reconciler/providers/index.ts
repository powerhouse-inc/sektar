import type { IntegrationState } from "document-models/integration";
import { distyra } from "./distyra.js";
import { gmail } from "./gmail.js";
import { googleCalendar } from "./google-calendar.js";
import type { ProviderAdapter } from "./types.js";

export type {
  ConnectionSpec,
  ProviderAdapter,
  ProviderContext,
} from "./types.js";

/** The providers this switchboard can run, by the integration's provider id. */
export const PROVIDERS: readonly ProviderAdapter[] = [
  googleCalendar,
  gmail,
  distyra,
];

export function providerFor(state: IntegrationState): ProviderAdapter | null {
  return PROVIDERS.find((p) => p.id === state.provider) ?? null;
}
