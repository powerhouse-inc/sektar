import type * as ReactorChat from "@powerhousedao/reactor-browser/ai";
import type { AiConnection } from "@powerhousedao/reactor-browser/ai";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Conversation } from "../hosts/connect/routes/-shared/assistant.js";
import { assistantInstructions } from "./instructions.js";

const chat = vi.hoisted(() => ({
  useReactorChat: vi.fn((..._args: unknown[]) => ({
    messages: [],
    clear: () => {},
  })),
}));

vi.mock("@powerhousedao/reactor-browser/ai", async (original) => ({
  ...(await original<typeof ReactorChat>()),
  ChatPanel: ({ emptyState }: { emptyState: ReactNode }) => emptyState,
  useReactorChat: chat.useReactorChat,
}));

const connection: AiConnection = {
  baseUrl: "http://localhost/ai/v1",
  model: "a-model",
};

const NOW = new Date(2026, 9, 30);

function stubName(name?: string) {
  vi.stubGlobal("localStorage", {
    getItem: () => name ?? null,
  });
}

/** The panel's text, and the instruction it passed to the chat. */
function renderPanel() {
  const text = renderToStaticMarkup(
    <Conversation connection={connection} model="a-model" />,
  );
  const [, options] = chat.useReactorChat.mock.calls.at(-1) as [
    unknown,
    { instructions: string },
  ];
  return { text, instructions: options.instructions };
}

beforeEach(() => chat.useReactorChat.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("the assistant and the user's name", () => {
  it("tells the model the name", () => {
    expect(assistantInstructions(NOW, "Marit")).toContain(
      "The user's name is Marit; address them by it.",
    );
  });

  it("leaves that part out without a name", () => {
    expect(assistantInstructions(NOW, "")).not.toContain("user's name");
    expect(assistantInstructions(NOW)).toBe(assistantInstructions(NOW, ""));
  });

  it("greets the user by name in the empty chat and tells the model", () => {
    stubName("Marit");
    const { text, instructions } = renderPanel();
    expect(text).toContain("Hi Marit. Ask about your invoices");
    expect(instructions).toContain("The user's name is Marit");
  });

  it("reads without a greeting when there is no name", () => {
    stubName();
    const { text, instructions } = renderPanel();
    expect(text).not.toContain("Hi ");
    expect(text).toContain("Ask about your invoices");
    expect(instructions).not.toContain("user's name");
  });
});
