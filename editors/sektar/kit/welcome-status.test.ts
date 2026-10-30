import type { IntegrationState } from "document-models/integration";
import { describe, expect, it } from "vitest";
import { missingKinds, unfinishedBackfills } from "./welcome-status.js";

type Kind = IntegrationState["kind"];

const item = (kind: Kind, archived = false) => ({
  state: { kind, intent: { archived } },
});

const queue = (name: string, status: string, finished = false) => ({
  name,
  status,
  finished,
});

describe("missingKinds", () => {
  it("reports nothing until the index has answered: loading or a failed read", () => {
    expect(missingKinds(undefined)).toEqual([]);
  });

  it("reports all three on an empty answer", () => {
    expect(missingKinds([])).toEqual(["EMAIL", "CALENDAR", "TRANSACTIONS"]);
  });

  it.each([
    [["EMAIL"], ["CALENDAR", "TRANSACTIONS"]],
    [["CALENDAR"], ["EMAIL", "TRANSACTIONS"]],
    [["TRANSACTIONS"], ["EMAIL", "CALENDAR"]],
    [["EMAIL", "CALENDAR"], ["TRANSACTIONS"]],
    [["EMAIL", "TRANSACTIONS"], ["CALENDAR"]],
    [["CALENDAR", "TRANSACTIONS"], ["EMAIL"]],
  ] as [Kind[], string[]][])("with %j set up, %j are missing", (present, missing) => {
    expect(missingKinds(present.map((kind) => item(kind)))).toEqual(missing);
  });

  it("reports nothing when all three exist", () => {
    expect(
      missingKinds([
        item("TRANSACTIONS"),
        item("CALENDAR"),
        item("EMAIL"),
        item("EMAIL"),
      ]),
    ).toEqual([]);
  });

  it("does not count an integration that is being removed", () => {
    expect(
      missingKinds([
        item("EMAIL", true),
        item("CALENDAR"),
        item("TRANSACTIONS"),
      ]),
    ).toEqual(["EMAIL"]);
  });

  it("counts the kind when one is being removed and another stays", () => {
    expect(
      missingKinds([
        item("EMAIL", true),
        item("EMAIL"),
        item("CALENDAR"),
        item("TRANSACTIONS"),
      ]),
    ).toEqual([]);
  });

  it("does not count one whose setup never chose a kind", () => {
    expect(missingKinds([item(null)])).toEqual([
      "EMAIL",
      "CALENDAR",
      "TRANSACTIONS",
    ]);
  });

  it("ignores a kind the page does not ask for", () => {
    expect(missingKinds([item("TIME_TRACKING")])).toEqual([
      "EMAIL",
      "CALENDAR",
      "TRANSACTIONS",
    ]);
  });
});

describe("unfinishedBackfills", () => {
  it("is empty until the index has answered", () => {
    expect(unfinishedBackfills(undefined)).toEqual([]);
  });

  it("is empty when nothing is left to finish", () => {
    expect(unfinishedBackfills([])).toEqual([]);
    expect(unfinishedBackfills([queue("Mail", "FINISHED", true)])).toEqual([]);
  });

  it("leaves out finished ones and keeps the rest", () => {
    const rows = [
      queue("Done", "FINISHED", true),
      queue("Walking", "IN_PROGRESS"),
      queue("Stopped", "PAUSED"),
      queue("New", "DRAFT"),
    ];
    expect(unfinishedBackfills(rows).map((r) => r.name)).toEqual([
      "Walking",
      "Stopped",
      "New",
    ]);
  });

  it("leaves out a row either field calls finished", () => {
    expect(
      unfinishedBackfills([
        queue("By status", "FINISHED", false),
        queue("By flag", "IN_PROGRESS", true),
      ]),
    ).toEqual([]);
  });

  it("orders as the Backfills page does: by status, then by name", () => {
    const rows = [
      queue("Q10", "IN_PROGRESS"),
      queue("Draft", "DRAFT"),
      queue("Paused", "PAUSED"),
      queue("Q2", "IN_PROGRESS"),
    ];
    expect(unfinishedBackfills(rows).map((r) => r.name)).toEqual([
      "Q2",
      "Q10",
      "Paused",
      "Draft",
    ]);
  });

  it("keeps an unknown status, which reads as a draft", () => {
    expect(unfinishedBackfills([queue("Odd", "SOMETHING_NEW")])).toHaveLength(1);
  });
});
