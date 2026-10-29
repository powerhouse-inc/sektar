import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  One integration as the sync chip, the cards and pull to refresh read it.
  \`state\` is the integration's global state as JSON: small and bounded, and
  what the kit's pure functions (card view, sync row, detail) read.
  """
  type IntegrationIndexRow {
    id: String!
    name: String
    """EMAIL | TRANSACTIONS | CALENDAR | TIME_TRACKING; null until set up"""
    kind: String
    provider: String
    archived: Boolean!
    liveEnabled: Boolean!
    backfillEnabled: Boolean!
    liveWorkflowId: String
    backfillWorkflowId: String
    connectionId: String
    """Email: the account's name in Sektar"""
    mailbox: String
    """Email: the account's address, once signed in"""
    address: String
    """The backfill queues' document ids, in item order"""
    queueIds: [String!]!
    state: String!
    updatedAt: String!
  }

  """
  One backfill queue as the Backfills list and a card's progress read it.
  Lean on purpose: cursors, queued values, failures and memory stay on the
  document, which is loaded only when it is opened.
  """
  type QueueIndexRow {
    id: String!
    name: String
    """DRAFT | IN_PROGRESS | PAUSED | FINISHED"""
    status: String!
    description: String
    """How many loops it has"""
    loops: Int!
    """Positions in the whole space"""
    total: Int!
    """The fraction walked"""
    progress: Float!
    """Where the walk is, counting from one"""
    iteration: Int!
    """Slices walked"""
    done: Int!
    finished: Boolean!
    awaitingValues: Boolean!
    errorCount: Int!
    lastError: String
    """Lower-cased: name, description, loop and queue names (the list's search)"""
    searchText: String!
    updatedAt: String!
  }

  """One connection as a card's account line and the detail's Connection row read it."""
  type ConnectionIndexRow {
    id: String!
    name: String
    connectorId: String
    accountLabel: String
    """OK | ERROR | REVOKED | UNCONFIGURED"""
    status: String
    lastCheckedAt: String
    lastError: String
    updatedAt: String!
  }

  type IntegrationIndexQueries {
    """Every integration in the drive, by name."""
    integrations(driveId: String!): [IntegrationIndexRow!]!

    """The backfill queues in the drive: every one, or those of \`ids\`."""
    queues(driveId: String!, ids: [String!]): [QueueIndexRow!]!

    """The connections of \`ids\` in the drive."""
    connections(driveId: String!, ids: [String!]!): [ConnectionIndexRow!]!

    """
    The person asking, as a bank sees an end user on screen: their public
    address and browser. Null without a public address (localhost, the LAN).
    A manual refresh sends it with the bank fetch, which then does not use one
    of the connection's four unattended fetches a day.
    """
    onScreen(driveId: String!): OnScreen
  }

  type OnScreen {
    ipAddress: String!
    userAgent: String!
  }

  type Query {
    integrationIndex: IntegrationIndexQueries!
  }
`;
