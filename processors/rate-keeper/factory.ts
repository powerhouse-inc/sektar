import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { bindsToAny } from "processors/drives";
import { FinanceIndex } from "processors/finance-index";
import { RATE_KEEPER_DOCUMENT_TYPES, RateKeeper } from "./processor.js";

export const rateKeeperFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    // Only the books: the business drive.
    if (!bindsToAny(driveHeader, ["sektar"])) return [];
    const filter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: [...RATE_KEEPER_DOCUMENT_TYPES],
      scope: ["global"],
    };
    // It reads the books through this drive's finance index (the same store,
    // the same queries the dashboard asks), so it never loads an account's
    // every transaction to learn its currency.
    const processor = new RateKeeper(driveHeader.id, module, () =>
      FinanceIndex.query(driveHeader.id, module.relationalDb),
    );
    processor.start();
    return [{ processor, filter }];
  };
