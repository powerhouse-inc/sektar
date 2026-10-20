import type { TripExtrasOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  ItemNotFoundError,
} from "../../gen/extras/error.js";
import { costFrom, invoiceFrom, mergeCost } from "../items.js";

export const tripExtrasOperations: TripExtrasOperations = {
  addExtraOperation(state, action) {
    const i = action.input;
    if (state.extras.some((x) => x.id === i.id))
      throw new DuplicateItemIdError(`Extra ${i.id} exists`);
    const cost = costFrom(i, state.currency);
    state.extras.push({
      id: i.id,
      kind: i.kind,
      description: i.description,
      at: i.at ?? null,
      cost,
      invoice: invoiceFrom(i),
      note: i.note ?? null,
    });
  },
  updateExtraOperation(state, action) {
    const i = action.input;
    const item = state.extras.find((x) => x.id === i.id);
    if (!item) throw new ItemNotFoundError(`No extra ${i.id}`);
    if (i.kind) item.kind = i.kind;
    if (i.description) item.description = i.description;
    if (i.at !== undefined) item.at = i.at ?? null;
    if (i.note !== undefined) item.note = i.note ?? null;
    if (
      i.amount !== undefined ||
      i.currency !== undefined ||
      i.converted !== undefined
    )
      item.cost = mergeCost(item.cost, i, state.currency);
    if (i.invoiceId !== undefined) item.invoice = invoiceFrom(i);
  },
  removeExtraOperation(state, action) {
    const i = action.input;
    const at = state.extras.findIndex((x) => x.id === i.id);
    if (at < 0) throw new ItemNotFoundError(`No extra ${i.id}`);
    state.extras.splice(at, 1);
    state.attachments = state.attachments.filter((a) => a.itemId !== i.id);
  },
};
