import type { FileTagsOperations } from "document-models/file/v1";
import {
  DuplicateTagError,
  EmptyTagLabelError,
  InvalidTagLabelError,
  TagLabelTakenError,
  TagNotFoundError,
  UnknownTagError,
} from "../../gen/tags/error.js";

export const fileTagsOperations: FileTagsOperations = {
  addTagOperation(state, action) {
    const label = action.input.label.trim();
    if (!label) throw new InvalidTagLabelError("The tag label is empty");
    const taken = state.tags.some(
      (t) =>
        t.id === action.input.id ||
        t.label.toLowerCase() === label.toLowerCase(),
    );
    if (taken)
      throw new DuplicateTagError(`The file is tagged "${label}" already`);
    state.tags.push({
      id: action.input.id,
      label,
      color: action.input.color.trim() || "neutral",
    });
  },
  updateTagOperation(state, action) {
    const tag = state.tags.find((t) => t.id === action.input.id);
    if (!tag) throw new UnknownTagError(`No tag with id ${action.input.id}`);
    if (action.input.label !== undefined && action.input.label !== null) {
      const label = action.input.label.trim();
      if (!label) throw new EmptyTagLabelError("The tag label is empty");
      if (
        state.tags.some(
          (t) =>
            t.id !== tag.id && t.label.toLowerCase() === label.toLowerCase(),
        )
      )
        throw new TagLabelTakenError(`The file is tagged "${label}" already`);
      tag.label = label;
    }
    const color = action.input.color?.trim();
    if (color) tag.color = color;
  },
  removeTagOperation(state, action) {
    const at = state.tags.findIndex((t) => t.id === action.input.id);
    if (at < 0) throw new TagNotFoundError(`No tag with id ${action.input.id}`);
    state.tags.splice(at, 1);
  },
};
