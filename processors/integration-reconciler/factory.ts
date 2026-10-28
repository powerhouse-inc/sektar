import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { INTEGRATION_TYPE, IntegrationReconciler } from "./processor.js";

/** The drive app whose drive holds the integrations. */
const INTEGRATIONS_APP = "integrations";

export const integrationReconcilerFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    const meta = driveHeader.meta as { preferredEditor?: string } | undefined;
    if (
      meta?.preferredEditor !== INTEGRATIONS_APP &&
      driveHeader.slug !== "integrations"
    ) {
      return Promise.resolve([]);
    }
    const filter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: [INTEGRATION_TYPE],
      scope: ["global"],
    };
    const processor = new IntegrationReconciler(driveHeader.id, {
      read: module.read,
      dispatch: module.dispatch,
      getReadModel: <T>(name: string) => module.getReadModel<T>(name),
    });
    processor.start();
    // Re-reads each integration; a replay needs no state.
    return Promise.resolve([
      { processor, filter, replayState: "operations" as const },
    ]);
  };
