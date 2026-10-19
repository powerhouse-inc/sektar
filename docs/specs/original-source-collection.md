# OriginalSourceCollection (OSC) — one-pager

**Type id** `distyra/original-source-collection` · **extension** `osc` · **status** proposed

## Purpose

The OSQ knows *where you are* in a space you are walking. The OSC holds *what you found there*,
before anyone has decided what it means.

Capture and interpretation are separate acts, and conflating them is the mistake this document
model exists to prevent. Processing is lossy: it keeps the fields you thought you needed and
discards the rest, and you find out a year later that you needed one of the others. The 62 card
statements only became verifiable because the PDFs were kept beside the parsed numbers — the
scanned total could be checked against the calculated one precisely because nothing had been
thrown away. The Gmail flow did the same thing by accident: `emails.json` plus 81 downloaded
attachments is an OSC built by hand.

So the rule this model enforces: **capture never transforms, and nothing is ever destroyed.**
Classification is additive and reversible. `DISCARDED` is how you say "ignore this" — there is no
delete.

The two models are a pair. An OSQ walks the space and records which slices failed; an OSC receives
what each slice produced. Together they answer "is this backfill complete?" — the queue says which
slices were attempted and which failed, the collection says what came back. Neither can answer it
alone.

```
ForEvery (OSQ) ──▶ fetch a slice ──▶ CaptureSource (OSC) ──▶ OnNewSource ──▶ process
      │                                                                          │
      └── knows where it is, and what failed          holds the evidence, untouched
```

---

## State

Two scalars to note before reading: there is **no `JSON` scalar** in document models — `Unknown`
is the one (it maps to TS `unknown`). `AttachmentRef` is the content-addressed attachment scalar
already used for statement PDFs.

```graphql
enum OriginalSourceStatus {
    NEW
    PROCESSING
    COMPLETED
    DISCARDED
}

enum ProcessingTaskStatus {
    DRAFT
    TODO
    IN_PROGRESS
    DONE
    CANCELLED
}

"""Where this collection's contents came from, as a whole."""
type OSCProvenance {
    """The OSQ that drove the capture, when one did. This is what lets the two
    documents be read together: the queue names the slices that failed, the
    collection holds what the rest produced."""
    queue: PHID
    """A short name for the source system: gmail, toggl, filesystem."""
    system: String
    """Anything else worth recording about the run, verbatim."""
    detail: Unknown
}

type OriginalSource {
    id: OID!
    status: OriginalSourceStatus!

    """The source system's own identifier — a Gmail message id, a file digest,
    a Toggl entry id. THE most important field here: without it a re-run of a
    backfill duplicates everything it already captured."""
    externalId: String

    title: String
    origin: URL

    """Human-readable text, when the source has any. Large bodies belong in
    attachments; this is for what a person would read in a list."""
    content: String

    """The record exactly as received, untouched. Singular and verbatim — this
    is the thing the whole model exists to keep."""
    payload: Unknown

    attachments: [AttachmentRef!]!
    references: [URL!]!
    tags: [String!]!

    """When the thing happened at the source."""
    occurredAt: DateTime
    """When we captured it. Different from occurredAt, and both are needed —
    a 2019 email captured today is dated 2019 for analysis and today for
    'what did this run pick up'."""
    capturedAt: DateTime!
}

type ProcessingTask {
    id: OID!
    status: ProcessingTaskStatus!
    owner: String
    description: String

    """The source this is about, when it is about one. A task with no source
    is about the batch — 'reconcile this month against the bank'."""
    source: OID

    createdAt: DateTime!
}

type OSCCounts {
    total: Int!
    new: Int!
    processing: Int!
    completed: Int!
    discarded: Int!
    openTasks: Int!
}

type OriginalSourceCollectionState {
    name: String
    description: String
    provenance: OSCProvenance

    sources: [OriginalSource!]!
    tasks: [ProcessingTask!]!

    """Calculated. NEW while nothing has been touched, PROCESSING once
    anything has, COMPLETED when every source is completed or discarded.
    DISCARDED is the one value that is set rather than derived, because
    abandoning a whole collection is a decision, not a roll-up."""
    status: OriginalSourceStatus!

    """Calculated."""
    counts: OSCCounts!
}
```

### Changes from the sketch, and why

