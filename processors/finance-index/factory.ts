import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import {
  ACCOUNT_DOCUMENT_TYPE,
  FinanceIndex,
  INVOICE_DOCUMENT_TYPE,
} from "./processor.js";

export const financeIndexFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    // One index per drive: the books are read within their drive.
    const namespace = FinanceIndex.getNamespace(driveHeader.id);
    const store =
      await module.relationalDb.createNamespace<FinanceIndex>(namespace);

    // An omitted field matches every value; only `documentId` honours "*".
    // Scope "document" carries DELETE_DOCUMENT and PURGE_DOCUMENT.
    const filter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: [INVOICE_DOCUMENT_TYPE, ACCOUNT_DOCUMENT_TYPE],
      scope: ["global", "document"],
    };

    // The drive id lets the processor drop its namespace on the drive's deletion.
    const processor = new FinanceIndex(namespace, filter, store, driveHeader.id);

    // Nothing in the runtime calls this, so without it the first write hits
    // a database with no tables.
    await processor.initAndUpgrade();

    return [{ processor, filter }];
  };
