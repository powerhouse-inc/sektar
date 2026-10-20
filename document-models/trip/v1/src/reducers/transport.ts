import type { TripTransportOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  ItemNotFoundError,
} from "../../gen/transport/error.js";
import { costFrom, invoiceFrom, mergeCost } from "../items.js";

export const tripTransportOperations: TripTransportOperations = {
  addTransportOperation(state, action) {
    const i = action.input;
    if (state.transport.some((x) => x.id === i.id))
      throw new DuplicateItemIdError(`Transport leg ${i.id} exists`);
    const cost = costFrom(i, state.currency);
    state.transport.push({
      id: i.id,
      mode: i.mode,
      carrier: i.carrier ?? null,
      number: i.number ?? null,
      from: i.from ?? null,
      to: i.to ?? null,
      departAt: i.departAt ?? null,
      arriveAt: i.arriveAt ?? null,
      bookingReference: i.bookingReference ?? null,
      seat: i.seat ?? null,
      cost,
      invoice: invoiceFrom(i),
      note: i.note ?? null,
    });
  },
  updateTransportOperation(state, action) {
    const i = action.input;
    const item = state.transport.find((x) => x.id === i.id);
    if (!item) throw new ItemNotFoundError(`No transport leg ${i.id}`);
    if (i.mode) item.mode = i.mode;
    if (i.carrier !== undefined) item.carrier = i.carrier ?? null;
    if (i.number !== undefined) item.number = i.number ?? null;
    if (i.from !== undefined) item.from = i.from ?? null;
    if (i.to !== undefined) item.to = i.to ?? null;
    if (i.departAt !== undefined) item.departAt = i.departAt ?? null;
    if (i.arriveAt !== undefined) item.arriveAt = i.arriveAt ?? null;
    if (i.bookingReference !== undefined)
      item.bookingReference = i.bookingReference ?? null;
    if (i.seat !== undefined) item.seat = i.seat ?? null;
    if (i.note !== undefined) item.note = i.note ?? null;
    if (
      i.amount !== undefined ||
      i.currency !== undefined ||
      i.converted !== undefined
    )
      item.cost = mergeCost(item.cost, i, state.currency);
    if (i.invoiceId !== undefined) item.invoice = invoiceFrom(i);
  },
  removeTransportOperation(state, action) {
    const i = action.input;
    const at = state.transport.findIndex((x) => x.id === i.id);
    if (at < 0) throw new ItemNotFoundError(`No transport leg ${i.id}`);
    state.transport.splice(at, 1);
    state.attachments = state.attachments.filter((a) => a.itemId !== i.id);
  },
};
