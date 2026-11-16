import {
  defaultConversionProfile,
  type ConversionLimits,
  type ConversionSettings,
  type ConversionProfile,
  type ConversionScope,
  type PutConversionSettings,
} from "../contracts.js";
import { ConversionRefusal } from "./problems.js";

/** The host ceiling for saved conversion limits. */
export const HOST_LIMITS: ConversionLimits = {
  maxBytes: 200 * 1024 * 1024,
  maxPages: 2000,
  maxAiPages: 500,
  maxAiRequests: 1000,
  automaticAiPagesPerDay: 5000,
  maxDurationMs: 2 * 60 * 60 * 1000,
};

/** The initial app-wide limits. Automatic AI starts at zero. */
export const DEFAULT_LIMITS: ConversionLimits = {
  maxBytes: 50 * 1024 * 1024,
  maxPages: 500,
  maxAiPages: 50,
  maxAiRequests: 120,
  automaticAiPagesPerDay: 0,
  maxDurationMs: 30 * 60 * 1000,
};

export const DEFAULT_SETTINGS_IDENTITY = "host-default";

export function scopeKey(scope: ConversionScope): string {
  return scope.kind === "files"
    ? `files:${scope.driveId}`
    : `mail:${scope.driveId}:${scope.account}`;
}

/** Fresh app settings: on demand with the default reading method. */
export function defaultSettings(now: string): ConversionSettings {
  return {
    needsReview: false,
    revision: 0,
    activation: "manual",
    profile: defaultConversionProfile,
    limits: DEFAULT_LIMITS,
    authorizingIdentity: DEFAULT_SETTINGS_IDENTITY,
    updatedAt: now,
    automaticSince: null,
  };
}

const LIMIT_KEYS = [
  "maxBytes",
  "maxPages",
  "maxAiPages",
  "maxAiRequests",
  "automaticAiPagesPerDay",
  "maxDurationMs",
] as const satisfies readonly (keyof ConversionLimits)[];

export function checkLimits(limits: ConversionLimits): void {
  for (const key of LIMIT_KEYS) {
    if (limits[key] > HOST_LIMITS[key]) {
      throw new ConversionRefusal(
        400,
        "limit-too-high",
        "A limit is higher than this host allows. Lower it to at most the value its field shows.",
        false,
        `${key} may be at most ${HOST_LIMITS[key]} on this host.`,
      );
    }
  }
}

export function usesAi(profile: ConversionProfile): boolean {
  const reading = profile.reading;
  const recognition =
    reading.kind === "smart"
      ? reading.fallback
      : reading.kind === "recognize"
        ? reading.engine
        : null;
  return recognition?.kind === "ai" || profile.layout.kind === "ai";
}

/** Settings after a successful save. The caller authorizes future conversions. */
export function nextSettings(
  previous: ConversionSettings,
  put: PutConversionSettings,
  identity: string,
  now: string,
): ConversionSettings {
  checkLimits(put.limits);
  const stayedAutomatic =
    previous.activation === "automatic" && put.activation === "automatic";
  return {
    needsReview: false,
    revision: previous.revision + 1,
    activation: put.activation,
    profile: put.profile,
    limits: put.limits,
    authorizingIdentity: identity,
    updatedAt: now,
    automaticSince:
      put.activation === "automatic"
        ? stayedAutomatic
          ? (previous.automaticSince ?? now)
          : now
        : null,
  };
}
