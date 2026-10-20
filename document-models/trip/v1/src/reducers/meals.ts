import type { TripMealsOperations } from "document-models/trip/v1";
import {
  DuplicateItemIdError,
  ItemNotFoundError,
} from "../../gen/meals/error.js";
import { costFrom, invoiceFrom, mergeCost } from "../items.js";

export const tripMealsOperations: TripMealsOperations = {
  addMealOperation(state, action) {
    const i = action.input;
    if (state.meals.some((x) => x.id === i.id))
      throw new DuplicateItemIdError(`Meal ${i.id} exists`);
    const cost = costFrom(i, state.currency);
    state.meals.push({
      id: i.id,
      kind: i.kind,
      venue: i.venue ?? null,
      at: i.at ?? null,
      attendees: i.attendees ?? null,
      cost,
      invoice: invoiceFrom(i),
      note: i.note ?? null,
    });
  },
  updateMealOperation(state, action) {
    const i = action.input;
    const item = state.meals.find((x) => x.id === i.id);
    if (!item) throw new ItemNotFoundError(`No meal ${i.id}`);
    if (i.kind) item.kind = i.kind;
    if (i.venue !== undefined) item.venue = i.venue ?? null;
    if (i.at !== undefined) item.at = i.at ?? null;
    if (i.attendees !== undefined) item.attendees = i.attendees ?? null;
    if (i.note !== undefined) item.note = i.note ?? null;
    if (
      i.amount !== undefined ||
      i.currency !== undefined ||
      i.converted !== undefined
    )
      item.cost = mergeCost(item.cost, i, state.currency);
    if (i.invoiceId !== undefined) item.invoice = invoiceFrom(i);
  },
  removeMealOperation(state, action) {
    const i = action.input;
    const at = state.meals.findIndex((x) => x.id === i.id);
    if (at < 0) throw new ItemNotFoundError(`No meal ${i.id}`);
    state.meals.splice(at, 1);
    state.attachments = state.attachments.filter((a) => a.itemId !== i.id);
  },
};
