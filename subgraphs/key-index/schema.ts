import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  A document that holds a key.
  """
  type KeyLocation {
    key: String!
    documentId: String!
    documentType: String!
  }

  type KeyIndexQueries {
    """
    The documents of a type in a drive that hold any of these keys.

    Batched, because a day of mail is a hundred keys and should not be a
    hundred round trips. A key with no document is simply absent from the
    answer; a key captured twice appears once per document.
    """
    find(driveId: String!, documentType: String!, keys: [String!]!): [KeyLocation!]!
  }

  type Query {
    keyIndex: KeyIndexQueries!
  }
`;
