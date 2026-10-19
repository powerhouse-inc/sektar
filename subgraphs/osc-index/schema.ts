import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  Where an identifier already lives.

  The documentId is the point of the whole index: knowing that something has
  been captured is only actionable if you know which collection holds it.
  """
  type OSCSourceLocation {
    identifier: String!
    documentId: String!
    sourceId: String!
    """False for the source's canonical externalId, true for an alias."""
    isAlias: Boolean!
    """
    The status of the LIVE source. An identifier belonging to a folded source
    resolves to whatever absorbed it, never to the tombstone.
    """
    status: String!
    title: String
    capturedAt: String!
    lastSeenAt: String!
    collectionTitle: String
  }

  type OscIndexQueries {
    """
    Every collection answering to this identifier.

    A list, not a single hit: one identifier belongs to at most one source
    WITHIN a collection, but two backfills may legitimately have captured the
    same object separately.
    """
    findSource(driveId: String!, identifier: String!): [OSCSourceLocation!]!

    """
    The same, batched. A flow checking a week of Gmail has three hundred
    identifiers and should not make three hundred round trips.
    """
    findSources(
      driveId: String!
      identifiers: [String!]!
    ): [OSCSourceLocation!]!
  }

  type Query {
    oscIndex: OscIndexQueries!
  }
`;
