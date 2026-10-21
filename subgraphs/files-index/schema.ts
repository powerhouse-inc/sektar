import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  type FilesTag {
    id: String!
    label: String!
    color: String!
  }

  """
  One entry of a folder listing: the drive node, and what the File document
  it names says about itself. Lean on purpose; the File is loaded when opened.
  """
  type FilesRow {
    id: String!
    """folder | file"""
    kind: String!
    name: String!
    parentId: String
    documentType: String
    title: String
    description: String
    tags: [FilesTag!]!
    sourceKind: String
    sourceMime: String
    sourceName: String
    sourceSize: Float
    sourceDocumentType: String
    sourceDocumentName: String
    renditionCount: Int!
    thumbRef: String
    "A change a folder sync found on disk, waiting to be pulled: CREATE | UPDATE | DELETE"
    diskChange: String
  }

  type FilesPage {
    items: [FilesRow!]!
    """Every entry the listing covers, not just this page."""
    total: Int!
  }

  type FilesIndexQueries {
    """
    A page of a folder (the root when folderId is null), folders first, then
    by name. Deep, the folder and every folder below it, documents only.
    query is a word search over names, titles, descriptions, tags and sources.
    """
    listing(
      driveId: String!
      folderId: String
      deep: Boolean = false
      query: String
      offset: Int = 0
      limit: Int = 60
    ): FilesPage!
  }

  type Query {
    filesIndex: FilesIndexQueries!
  }
`;
