import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A fresh copy of the module: `unstored` must not leak between tests. */
const load = async () => {
  vi.resetModules();
  return await import("./user-name.js");
};

function memoryStorage(seed: Record<string, string> = {}) {
  const items = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const refused = () => {
  throw new Error("The storage is not available");
};

const throwing = { getItem: refused, setItem: refused, removeItem: refused };

describe("the user's name", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("is empty until it is set", async () => {
    const { getUserName } = await load();
    expect(getUserName()).toBe("");
  });

  it("is remembered in the browser", async () => {
    const { setUserName } = await load();
    setUserName("Marit");
    expect(localStorage.getItem("sektar:user-name")).toBe("Marit");
    const reloaded = await load();
    expect(reloaded.getUserName()).toBe("Marit");
  });

  it("is trimmed to one line", async () => {
    const { getUserName, setUserName } = await load();
    setUserName("  Marit \n van  Dijk ");
    expect(getUserName()).toBe("Marit van Dijk");
  });

  it("counts as not set when it is only whitespace", async () => {
    const { getUserName, setUserName } = await load();
    setUserName("   ");
    expect(getUserName()).toBe("");
    expect(localStorage.getItem("sektar:user-name")).toBeNull();
    localStorage.setItem("sektar:user-name", "   ");
    expect(getUserName()).toBe("");
  });

  it("clears with an empty name", async () => {
    const { getUserName, setUserName } = await load();
    setUserName("Marit");
    setUserName("");
    expect(getUserName()).toBe("");
    expect(localStorage.getItem("sektar:user-name")).toBeNull();
  });

  it("reads as not set when the storage throws", async () => {
    vi.stubGlobal("localStorage", throwing);
    const { getUserName } = await load();
    expect(getUserName()).toBe("");
  });

  it("stays for the session when the storage throws", async () => {
    vi.stubGlobal("localStorage", throwing);
    const { getUserName, setUserName } = await load();
    expect(() => setUserName("Marit")).not.toThrow();
    expect(getUserName()).toBe("Marit");
  });

  it("stays for the session when only writing throws", async () => {
    vi.stubGlobal("localStorage", {
      ...memoryStorage({ "sektar:user-name": "Old" }),
      setItem: refused,
    });
    const { getUserName, setUserName } = await load();
    setUserName("Marit");
    expect(getUserName()).toBe("Marit");
  });

  it("goes back to the storage once it takes a name again", async () => {
    const storage = { ...memoryStorage(), setItem: refused };
    vi.stubGlobal("localStorage", storage);
    const { getUserName, setUserName } = await load();
    setUserName("Marit");
    vi.stubGlobal("localStorage", memoryStorage());
    setUserName("Sara");
    expect(getUserName()).toBe("Sara");
    expect(localStorage.getItem("sektar:user-name")).toBe("Sara");
  });
});

describe("greeting", () => {
  it("uses the name", async () => {
    const { greeting } = await load();
    expect(greeting(9, "Marit")).toBe("Good morning, Marit.");
    expect(greeting(14, "Marit")).toBe("Good afternoon, Marit.");
    expect(greeting(20, "Marit")).toBe("Good evening, Marit.");
  });

  it("reads naturally without one", async () => {
    const { greeting } = await load();
    expect(greeting(9, "")).toBe("Good morning.");
    expect(greeting(14, "")).toBe("Good afternoon.");
    expect(greeting(20, "")).toBe("Good evening.");
  });
});
