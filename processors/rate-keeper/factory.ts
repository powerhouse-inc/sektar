import type {
  IProcessor,
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { bindsToAny, resolveDriveId } from "processors/drives";
import { FinanceIndex } from "processors/finance-index";
import { TRIP_DOCUMENT_TYPE, TripIndex } from "processors/trip-index";
import { dayOf } from "../finance-index/fx.js";
import {
  RATE_KEEPER_DOCUMENT_TYPES,
  RateKeeper,
  type MoreCurrencies,
} from "./processor.js";

/**
 * The currencies Business Travel's trips are in, with the first trip of each:
 * the trips live in their own drive, and their spend per year is shown in the
 * books' main currency. None where this reactor has no trips drive or its
 * index is not there yet.
 */
function tripCurrencies(module: IProcessorHostModule): MoreCurrencies {
  return async () => {
    const trips = await resolveDriveId(module.read, "trips");
    if (!trips) return [];
    const rows = await TripIndex.query(trips, module.relationalDb)
      .selectFrom("trip_index")
      .select("currency")
      .select((eb) => eb.fn.min("start_date").as("since"))
      .where("status", "<>", "CANCELLED")
      .groupBy("currency")
      .execute();
    return rows.map((r) => ({ currency: r.currency, since: dayOf(r.since) }));
  };
}

/** On the trips drive: a trip changed, so the books may need another currency's rates. */
class TripWatch implements IProcessor {
  constructor(private readonly keepers: ReadonlySet<RateKeeper>) {}

  onOperations(): Promise<void> {
    for (const keeper of this.keepers) keeper.poke();
    return Promise.resolve();
  }

  onDisconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export const rateKeeperFactoryBuilder: ProcessorFactoryBuilder = (
  module: IProcessorHostModule,
) => {
  /** The keepers of this reactor's books: what a trip's change pokes. */
  const keepers = new Set<RateKeeper>();
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    if (bindsToAny(driveHeader, ["trips"])) {
      const filter: ProcessorFilter = {
        branch: ["main"],
        documentId: ["*"],
        documentType: [TRIP_DOCUMENT_TYPE],
        scope: ["global"],
      };
      return [{ processor: new TripWatch(keepers), filter }];
    }
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
    const processor = new RateKeeper(
      driveHeader.id,
      module,
      () => FinanceIndex.query(driveHeader.id, module.relationalDb),
      tripCurrencies(module),
    );
    keepers.add(processor);
    processor.start();
    return [{ processor, filter }];
  };
};
