import {
  addPerson,
  addTag,
  archiveContact,
  reducer,
  removePerson,
  removeTag,
  setAddress,
  setBankDetails,
  setPaymentTerms,
  setProfile,
  updatePerson,
  utils,
  type ContactDocument,
} from "document-models/contact/v1";
import { describe, expect, it } from "vitest";

const lastError = (doc: ContactDocument) => doc.operations.global.at(-1)?.error;

describe("contact record", () => {
  it("fills a supplier profile end to end", () => {
    let doc = reducer(
      utils.createDocument(),
      setProfile({
        name: "WeWork Amsterdam",
        kind: "SUPPLIER",
        email: "billing@wework.com",
        phone: null,
        website: "https://wework.com",
        vatId: "NL1",
        registrationNumber: "KVK 1",
        notes: "Office",
      }),
    );
    doc = reducer(
      doc,
      setAddress({
        street: "Weesperstraat 61",
        postalCode: "1018 VN",
        city: "Amsterdam",
        country: "Netherlands",
      }),
    );
    doc = reducer(
      doc,
      setBankDetails({
        iban: "NL02",
        bic: "ABNANL2A",
        accountHolder: "WeWork NL",
      }),
    );
    doc = reducer(
      doc,
      setPaymentTerms({ paymentTermsDays: 14, defaultCategory: "RENT" }),
    );
    doc = reducer(doc, addTag({ tag: " office " }));
    doc = reducer(doc, addTag({ tag: "rent" }));
    doc = reducer(
      doc,
      addPerson({
        id: "p1",
        name: "Ana",
        role: "Account manager",
        email: "ana@wework.com",
      }),
    );
    doc = reducer(doc, addPerson({ id: "p2", name: "Ben" }));
    doc = reducer(
      doc,
      updatePerson({
        id: "p2",
        name: "Benjamin",
        role: "Billing",
        email: null,
        phone: "+31 6",
      }),
    );
    let s = doc.state.global;
    expect(s).toMatchObject({
      name: "WeWork Amsterdam",
      kind: "SUPPLIER",
      status: "ACTIVE",
      email: "billing@wework.com",
      phone: null,
      website: "https://wework.com",
      address: {
        street: "Weesperstraat 61",
        postalCode: "1018 VN",
        city: "Amsterdam",
        country: "Netherlands",
      },
      bank: { iban: "NL02", bic: "ABNANL2A", accountHolder: "WeWork NL" },
      paymentTermsDays: 14,
      defaultCategory: "RENT",
      tags: ["office", "rent"],
    });
    expect(s.people).toEqual([
      {
        id: "p1",
        name: "Ana",
        role: "Account manager",
        email: "ana@wework.com",
        phone: null,
      },
      {
        id: "p2",
        name: "Benjamin",
        role: "Billing",
        email: null,
        phone: "+31 6",
      },
    ]);

    doc = reducer(doc, removeTag({ tag: "office" }));
    doc = reducer(doc, removePerson({ id: "p1" }));
    doc = reducer(doc, setAddress({ city: "Utrecht" }));
    doc = reducer(doc, setBankDetails({}));
    doc = reducer(doc, setPaymentTerms({ paymentTermsDays: 0 }));
    doc = reducer(doc, setProfile({ kind: "BOTH", notes: null }));
    s = doc.state.global;
    expect(s.tags).toEqual(["rent"]);
    expect(s.people.map((p) => p.id)).toEqual(["p2"]);
    expect(s.address).toEqual({
      street: null,
      postalCode: null,
      city: "Utrecht",
      country: null,
    });
    expect(s.bank).toEqual({ iban: null, bic: null, accountHolder: null });
    expect(s.paymentTermsDays).toBe(0);
    expect(s.defaultCategory).toBe("RENT");
    expect(s.kind).toBe("BOTH");
    expect(s.notes).toBeNull();

    doc = reducer(doc, archiveContact({ archived: true }));
    expect(doc.state.global.status).toBe("ARCHIVED");
    doc = reducer(doc, archiveContact({ archived: true }));
    expect(lastError(doc)).toBe("The contact is already archived");
    doc = reducer(doc, archiveContact({ archived: false }));
    expect(doc.state.global.status).toBe("ACTIVE");
    doc = reducer(doc, archiveContact({ archived: false }));
    expect(lastError(doc)).toBe("The contact is already active");
  });

  it("rejects bad terms, tags and unknown people", () => {
    let doc = reducer(
      utils.createDocument(),
      setPaymentTerms({ paymentTermsDays: -1 }),
    );
    expect(lastError(doc)).toBe("Payment terms cannot be negative");
    doc = reducer(doc, addTag({ tag: "  " }));
    expect(lastError(doc)).toBe("A tag needs text");
    doc = reducer(doc, addTag({ tag: "vip" }));
    doc = reducer(doc, addTag({ tag: "vip" }));
    expect(lastError(doc)).toBe("Tag vip exists");
    doc = reducer(doc, removeTag({ tag: "nope" }));
    expect(lastError(doc)).toBe("Tag nope not found");
    doc = reducer(doc, updatePerson({ id: "ghost", name: "x" }));
    expect(lastError(doc)).toBe("Person ghost not found");
    doc = reducer(doc, removePerson({ id: "ghost" }));
    expect(lastError(doc)).toBe("Person ghost not found");
    doc = reducer(
      doc,
      addPerson({ id: "p", name: "Solo", role: null, email: "", phone: "" }),
    );
    expect(doc.state.global.people[0]).toEqual({
      id: "p",
      name: "Solo",
      role: null,
      email: null,
      phone: null,
    });
    doc = reducer(doc, updatePerson({ id: "p", role: "Lead" }));
    expect(doc.state.global.people[0]).toMatchObject({
      name: "Solo",
      role: "Lead",
    });
  });
});
