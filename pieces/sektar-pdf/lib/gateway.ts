import type { IndexQueryMethods } from "@powerhousedao/pieces-framework";
import { conversionGatewayReplySchema, SektarPdfRefusal } from "./contracts.js";

export async function readConversionGateway(
  reactor: IndexQueryMethods,
  field: "prepare" | "validate" | "extractionLimits",
  input: unknown,
): Promise<unknown> {
  const response = await reactor.query({
    subgraph: "conversion",
    query: `query SektarPdf($input: String!) { conversion { ${field}(input: $input) } }`,
    variables: { input: JSON.stringify(input) },
  });
  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).join("; "));
  }
  const conversion = response.data?.conversion;
  if (!conversion || typeof conversion !== "object" || !(field in conversion)) {
    throw new Error("The conversion service returned no response");
  }
  const raw: unknown = Reflect.get(conversion, field);
  const reply = conversionGatewayReplySchema.parse(
    typeof raw === "string" ? JSON.parse(raw) : raw,
  );
  if (reply.kind === "error") {
    if (reply.detail)
      console.warn(
        `[sektar-pdf] ${field} refused (${reply.code}): ${reply.detail}`,
      );
    throw new SektarPdfRefusal(reply.code, reply.message);
  }
  return reply.value;
}
