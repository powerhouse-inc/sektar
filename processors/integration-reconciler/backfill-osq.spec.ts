import {
  actions as osq,
  reducer,
  utils,
  type OriginalSourceQueueDocument,
} from "document-models/original-source-queue";
import { describe, expect, it } from "vitest";
import { shapeOf } from "../../pieces/distyra/lib/osq/client.js";
import {
  dateRangeOf,
  forEveryConfig,
  queueProgress,
  queueSetup,
  SLICE_RANGE,
  type BackfillItem,
} from "./backfill-osq.js";

const WEEK = 7 * 24 * 3600;
const item = (
  patch: Partial<BackfillItem["request"] & object> = {},
): BackfillItem => ({
  id: "bf-1",
  label: "Back to 1 Oct 2026",
  documentType: "distyra/original-source-queue",
  documentId: null,
  request: {
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-29T00:00:00.000Z",
    stepSeconds: WEEK,
    direction: "BACKWARD",
    ...patch,
  } as BackfillItem["request"],
});

type Action = Parameters<typeof reducer>[1];
const apply = (doc: OriginalSourceQueueDocument, ...list: Action[]) =>
  list.reduce((d, a) => {
    const next = reducer(d, a);
    expect(next.operations.global.at(-1)?.error).toBeFalsy();
    return next;
  }, doc);

/** A queue as the reconciler sets it up, then walked as the for-every trigger walks it. */
function walked(i: BackfillItem, proceeds: number) {
  let doc = apply(
    utils.createDocument(),
    ...queueSetup("Cal", i, "c1")!.actions,
  );
  const before = doc.state.global;
  doc = apply(doc, osq.start({}));
  for (let n = 0; n < proceeds; n++) doc = apply(doc, osq.proceed({}));
  return { before, doc };
}

describe("the OSQ backfill adapter", () => {
  it("makes a queue that walks a week at a time, newest first, with the window the workflow reads", () => {
    const setup = queueSetup("Powerhouse Calendar", item(), "c1")!;
    expect(setup.name).toBe("Powerhouse Calendar · Back to 1 Oct 2026");
    const { before, doc } = walked(item(), 0);
    expect(before.status).toBe("DRAFT");
    expect(queueProgress(before)).toEqual({
      done: 0,
      total: 4,
      finished: false,
    });

    // The first slice is the most recent week; the window is always earlier → later
    const first = shapeOf("q1", doc.state.global).ranges[SLICE_RANGE];
    expect(first).toEqual({
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-29T00:00:00.000Z",
    });
    expect(queueProgress(doc.state.global)).toEqual({
      done: 0,
      total: 4,
      finished: false,
    });

    const later = walked(item(), 3).doc.state.global;
    expect(shapeOf("q1", later).ranges[SLICE_RANGE]).toEqual({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-08T00:00:00.000Z",
    });
    expect(queueProgress(later)).toEqual({
      done: 3,
      total: 4,
      finished: false,
    });

    const done = apply(walked(item(), 3).doc, osq.proceed({})).state.global;
    expect(done.status).toBe("FINISHED");
    expect(queueProgress(done)).toEqual({ done: 4, total: 4, finished: true });
  });

  it("walks forward from the start for a FORWARD item, clipping the last slice to the range", () => {
    const forward = item({
      from: "2026-10-28T00:00:00.000Z",
      to: "2026-11-15T00:00:00.000Z",
      direction: "FORWARD",
    });
    const { doc } = walked(forward, 0);
    expect(shapeOf("q", doc.state.global).ranges[SLICE_RANGE]).toEqual({
      from: "2026-10-28T00:00:00.000Z",
      to: "2026-11-04T00:00:00.000Z",
    });
    const last = walked(forward, 2).doc.state.global;
    expect(shapeOf("q", last).ranges[SLICE_RANGE]).toEqual({
      from: "2026-11-11T00:00:00.000Z",
      to: "2026-11-15T00:00:00.000Z",
    });
    expect(queueProgress(last).total).toBe(3);
  });

  it("knows only date ranges, and points the trigger at a queue", () => {
    expect(
      dateRangeOf({ ...item(), request: { folders: ["INBOX"] } as never }),
    ).toBeNull();
    expect(queueSetup("x", { ...item(), request: null }, "c")).toBeNull();
    // An item from before directions: newest first
    expect(
      queueSetup("x", item({ direction: null }), "c")?.actions[1]?.input,
    ).toMatchObject({
      first: "2026-10-29T00:00:00.000Z",
      last: "2026-10-01T00:00:00.000Z",
    });
    // Reads only: the workflow's last step moves the queue.
    expect(forEveryConfig("q1")).toEqual({
      documentId: "q1",
    });
  });
});
