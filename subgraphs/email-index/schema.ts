import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  """
  One message as the list shows it. Lean on purpose: the bodies, headers and
  recipients stay on the document, which is loaded only when it is opened.
  """
  type MailRow {
    id: String!
    accountAddress: String
    accountName: String
    subject: String
    fromName: String
    fromAddress: String
    snippet: String
    """The instant the message lists by: sent, else received, else captured."""
    when: String!
    read: Boolean!
    flagged: Boolean!
    """INBOX | ARCHIVED"""
    status: String!
    attachmentCount: Int!
    """The stored files' refs, in order; the first is what a preview opens."""
    attachmentRefs: [String!]!
    labels: [String!]!
    threadId: String
  }

  type MailPage {
    items: [MailRow!]!
    """Pass back as \`cursor\` for the next page; null on the last one."""
    nextCursor: String
    """Every message the filters match, not just this page."""
    total: Int!
  }

  type MailAccount {
    address: String!
    name: String!
    provider: String
    total: Int!
    unread: Int!
  }

  enum MailView {
    INBOX
    UNREAD
    FLAGGED
    ARCHIVED
  }

  type EmailIndexQueries {
    """
    A page of a mailbox, newest first. Keyset-paged, so page one hundred
    costs what page one does; \`query\` is a word search over subject, sender,
    recipients, snippet, labels and file names.
    """
    messages(
      driveId: String!
      account: String
      view: MailView = INBOX
      query: String
      cursor: String
      limit: Int = 100
    ): MailPage!

    """The mailboxes the drive holds mail for, with their counts."""
    accounts(driveId: String!): [MailAccount!]!
  }

  type Query {
    emailIndex: EmailIndexQueries!
  }
`;
