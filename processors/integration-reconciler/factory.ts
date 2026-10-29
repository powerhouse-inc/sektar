import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { bindsTo } from "processors/drive-ids";
import { INTEGRATION_TYPE, IntegrationReconciler } from "./processor.js";

/** The drive app whose drive holds the integrations. */
const INTEGRATIONS_APP = "integrations";
/** The drive the host files declare for them. */
const INTEGRATIONS_DRIVE = "integrations";

export const integrationReconcilerFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    // One reconciler per store: on the converted Integrations drive where
    // there is one, never also on the legacy drive holding the same documents.
    if (!(await bindsTo(module.read, driveHeader, INTEGRATIONS_DRIVE, INTEGRATIONS_APP))) {
      return [];
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
    return [{ processor, filter, replayState: "operations" as const }];
  };