| Sketch | Proposed | Reason |
|---|---|---|
| `provenance: JSON` | `OSCProvenance` with `queue: PHID` | No `JSON` scalar exists. More importantly, a typed `queue` link is what joins an OSC to the OSQ that filled it. |
| — | `externalId` on a source | Without it, re-running a backfill duplicates everything. This is the lesson from `sourceSha256` on statements and `externalId` on ledger rows. |
| — | `capturedAt` / `occurredAt` | Two different times. Dating analysis by capture time is the bug that made "March 2024 spend" move when a statement was imported in 2026. |
| `data: [JSON!]!` | `payload: Unknown` | An unkeyed array of blobs has no meaning a consumer can rely on. One verbatim record is what "original source" means. Keep the array only if a source genuinely yields several records. |
| `ProcessingTask` dangling | `tasks` on the collection, with optional `source` | The sketch defines the type but never attaches it. Collection-level with an optional link covers both "review this item" and "review this batch". |
| `status` ambiguous | calculated, except `DISCARDED` | Consistent with the OSQ: everything derivable is derived by the reducers. |

Open question worth deciding before building: whether `tags` should be free strings or drawn from
a declared vocabulary on the collection. Free strings are simpler and fine for one author;
a vocabulary prevents `invoice` / `Invoice` / `invoices` from becoming three classifications the
moment a second flow writes tags. **Recommendation: free strings now**, with a `labels` list added
later if drift actually appears.

---

## Operations

**Capture** — allowed in any status but `DISCARDED`.

| Operation | Notes |
|---|---|
| `CAPTURE_SOURCE` | The workhorse. **Idempotent on `externalId`**: capturing one already present updates it in place rather than adding a second. This is what makes a re-run safe. |
| `ATTACH_TO_SOURCE` | Add an attachment after the fact. The ref must reach the document *before* the bytes are uploaded, or the download will not authorize. |
| `ADD_SOURCE_REFERENCE` | A URL pointing at something related. |

**Classify** — additive and reversible; none of these touches `payload`.

| Operation | Notes |
|---|---|
| `SET_SOURCE_TITLE` | |
| `TAG_SOURCE` / `UNTAG_SOURCE` | Tags are a set; tagging twice is not an error. |
| `SET_SOURCE_STATUS` | `NEW → PROCESSING → COMPLETED`. Anything → `DISCARDED`. |
| `DISCARD_SOURCE` | Convenience for the above, so "ignore this" is one obvious call. |

**Tasks**

`CREATE_TASK`, `SET_TASK_STATUS`, `ASSIGN_TASK`, `SET_TASK_DESCRIPTION`, `CANCEL_TASK`.
No delete: a cancelled task is a record that someone decided not to do it.

**Collection**

`SET_NAME`, `SET_DESCRIPTION`, `SET_PROVENANCE`, `DISCARD_COLLECTION`.

**Deliberately absent: `DELETE_SOURCE`.** An original-source store that can forget is not one.
`DISCARDED` covers every real need, and keeps the record of what was rejected.

---

## Pieces (added to the Distyra piece, alongside the OSQ steps)

| Element | Does |
|---|---|
| **CaptureSource** (action) | Capture one record. Pairs directly with `ForEvery`: the queue hands a slice, the fetch produces a record, this stores it. Returns whether it created or updated, so a flow can count new work. |
| **CaptureSources** (action) | The batch form — one call per slice rather than per record, which matters when a week of Gmail is 300 messages. |
| **FindSource** (action) | Look up by `externalId` without writing. Lets a flow skip fetching something it already has. |
| **TagSource** / **SetSourceStatus** (actions) | Classification from a flow. |
| **CreateTask** (action) | Raise work for a person — "this one needs a human". |
| **OnNewSource** (trigger) | Fires once per source captured since the last tick, oldest first. This is the second stage of the pipeline: `ForEvery` drives capture, `OnNewSource` drives processing, and each stage is independently resumable. |

`OnNewSource` needs a watermark so it does not re-fire. Two options: a `PROCESSING` status
transition as the marker (visible in the document, but conflates "a trigger saw it" with "work
started"), or trigger-local store state (invisible, but honest about what it means).
**Recommendation: trigger-local**, with `SetSourceStatus` left as an explicit step the flow calls
when it genuinely starts work.

---

## Verification, when built

1. Capturing the same `externalId` twice yields one source, updated — proven against a real run,
   not asserted.
2. An OSC filled by an OSQ can be joined back to it: the queue's failed slices plus the
   collection's sources account for every position in the space.
3. `OnNewSource` fires exactly once per captured source across a restart.
4. Reducer coverage ≥95%, scenario-first, errors asserted via `operations.global[i].error`.
