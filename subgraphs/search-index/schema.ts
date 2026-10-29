import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  One searchable thing: a document, or a transaction inside an account
  (then \`entityId\` is the transaction's id and \`documentId\` its account).
  """
  type SearchHit {
    documentId: String!
    entityId: String!
    documentType: String!
    """invoice | contact | expense | account | transaction"""
    kind: String!
    title: String!
    subtitle: String
    amount: Float
    status: String
    at: String
  }

  type SearchIndexQueries {
    """
    The rows every word of \`query\` appears in, newest first. An empty query
    finds nothing.
    """
    search(driveId: String!, query: String!, limit: Int = 40): [SearchHit!]!
  }

  type Query {
    searchIndex: SearchIndexQueries!
  }
`;
