import { gql } from "graphql-tag";
import {
  preparePdfInputSchema,
  validatePdfInputSchema,
} from "../../pieces/sektar-pdf/lib/contracts.js";
import { ConversionRefusal, starting } from "./problems.js";
import { callerOf, type ConversionService } from "./service.js";

export const conversionGatewaySchema = gql`
  type ConversionGateway {
    "Resolve the current source and app settings; never submits a conversion."
    prepare(input: String!): String!
    "Recheck source, app settings and run-user rights before native document writes."
    validate(input: String!): String!
    "Recheck access and read current limits immediately before extraction, including retries."
    extractionLimits(input: String!): String!
  }
  type Query {
    conversion: ConversionGateway!
  }
`;
function contextAddress(context: unknown): string | undefined {
  if (typeof context !== "object" || !context || !("user" in context))
    return undefined;
  const user: unknown = context.user;
  return typeof user === "object" &&
    user &&
    "address" in user &&
    typeof user.address === "string"
    ? user.address
    : undefined;
}
const UNREADABLE_STEP =
  "Sektar couldn't read this conversion request. Try again, and if it keeps failing, restart Sektar.";

function inputOf(args: unknown): unknown {
  if (
    typeof args !== "object" ||
    !args ||
    !("input" in args) ||
    typeof args.input !== "string"
  )
    throw new ConversionRefusal(
      400,
      "invalid-request",
      UNREADABLE_STEP,
      false,
      "Expected a JSON input string.",
    );
  try {
    return JSON.parse(args.input);
  } catch {
    throw new ConversionRefusal(
      400,
      "invalid-json",
      UNREADABLE_STEP,
      false,
      "The conversion input is not JSON.",
    );
  }
}
export function conversionGatewayResolvers(
  service: () => ConversionService | null,
  onError: (error: unknown) => void,
) {
  const answer = async (
    work: (ready: ConversionService) => Promise<unknown>,
  ) => {
    try {
      const ready = service();
      if (!ready) throw starting();
      return JSON.stringify({ kind: "ok", value: await work(ready) });
    } catch (error) {
      if (error instanceof ConversionRefusal)
        return JSON.stringify({
          kind: "error",
          code: error.code,
          message: error.message,
          ...(error.detail ? { detail: error.detail } : {}),
        });
      onError(error);
      return JSON.stringify({
        kind: "error",
        code: "invalid-conversion",
        message: "Sektar couldn't check this conversion. Try again.",
        ...(error instanceof Error ? { detail: error.message } : {}),
      });
    }
  };
  return {
    Query: { conversion: () => ({}) },
    ConversionGateway: {
      prepare: (_parent: unknown, args: unknown, context: unknown) =>
        answer((ready) =>
          ready.prepare(
            callerOf(contextAddress(context)),
            preparePdfInputSchema.parse(inputOf(args)),
          ),
        ),
      extractionLimits: (_parent: unknown, args: unknown, context: unknown) =>
        answer((ready) =>
          ready.extractionLimits(
            callerOf(contextAddress(context)),
            validatePdfInputSchema.parse(inputOf(args)),
          ),
        ),
      validate: (_parent: unknown, args: unknown, context: unknown) =>
        answer((ready) =>
          ready.validate(
            callerOf(contextAddress(context)),
            validatePdfInputSchema.parse(inputOf(args)),
          ),
        ),
    },
  };
}
