import type { ContactPeopleOperations } from "document-models/contact/v1";
import { PersonNotFoundError } from "../../gen/people/error.js";

export const contactPeopleOperations: ContactPeopleOperations = {
  addPersonOperation(state, action) {
    state.people.push({
      id: action.input.id,
      name: action.input.name,
      role: action.input.role || null,
      email: action.input.email || null,
      phone: action.input.phone || null,
    });
  },
  updatePersonOperation(state, action) {
    const person = state.people.find((p) => p.id === action.input.id);
    if (!person)
      throw new PersonNotFoundError(`Person ${action.input.id} not found`);
    if (action.input.name !== undefined && action.input.name !== null)
      person.name = action.input.name;
    if (action.input.role !== undefined) person.role = action.input.role;
    if (action.input.email !== undefined) person.email = action.input.email;
    if (action.input.phone !== undefined) person.phone = action.input.phone;
  },
  removePersonOperation(state, action) {
    const index = state.people.findIndex((p) => p.id === action.input.id);
    if (index === -1)
      throw new PersonNotFoundError(`Person ${action.input.id} not found`);
    state.people.splice(index, 1);
  },
};
