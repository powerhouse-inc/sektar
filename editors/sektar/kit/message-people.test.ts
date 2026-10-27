import { describe, expect, it } from "vitest";
import { messagePeople } from "./mail.js";

const box = (address: string, name: string | null = null) => ({
  address,
  name,
});

describe("messagePeople", () => {
  it("lists an address once, with its roles joined in order", () => {
    const people = messagePeople({
      from: [box("jane@example.com", "Jane")],
      to: [box("me@example.com")],
      cc: [box("Me@Example.com", "Me")],
      bcc: [],
      replyTo: [box("jane@example.com")],
    });
    expect(people.map((p) => [p.m.address, p.m.name, p.role])).toEqual([
      ["jane@example.com", "Jane", "Sender · Reply to"],
      ["Me@Example.com", "Me", "To · Cc"],
    ]);
    expect(new Set(people.map((p) => p.key)).size).toBe(people.length);
  });

  it("keeps different addresses apart, in role order", () => {
    const people = messagePeople({
      from: [box("a@example.com")],
      to: [box("b@example.com"), box("c@example.com")],
      cc: [],
      bcc: [box("d@example.com")],
      replyTo: [],
    });
    expect(people.map((p) => p.role)).toEqual(["Sender", "To", "To", "Bcc"]);
  });
});
