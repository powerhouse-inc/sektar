/**
 * The core schedule trigger the mail and bank workflows run on ("every 2
 * hours"), from the integration's live interval. Pieces whose own triggers
 * poll (Google Calendar) do not need it.
 */
import type { IntegrationState } from "document-models/integration";
import type { DriftWords, TriggerSpec } from "../workflow-spec.js";

export const CORE_PIECE = "@powerhousedao/piece-core";
/** The version the existing mail and bank workflows run; the runtime resolves the installed one. */
export const CORE_PIECE_VERSION = "6.2.3-dev.62";

const UNIT = { MINUTES: "minutes", HOURS: "hours", DAYS: "days" } as const;

export function scheduleTrigger(state: IntegrationState): TriggerSpec {
  const every = state.intent.live.every;
  return {
    pieceName: CORE_PIECE,
    pieceVersion: CORE_PIECE_VERSION,
    triggerName: "schedule",
    config: {
      mode: "interval",
      unit: UNIT[every.unit],
      every: every.value,
      timezone: "UTC",
    },
  };
}

/** "every 2 hours" from a schedule config, as the fixes log says it. */
function phrase(config: Record<string, unknown> | null): string {
  const every = config?.every;
  const unit = typeof config?.unit === "string" ? config.unit : "";
  if (typeof every !== "number") return "on another schedule";
  const one = unit.replace(/s$/, "");
  return every === 1 ? `every ${one}` : `every ${every} ${unit}`;
}

export const scheduleWords: DriftWords["config"] = (actual, wanted) =>
  actual?.mode === wanted.mode
    ? `the workflow ran ${phrase(actual)}, not ${phrase(wanted)}`
    : "the workflow's schedule was changed";
