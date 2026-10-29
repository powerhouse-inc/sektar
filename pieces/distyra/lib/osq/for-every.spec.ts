/**
 * For Every and Proceed, run against the real queue reducer.
 *
 * The reactor is faked only as far as get and execute; every action goes
 * through the document model, so the guard on PROCEED is the real one. What
 * matters is which tuples the flow is handed, in what order, and that none
 * is skipped when a run fails or two runs land on the same one.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import {
  addCollectionValue,
  createCollection,
  createCollectionCursor,
  createNumberCursor,
  proceed,
  proceedWithError,
  reducer,
  start,
  utils,
  type OriginalSourceQueueDocument,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";
import {
  distyraOsqProceedAction,
  distyraOsqProceedWithErrorAction,
} from "./actions.js";
import { expectedTupleOf, OSQ_TYPE } from "./client.js";
import { distyraForEveryTrigger, MAX_HAND_OUTS } from "./for-every.js";

type Doc = OriginalSourceQueueDocument;
type Firing = { values: Record<string, unknown>; _dedupe_key?: string };

const creators: Record<
  string,
  (input: never) => Parameters<typeof reducer>[1]
> = {
  START: start as never,
  PROCEED: proceed as never,
  PROCEED_WITH_ERROR: proceedWithError as never,
};

/** A reactor holding one queue document, written through its reducer. */
function fakeReactor(initial: Doc) {
  let document = initial;
  const reactor = {
    get: () =>
      Promise.resolve({
        header: { documentType: OSQ_TYPE },
        state: document.state,
      }),
    execute: (
      _id: string,
      _branch: string,
      actions: { type: string; input?: unknown }[],
    ) => {
      for (const action of actions) {
        document = reducer(
          document,
          creators[action.type](action.input as never),
        );
      }
      return Promise.resolve({ state: document.state });
    },
  };
  const kept = new Map<string, unknown>();
  const store = {
    get: <T>(key: string) =>
      Promise.resolve((kept.get(key) ?? null) as T | null),
    put: <T>(key: string, value: T) => {
      kept.set(key, value);
      return Promise.resolve(value);
    },
  };
  return {
    reactor,
    store,
    add: (values: string[]) => {
      document = reducer(
        document,
        addCollectionValue({ collection: "files", values }),
      );
    },
    operations: () => document.operations.global,
  };
}

/** A draft over the numbers 1 to 3. */
function threeNumbers(): Doc {
  return reducer(
    utils.createDocument(),
    createNumberCursor({ id: "n", name: "N", first: 1, last: 3, step: 1 }),
  );
}

type Fake = Pick<ReturnType<typeof fakeReactor>, "reactor" | "store">;

function poll({ reactor, store }: Fake): Promise<Firing[]> {
  return distyraForEveryTrigger.run({
    propsValue: { documentId: "q" },
    reactor,
    store,
  } as never) as Promise<Firing[]>;
}

/** Switching the workflow on (again). */
function enable({ reactor, store }: Fake): Promise<void> {
  return distyraForEveryTrigger.onEnable({
    propsValue: { documentId: "q" },
    reactor,
    store,
  } as never);
}

function proceedFrom(
  reactor: ReturnType<typeof fakeReactor>["reactor"],
  position: unknown,
): Promise<{ moved: boolean; values: Record<string, unknown> }> {
  return distyraOsqProceedAction.run({
    propsValue: { documentId: "q", position },
    reactor,
  } as never) as Promise<{ moved: boolean; values: Record<string, unknown> }>;
}

describe("For Every", () => {
  it("hands out each tuple until the flow's Proceed moves past it", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor } = queue;
    const [first] = await poll(queue);
    expect(first.values).toEqual({ n: 1 });
    // Polled again before the run ended: the same tuple, not the next.
    expect((await poll(queue))[0].values).toEqual({ n: 1 });

    expect((await proceedFrom(reactor, first)).moved).toBe(true);
    expect((await poll(queue))[0].values).toEqual({ n: 2 });
  });

  it("keys each firing by its tuple, so a repeat within seconds is dropped", async () => {
    const queue = fakeReactor(threeNumbers());
    const [first] = await poll(queue);
    const [again] = await poll(queue);
    expect(first._dedupe_key).toBe('q:{"n":1}');
    expect(again._dedupe_key).toBe(first._dedupe_key);
  });

  it("hands a failed run's tuple out again instead of losing it", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor } = queue;
    const [first] = await poll(queue);
    await proceedFrom(reactor, first);
    // The run on 2 fails before its Proceed step.
    await poll(queue);
    expect((await poll(queue))[0].values).toEqual({ n: 2 });
  });

  it("moves once when two runs worked on the same tuple", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor, operations } = queue;
    const [first] = await poll(queue);
    const [retry] = await poll(queue);

    expect((await proceedFrom(reactor, first)).moved).toBe(true);
    const late = await proceedFrom(reactor, retry);
    expect(late.moved).toBe(false);
    expect(late.values).toEqual({ n: 2 });
    // Seen as already done before writing: no refused operation either.
    expect(operations().filter((op) => op.error)).toHaveLength(0);
    expect((await poll(queue))[0].values).toEqual({ n: 2 });
  });

  it("goes quiet once the last tuple's Proceed finishes the walk", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor } = queue;
    for (const n of [1, 2, 3]) {
      const [firing] = await poll(queue);
      expect(firing.values).toEqual({ n });
      await proceedFrom(reactor, firing);
    }
    expect(await poll(queue)).toEqual([]);
  });

  it("takes up values that arrive while the collection is empty", async () => {
    let draft = reducer(
      utils.createDocument(),
      createCollection({ id: "files", name: "Files", values: [] }),
    );
    draft = reducer(
      draft,
      createCollectionCursor({ id: "f", name: "F", collection: "files" }),
    );
    const queue = fakeReactor(draft);

    expect(await poll(queue)).toEqual([]);
    expect(await poll(queue)).toEqual([]);
    queue.add(["a.pdf", "b.pdf"]);
    const [first] = await poll(queue);
    expect(first.values).toEqual({ f: "a.pdf" });
    await proceedFrom(queue.reactor, first);
    expect((await poll(queue))[0].values).toEqual({
      f: "b.pdf",
    });
  });
});

