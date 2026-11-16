import type { ProcessorFactoryBuilder } from "@powerhousedao/reactor-browser";
import { conversionRuntime } from "../../conversions/host/runtime.js";

/** Exposes host ports to the package adapter. Native workflow triggers own intake. */
export const conversionFactoryBuilder: ProcessorFactoryBuilder = (module) => {
  if (module.processorApp !== "connect")
    conversionRuntime().attachProcessor({
      relationalDb: module.relationalDb,
      attachments: module.attachments,
      read: module.read,
      dispatch: module.dispatch,
      host: module.host,
    });
  return () => [];
};
