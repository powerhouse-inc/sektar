/**
 * The model's public surface beyond its actions and types.
 *
 * Codegen re-exports this through the barrel, so anything here is reachable
 * as `from "document-models/original-source-collection"`.
 *
 * The identity helpers are exported deliberately. Anything that indexes or
 * reports on a collection has to answer "which source does this identifier
 * belong to" exactly the way the reducers answer it — a read model that
 * resolves merges by its own rules is a read model that disagrees with the
 * documents it describes.
 */
export {
  claimantOf,
  claimantsOf,
  conflictingIdentifiers,
  identifiersOf,
  isMerged,
  isNamespaced,
  liveSource,
  type Identified,
} from "./identity.js";