describe("For Every, catching a loop that does not move on", () => {
  it("stops handing out a position the flow keeps not moving past", async () => {
    const queue = fakeReactor(threeNumbers());
    for (let i = 0; i < MAX_HAND_OUTS; i++) {
      expect((await poll(queue))[0].values).toEqual({ n: 1 });
    }
    await expect(poll(queue)).rejects.toThrow(
      /handed out the same position 3 times in a row .*End the flow with Proceed/,
    );
  });

  it("counts a position afresh once the queue moved on", async () => {
    const queue = fakeReactor(threeNumbers());
    const [first] = await poll(queue);
    await poll(queue);
    await proceedFrom(queue.reactor, first);
    for (let i = 0; i < MAX_HAND_OUTS; i++) {
      expect((await poll(queue))[0].values).toEqual({ n: 2 });
    }
  });

  it("starts counting again when the workflow is switched on", async () => {
    const queue = fakeReactor(threeNumbers());
    for (let i = 0; i < MAX_HAND_OUTS; i++) await poll(queue);
    await enable(queue);
    expect((await poll(queue))[0].values).toEqual({ n: 1 });
  });
});

describe("Proceed without a position", () => {
  it("moves from wherever the queue is", async () => {
    const { reactor } = fakeReactor(reducer(threeNumbers(), start({})));
    const result = await proceedFrom(reactor, undefined);
    expect(result.moved).toBe(true);
    expect(result.values).toEqual({ n: 2 });
  });
});

describe("Proceed With Error, with a position", () => {
  function failAt(
    reactor: ReturnType<typeof fakeReactor>["reactor"],
    position: unknown,
  ): Promise<{ moved: boolean }> {
    return distyraOsqProceedWithErrorAction.run({
      propsValue: { documentId: "q", message: "boom", position },
      reactor,
    } as never) as Promise<{ moved: boolean }>;
  }

  it("records the failure on the tuple the run worked on, and moves on", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor } = queue;
    const [first] = await poll(queue);
    expect((await failAt(reactor, first)).moved).toBe(true);
    expect((await poll(queue))[0].values).toEqual({ n: 2 });
  });

  it("records nothing once the queue has left that tuple", async () => {
    const queue = fakeReactor(threeNumbers());
    const { reactor, operations } = queue;
    const [first] = await poll(queue);
    await proceedFrom(reactor, first);
    expect((await failAt(reactor, first)).moved).toBe(false);
    expect(operations().map((op) => op.action.type)).toEqual([
      "CREATE_NUMBER_CURSOR",
      "START",
      "PROCEED",
    ]);
  });

  it("without a position, records and moves from wherever the queue is", async () => {
    const { reactor } = fakeReactor(reducer(threeNumbers(), start({})));
    expect((await failAt(reactor, undefined)).moved).toBe(true);
  });
});

describe("reading the position a run passes back", () => {
  it("takes the trigger payload or a bare list of cursors", () => {
    expect(
      expectedTupleOf({ cursors: [{ id: "n", value: 1, position: 0 }] }),
    ).toEqual([{ cursor: "n", value: 1 }]);
    expect(expectedTupleOf([{ cursor: "n", value: 1 }])).toEqual([
      { cursor: "n", value: 1 },
    ]);
    expect(expectedTupleOf([{ cursor: "n" }])).toEqual([
      { cursor: "n", value: null },
    ]);
  });

  it("refuses anything that names no cursors", () => {
    expect(() => expectedTupleOf("{{trigger.payload}}")).toThrow(
      /trigger's payload/,
    );
    expect(() => expectedTupleOf({ cursors: [] })).toThrow(/trigger's payload/);
    expect(() => expectedTupleOf([{ value: 1 }])).toThrow(/needs its id/);
    expect(() => expectedTupleOf([null])).toThrow(/needs its id/);
  });
});
