import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

export const schema: DocumentNode = gql`
  enum TripPhase {
    UPCOMING
    ONGOING
    COMPLETED
    CANCELLED
    UNDATED
  }

  type TripDestination {
    city: String!
    country: String
  }

  """The earliest transport leg of a trip."""
  type TripLeg {
    mode: String
    carrier: String
    number: String
    from: String
    to: String
    departAt: String
  }

  """
  One trip as the list shows it. Lean on purpose: stays, meals, extras and
  attachments stay on the document, which is loaded only when it is opened.
  """
  type TripRow {
    id: String!
    title: String
    """PLANNED | BOOKED | COMPLETED | CANCELLED"""
    status: String!
    purposeKind: String
    """YYYY-MM-DD"""
    startDate: String
    """YYYY-MM-DD"""
    endDate: String
    travelerName: String
    destinations: [TripDestination!]!
    firstLeg: TripLeg
    """Transport legs by flight."""
    flights: Int!
    """Every transport leg, whatever its mode."""
    legs: Int!
    """Nights over the stays."""
    nights: Int!
    """Every cost in the trip's currency, where known."""
    costTotal: Float!
    currency: String!
    """Measured at the request's \`now\`."""
    phase: TripPhase!
  }

  type TripPage {
    items: [TripRow!]!
    """Every trip the filters match, not just this page."""
    total: Int!
  }

  """One year's figures over the trips that start in it, cancelled ones left out."""
  type TripYear {
    year: Int!
    trips: Int!
    flights: Int!
    nights: Int!
    """The days away, first and last day of each trip included."""
    days: Int!
    """Spend in each trip's own currency, summed."""
    cost: Float!
    """The part of the spend billed on to a customer."""
    billed: Float!
    """Every transport leg, whatever its mode."""
    legs: Int!
    """The spend split by kind of cost; the parts add up to \`cost\`."""
    costByKind: TripCostByKind!
  }

  type TripCostByKind {
    transport: Float!
    stays: Float!
    meals: Float!
    extras: Float!
  }

  """A place visited and how often."""
  type TripPlace {
    city: String!
    country: String
    visits: Int!
    """The latest start date among the trips that went there."""
    last: String
  }

  type TripIndexQueries {
    """
    A page of trips, newest start first, undated last. \`year\` is the year a
    trip starts in; \`phase\` and the dates are measured at \`now\` (an ISO
    instant, default the server's clock); \`query\` is a word search over
    title, purpose, customer, traveler, destinations, stays and carriers.
    """
    trips(
      driveId: String!
      year: Int
      """Kept for older callers; \`phases\` wins when both are given."""
      phase: TripPhase
      """A trip matches when it is in any of these phases."""
      phases: [TripPhase!]
      query: String
      offset: Int
      limit: Int = 50
      now: String
    ): TripPage!

    """The per-year figures, newest first."""
    years(driveId: String!): [TripYear!]!

    """The most visited places over the trips that start in \`year\` (every year if absent), cancelled trips left out."""
    places(driveId: String!, year: Int, limit: Int = 6): [TripPlace!]!
  }

  type Query {
    tripIndex: TripIndexQueries!
  }
`;
