import type { DocumentModelGlobalState } from "document-model";

export const documentModel: DocumentModelGlobalState = {
  id: "distyra/original-source-queue",
  name: "OriginalSourceQueue",
  author: {
    name: "Powerhouse",
    website: "https://www.powerhouse.inc/",
  },
  extension: "osq",
  description:
    "Tracks the backfilling of an original source as nested loops over time, numbers and queues. A state machine rather than a data structure: the reducers advance the cursors like an odometer and calculate every derivable value, so a workflow never does arithmetic and never decides what comes next. Errors are recorded against the exact cursor tuple that produced them, so a failed slice can be named rather than guessed at.",
  specifications: [
    {
      state: {
        local: {
          schema: "",
          examples: [],
          initialValue: "",
        },
        global: {
          schema:
            '"""\nWhere the queue is in its life.\n- DRAFT: still being defined; cursors and collections may be changed.\n- IN_PROGRESS: walking. Only here may values be queued or errors reported.\n- PAUSED: stopped by hand, resumable exactly where it left off.\n- FINISHED: the space is walked, or it was terminated early.\n"""\nenum OSQStatus {\n    DRAFT\n    IN_PROGRESS\n    FINISHED\n    PAUSED\n}\n\n"""\nA queue of values a cursor can walk. Unlike a range, it is live: values may\nbe pushed while the walk is running, which is what makes discover-then-drain\nbackfills expressible.\n"""\ntype OSQCollection {\n    id: OID!\n    name: String!\n    values: [Unknown!]!\n}\n\n"""\nA cursor over time, iterating INTERVALS rather than points.\n\ncurrent and next are the half-open range [current, next) \u2014 exactly the\nafter/before pair an API query wants. The final interval is clipped to last,\nso the intervals cover the span with no gap and no overhang.\n\nfirst and last set the direction of travel; counting down is the common case\nfor a backfill (newest first). Direction reverses the ORDER intervals are\nvisited in, never the orientation of one: current is always the earlier bound.\n"""\ntype OSQDateTimeCursor {\n    id: OID!\n    name: String\n    description: String\n    first: DateTime!\n    last: DateTime!\n    deltaSeconds: Int!\n\n    position: Int!\n    current: DateTime\n    next: DateTime\n    finished: Boolean!\n    count: Int!\n}\n\n"""\nA cursor over whole numbers, iterating POINTS.\n\nfirst and last set the direction of travel, so 52 -> 1 counts down. step is\ntherefore a magnitude and must be positive.\n"""\ntype OSQNumberCursor {\n    id: OID!\n    name: String\n    description: String\n    first: Int!\n    last: Int!\n    step: Int!\n\n    position: Int!\n    current: Int\n    next: Int\n    finished: Boolean!\n    count: Int!\n}\n\n"""\nA cursor over a collection. current and next are INDICES into it; the value\nitself is read from the collection, because an index outlives a value and a\nvalue does not outlive a clear.\n"""\ntype OSQCollectionCursor {\n    id: OID!\n    name: String\n    description: String\n    collection: OID!\n\n    position: Int!\n    current: Int\n    next: Int\n    finished: Boolean!\n    count: Int!\n}\n\nunion OSQCursor = OSQDateTimeCursor | OSQNumberCursor | OSQCollectionCursor\n\n"""One cursor\'s reading at a moment, as recorded on an error."""\ntype OSQCursorValue {\n    cursor: OID!\n    value: Unknown\n}\n\n"""\nA failure, stamped with where it happened.\n\ncursors is the full tuple at the moment the error was reported, which is what\nturns a bare failure into one located at 2024, week 31, Tuesday.\n"""\ntype OSQError {\n    id: OID!\n    message: String!\n    data: Unknown\n    cursors: [OSQCursorValue!]!\n}\n\n"""A named scratchpad slot that survives an iteration boundary."""\ntype OSQMemoryEntry {\n    key: String!\n    value: Unknown\n}\n\ntype OriginalSourceQueueState {\n    description: String\n    cursors: [OSQCursor!]!\n    collections: [OSQCollection!]!\n    memory: [OSQMemoryEntry!]!\n\n    """\n    Every failure, in the order reported. The tuple on each one is what makes\n    a failed slice nameable rather than guessable.\n    """\n    errors: [OSQError!]!\n\n    """Fraction of the space walked. A live estimate while a queue is growing."""\n    progress: Float!\n    status: OSQStatus!\n\n    """\n    True when the walk is held up by an empty queue rather than finished.\n    Distinguishes having nothing to do yet from having nothing left to do, and\n    tells the ForEvery trigger to stay quiet without ending the run.\n    """\n    awaitingValues: Boolean!\n}',
          examples: [],
          initialValue:
            '{\n    "description": null,\n    "cursors": [],\n    "collections": [],\n    "memory": [],\n    "errors": [],\n    "progress": 0,\n    "status": "DRAFT",\n    "awaitingValues": false\n}',
        },
      },
      modules: [
        {
          id: "mod-definition",
          name: "definition",
          description:
            "Shaping the loops. Only while DRAFT, because changing the space mid-walk would invalidate every position already handed out.",
          operations: [
            {
              id: "op-create-date-time-cursor",
              name: "CREATE_DATE_TIME_CURSOR",
              description:
                "Append a cursor that walks time in intervals. first and last set the direction of travel.",
              schema:
                "input CreateDateTimeCursorInput {\n    id: OID!\n    name: String\n    description: String\n    first: DateTime!\n    last: DateTime!\n    deltaSeconds: Int!\n}",
              template:
                "Append a cursor that walks time in intervals. first and last set the direction of travel.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new CreateDateTimeCursorNotDraftError(\n    `Cursors may only be added to a draft; this queue is ${state.status}.`,\n  );\n}\nif (state.cursors.some((cursor) => cursor.id === action.input.id)) {\n  throw new DateTimeCursorIdTakenError(\n    `A cursor with id ${action.input.id} already exists.`,\n  );\n}\nif (action.input.deltaSeconds <= 0) {\n  throw new DateTimeCursorDeltaNotPositiveError(\n    `deltaSeconds must be greater than zero; got ${String(action.input.deltaSeconds)}. Direction of travel comes from first and last.`,\n  );\n}\n\n// No parse guard here: DateTime inputs are validated against\n// `z.iso.datetime()` before a reducer ever sees them, so an unreadable\n// instant is rejected at the action layer and this could never fire.\nconst from = Date.parse(action.input.first);\nconst to = Date.parse(action.input.last);\nif (from === to) {\n  // A number cursor with first === last still yields one point; a span of\n  // zero width contains no interval at all.\n  throw new DateTimeCursorEmptySpanError(\n    `first and last are the same instant (${action.input.first}), so there is no interval to hand out.`,\n  );\n}\n\nstate.cursors.push({\n  id: action.input.id,\n  name: action.input.name ?? null,\n  description: action.input.description ?? null,\n  first: action.input.first,\n  last: action.input.last,\n  deltaSeconds: action.input.deltaSeconds,\n  position: 0,\n  current: null,\n  next: null,\n  finished: false,\n  count: 0,\n});\nrecalculate(state);',
              errors: [
                {
                  id: "err-dtc-not-draft",
                  name: "CreateDateTimeCursorNotDraftError",
                  code: "CREATE_DATE_TIME_CURSOR_NOT_DRAFT",
                  description:
                    "Cursors may only be added while the queue is a draft. Adding one to a running walk would change the shape of the space underneath positions already handed out.",
                  template: "",
                },
                {
                  id: "err-dtc-id-taken",
                  name: "DateTimeCursorIdTakenError",
                  code: "DATE_TIME_CURSOR_ID_TAKEN",
                  description: "Another cursor already has this id.",
                  template: "",
                },
                {
                  id: "err-dtc-delta",
                  name: "DateTimeCursorDeltaNotPositiveError",
                  code: "DATE_TIME_CURSOR_DELTA_NOT_POSITIVE",
                  description:
                    "deltaSeconds must be greater than zero. Direction of travel comes from first and last, so a zero or negative interval width would simply never terminate.",
                  template: "",
                },
                {
                  id: "err-dtc-empty-span",
                  name: "DateTimeCursorEmptySpanError",
                  code: "DATE_TIME_CURSOR_EMPTY_SPAN",
                  description:
                    "first and last are the same instant, so there is no interval to hand out. Unlike a number cursor, which would yield one point, a zero-width span covers nothing.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-create-number-cursor",
              name: "CREATE_NUMBER_CURSOR",
              description:
                "Append a cursor that walks whole numbers. first and last set the direction; step is a positive magnitude.",
              schema:
                "input CreateNumberCursorInput {\n    id: OID!\n    name: String\n    description: String\n    first: Int!\n    last: Int!\n    step: Int!\n}",
              template:
                "Append a cursor that walks whole numbers. first and last set the direction; step is a positive magnitude.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new CreateNumberCursorNotDraftError(\n    `Cursors may only be added to a draft; this queue is ${state.status}.`,\n  );\n}\nif (state.cursors.some((cursor) => cursor.id === action.input.id)) {\n  throw new NumberCursorIdTakenError(\n    `A cursor with id ${action.input.id} already exists.`,\n  );\n}\nif (action.input.step <= 0) {\n  throw new NumberCursorStepNotPositiveError(\n    `step must be greater than zero; got ${String(action.input.step)}. It is a magnitude \u2014 travel from 52 to 1 by writing first: 52, last: 1.`,\n  );\n}\n\nstate.cursors.push({\n  id: action.input.id,\n  name: action.input.name ?? null,\n  description: action.input.description ?? null,\n  first: action.input.first,\n  last: action.input.last,\n  step: action.input.step,\n  position: 0,\n  current: null,\n  next: null,\n  finished: false,\n  count: 0,\n});\nrecalculate(state);',
              errors: [
                {
                  id: "err-nc-not-draft",
                  name: "CreateNumberCursorNotDraftError",
                  code: "CREATE_NUMBER_CURSOR_NOT_DRAFT",
                  description:
                    "Cursors may only be added while the queue is a draft.",
                  template: "",
                },
                {
                  id: "err-nc-id-taken",
                  name: "NumberCursorIdTakenError",
                  code: "NUMBER_CURSOR_ID_TAKEN",
                  description: "Another cursor already has this id.",
                  template: "",
                },
                {
                  id: "err-nc-step",
                  name: "NumberCursorStepNotPositiveError",
                  code: "NUMBER_CURSOR_STEP_NOT_POSITIVE",
                  description:
                    "step must be greater than zero. It is a magnitude: direction of travel comes from first and last, so a signed step would give two ways to say the same thing and one way to contradict it.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-create-collection-cursor",
              name: "CREATE_COLLECTION_CURSOR",
              description:
                "Append a cursor that walks the values of a collection.",
              schema:
                "input CreateCollectionCursorInput {\n    id: OID!\n    name: String\n    description: String\n    collection: OID!\n}",
              template:
                "Append a cursor that walks the values of a collection.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new CreateCollectionCursorNotDraftError(\n    `Cursors may only be added to a draft; this queue is ${state.status}.`,\n  );\n}\nif (state.cursors.some((cursor) => cursor.id === action.input.id)) {\n  throw new CollectionCursorIdTakenError(\n    `A cursor with id ${action.input.id} already exists.`,\n  );\n}\nif (!state.collections.some((c) => c.id === action.input.collection)) {\n  throw new CollectionCursorCollectionNotFoundError(\n    `There is no collection ${action.input.collection} to walk; create it first.`,\n  );\n}\n\nstate.cursors.push({\n  id: action.input.id,\n  name: action.input.name ?? null,\n  description: action.input.description ?? null,\n  collection: action.input.collection,\n  position: 0,\n  current: null,\n  next: null,\n  finished: false,\n  count: 0,\n});\nrecalculate(state);',
              errors: [
                {
                  id: "err-cc-not-draft",
                  name: "CreateCollectionCursorNotDraftError",
                  code: "CREATE_COLLECTION_CURSOR_NOT_DRAFT",
                  description:
                    "Cursors may only be added while the queue is a draft.",
                  template: "",
                },
                {
                  id: "err-cc-id-taken",
                  name: "CollectionCursorIdTakenError",
                  code: "COLLECTION_CURSOR_ID_TAKEN",
                  description: "Another cursor already has this id.",
                  template: "",
                },
                {
                  id: "err-cc-no-collection",
                  name: "CollectionCursorCollectionNotFoundError",
                  code: "COLLECTION_CURSOR_COLLECTION_NOT_FOUND",
                  description:
                    "There is no collection with that id to walk. Create the collection first.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-reorder-cursors",
              name: "REORDER_CURSORS",
              description:
                "Change the nesting order. The first cursor is the outermost loop.",
              schema: "input ReorderCursorsInput {\n    order: [OID!]!\n}",
              template:
                "Change the nesting order. The first cursor is the outermost loop.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new ReorderCursorsNotDraftError(\n    `Nesting order may only change in a draft; this queue is ${state.status}.`,\n  );\n}\n\nconst existing = state.cursors.map((cursor) => cursor.id);\nconst wanted = action.input.order;\n// A permutation, not a subset: a partial order would silently drop or\n// duplicate a loop.\nconst samePopulation =\n  wanted.length === existing.length &&\n  new Set(wanted).size === wanted.length &&\n  wanted.every((id) => existing.includes(id));\nif (!samePopulation) {\n  throw new CursorOrderMismatchError(\n    `The order must list each of the ${String(existing.length)} cursors exactly once; got ${String(wanted.length)} entries.`,\n  );\n}\n\nstate.cursors = wanted.map(\n  (id) => state.cursors.find((cursor) => cursor.id === id)!,\n);\nrecalculate(state);',
              errors: [
                {
                  id: "err-reorder-not-draft",
                  name: "ReorderCursorsNotDraftError",
                  code: "REORDER_CURSORS_NOT_DRAFT",
                  description:
                    "Nesting order may only change while the queue is a draft; reordering a running walk would reinterpret every position already handed out.",
                  template: "",
                },
                {
                  id: "err-reorder-mismatch",
                  name: "CursorOrderMismatchError",
                  code: "CURSOR_ORDER_MISMATCH",
                  description:
                    "The order given is not a permutation of the existing cursors: it must list every cursor exactly once.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-set-cursor-name",
              name: "SET_CURSOR_NAME",
              description: "Rename a cursor.",
              schema:
                "input SetCursorNameInput {\n    id: OID!\n    name: String\n}",
              template: "Rename a cursor.",
              reducer:
                'if (state.status !== "DRAFT") {\n  throw new SetCursorNameNotDraftError(\n    `Cursor names may only change in a draft; this queue is ${state.status}.`,\n  );\n}\nconst cursor = state.cursors.find((c) => c.id === action.input.id);\nif (!cursor) {\n  throw new SetCursorNameCursorNotFoundError(\n    `There is no cursor ${action.input.id}.`,\n  );\n}\ncursor.name = action.input.name ?? null;',
              errors: [
                {
                  id: "err-scn-not-draft",
                  name: "SetCursorNameNotDraftError",
                  code: "SET_CURSOR_NAME_NOT_DRAFT",
                  description:
                    "Cursor names may only change while the queue is a draft.",
                  template: "",
                },
                {
                  id: "err-scn-not-found",
                  name: "SetCursorNameCursorNotFoundError",
                  code: "SET_CURSOR_NAME_CURSOR_NOT_FOUND",
                  description: "There is no cursor with that id.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-create-collection",
              name: "CREATE_COLLECTION",
              description: "Define a queue, optionally seeded with values.",
              schema:
                "input CreateCollectionInput {\n    id: OID!\n    name: String!\n    values: [Unknown!]\n}",
              template: "Define a queue, optionally seeded with values.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new CreateCollectionNotDraftError(\n    `Collections may only be defined in a draft; this queue is ${state.status}. Values can still be pushed once it is running.`,\n  );\n}\nif (state.collections.some((c) => c.id === action.input.id)) {\n  throw new CollectionIdTakenError(\n    `A collection with id ${action.input.id} already exists.`,\n  );\n}\n\nstate.collections.push({\n  id: action.input.id,\n  name: action.input.name,\n  values: action.input.values ?? [],\n});\nrecalculate(state);',
              errors: [
                {
                  id: "err-col-not-draft",
                  name: "CreateCollectionNotDraftError",
                  code: "CREATE_COLLECTION_NOT_DRAFT",
                  description:
                    "Collections may only be defined while the queue is a draft. Values may still be pushed onto them once it is running.",
                  template: "",
                },
                {
                  id: "err-col-id-taken",
                  name: "CollectionIdTakenError",
                  code: "COLLECTION_ID_TAKEN",
                  description: "Another collection already has this id.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-lifecycle",
          name: "lifecycle",
          description:
            "Moving between DRAFT, IN_PROGRESS, PAUSED and FINISHED.",
          operations: [
            {
              id: "op-start",
              name: "START",
              description:
                "Begin the walk and hand out the first tuple. DRAFT -> IN_PROGRESS.",
              schema: "input StartInput {\n    _: Boolean\n}",
              template:
                "Begin the walk and hand out the first tuple. DRAFT -> IN_PROGRESS.",
              reducer:
                '// requires: import { advance } from "../machine.js";\nif (state.status !== "DRAFT") {\n  throw new StartNotDraftError(\n    `Only a draft can be started; this queue is ${state.status}.`,\n  );\n}\nif (state.cursors.length === 0) {\n  throw new StartWithoutCursorsError(\n    "This queue has no cursors, so it describes no loop and starting it would finish it immediately.",\n  );\n}\n\nstate.status = "IN_PROGRESS";\nstate.errors = [];\nstate.cursors.forEach((cursor) => {\n  cursor.position = 0;\n});\n// Not yet handed out: the first advance realises position zero rather than\n// stepping past it.\nstate.awaitingValues = true;\nadvance(state);',
              errors: [
                {
                  id: "err-start-not-draft",
                  name: "StartNotDraftError",
                  code: "START_NOT_DRAFT",
                  description:
                    "Only a draft can be started. Use UNPAUSE to resume a paused walk, or RESET to begin again.",
                  template: "",
                },
                {
                  id: "err-start-no-cursors",
                  name: "StartWithoutCursorsError",
                  code: "START_WITHOUT_CURSORS",
                  description:
                    "A queue with no cursors describes no loop, so starting it would finish it in the same breath. Define at least one cursor first.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-pause",
              name: "PAUSE",
              description: "Hold the walk where it is. IN_PROGRESS -> PAUSED.",
              schema: "input PauseInput {\n    _: Boolean\n}",
              template: "Hold the walk where it is. IN_PROGRESS -> PAUSED.",
              reducer:
                'if (state.status !== "IN_PROGRESS") {\n  throw new PauseNotInProgressError(\n    `Only a walk in progress can be paused; this queue is ${state.status}.`,\n  );\n}\nstate.status = "PAUSED";',
              errors: [
                {
                  id: "err-pause-not-running",
                  name: "PauseNotInProgressError",
                  code: "PAUSE_NOT_IN_PROGRESS",
                  description: "Only a walk that is in progress can be paused.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-unpause",
              name: "UNPAUSE",
              description:
                "Resume exactly where it stopped. PAUSED -> IN_PROGRESS.",
              schema: "input UnpauseInput {\n    _: Boolean\n}",
              template:
                "Resume exactly where it stopped. PAUSED -> IN_PROGRESS.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "PAUSED") {\n  throw new UnpauseNotPausedError(\n    `Only a paused walk can be resumed; this queue is ${state.status}.`,\n  );\n}\nstate.status = "IN_PROGRESS";\n// The tuple it stopped on is still the tuple to work, so this resumes rather\n// than advances.\nrecalculate(state);',
              errors: [
                {
                  id: "err-unpause-not-paused",
                  name: "UnpauseNotPausedError",
                  code: "UNPAUSE_NOT_PAUSED",
                  description: "Only a paused walk can be resumed.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-reset",
              name: "RESET",
              description:
                "Return to DRAFT. Cursor definitions and collection values survive; positions, errors and memory are cleared.",
              schema: "input ResetInput {\n    _: Boolean\n}",
              template:
                "Return to DRAFT. Cursor definitions and collection values survive; positions, errors and memory are cleared.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status === "DRAFT") {\n  throw new ResetAlreadyDraftError(\n    "This queue is already a draft, so there is no position, error or memory to clear.",\n  );\n}\n\n// Definitions and queued values survive; everything the run produced does\n// not. A reset is for running the same space again after fixing something,\n// so the space itself must stay.\nstate.status = "DRAFT";\nstate.errors = [];\nstate.memory = [];\nrecalculate(state);',
              errors: [
                {
                  id: "err-reset-already-draft",
                  name: "ResetAlreadyDraftError",
                  code: "RESET_ALREADY_DRAFT",
                  description:
                    "The queue is already a draft, so there is no position, error or memory to clear.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-terminate",
              name: "TERMINATE",
              description:
                "Stop for good without walking the rest. Any status but FINISHED -> FINISHED.",
              schema: "input TerminateInput {\n    _: Boolean\n}",
              template:
                "Stop for good without walking the rest. Any status but FINISHED -> FINISHED.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status === "FINISHED") {\n  throw new TerminateAlreadyFinishedError("This queue has already finished.");\n}\nstate.status = "FINISHED";\nrecalculate(state);',
              errors: [
                {
                  id: "err-terminate-finished",
                  name: "TerminateAlreadyFinishedError",
                  code: "TERMINATE_ALREADY_FINISHED",
                  description: "The queue has already finished.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-advance",
          name: "advance",
          description:
            "Turning the odometer. The deepest cursor moves first; when it overflows it resets and carries.",
          operations: [
            {
              id: "op-proceed",
              name: "PROCEED",
              description:
                "Advance one tuple. May park on an empty queue, or finish when the space is walked. With expected, only from that tuple.",
              schema:
                'input ProceedInput {\n    """\n    The tuple the caller worked on, as the For Every trigger handed it out\n    (its cursors\' ids and values). When given, the queue only moves if it is\n    still on exactly this tuple, so two runs that worked on one tuple cannot\n    each move the queue and skip the next one between them.\n    """\n    expected: [ProceedExpectedCursorValueInput!]\n}\n\n"""One cursor\'s value in the tuple a caller expects the queue to be on."""\ninput ProceedExpectedCursorValueInput {\n    cursor: OID!\n    value: Unknown\n}',
              template:
                "Advance one tuple. May park on an empty queue, or finish when the space is walked. With expected, only from that tuple.",
              reducer:
                '// requires: import { advance, isOnTuple } from "../machine.js";\nif (state.status !== "IN_PROGRESS") {\n  throw new ProceedNotInProgressError(\n    `Only a walk in progress can advance; this queue is ${state.status}.`,\n  );\n}\nif (action.input.expected && !isOnTuple(state, action.input.expected)) {\n  throw new ProceedStaleError(\n    "The queue is no longer on the tuple this caller worked on; moving it again would skip the next one.",\n  );\n}\nadvance(state);',
              errors: [
                {
                  id: "err-proceed-not-running",
                  name: "ProceedNotInProgressError",
                  code: "PROCEED_NOT_IN_PROGRESS",
                  description:
                    "Only a walk that is in progress can advance. A paused walk must be resumed and a finished one reset.",
                  template: "",
                },
                {
                  id: "err-proceed-stale",
                  name: "ProceedStaleError",
                  code: "PROCEED_STALE",
                  description:
                    "The queue is no longer on the expected tuple: another caller already moved it, or it parked or finished. Nothing moves.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-proceed-with-error",
              name: "PROCEED_WITH_ERROR",
              description:
                "Record a failure against the current tuple and then advance. Equivalent to REPORT_ERROR followed by PROCEED, and the error is stamped before the move.",
              schema:
                'input ProceedWithErrorInput {\n    id: OID!\n    message: String!\n    data: Unknown\n    """\n    The tuple the caller worked on, as the For Every trigger handed it out\n    (its cursors\' ids and values). When given, the queue only moves if it is\n    still on exactly this tuple, so two runs that worked on one tuple cannot\n    each move the queue and skip the next one between them.\n    """\n    expected: [ProceedWithErrorExpectedCursorValueInput!]\n}\n\n"""One cursor\'s value in the tuple a caller expects the queue to be on."""\ninput ProceedWithErrorExpectedCursorValueInput {\n    cursor: OID!\n    value: Unknown\n}',
              template:
                "Record a failure against the current tuple and then advance. Equivalent to REPORT_ERROR followed by PROCEED, and the error is stamped before the move.",
              reducer:
                '// requires: import { advance, currentTuple, isOnTuple } from "../machine.js";\nif (state.status !== "IN_PROGRESS") {\n  throw new ProceedWithErrorNotInProgressError(\n    `Only a walk in progress can record a failure and advance; this queue is ${state.status}.`,\n  );\n}\nif (action.input.expected && !isOnTuple(state, action.input.expected)) {\n  throw new ProceedWithErrorStaleError(\n    "The queue is no longer on the tuple this caller worked on; the failure would be stamped on the wrong one.",\n  );\n}\nif (state.errors.some((error) => error.id === action.input.id)) {\n  throw new ProceedWithErrorIdTakenError(\n    `An error with id ${action.input.id} is already recorded; reusing it would overwrite an earlier failure.`,\n  );\n}\n\n// Stamped BEFORE the move, or the error would name the tuple after the\n// failing one \u2014 which is the single most misleading thing this document\n// could record.\nstate.errors.push({\n  id: action.input.id,\n  message: action.input.message,\n  data: action.input.data ?? null,\n  cursors: currentTuple(state),\n});\n\nadvance(state);',
              errors: [
                {
                  id: "err-pwe-not-running",
                  name: "ProceedWithErrorNotInProgressError",
                  code: "PROCEED_WITH_ERROR_NOT_IN_PROGRESS",
                  description:
                    "Only a walk that is in progress can record a failure and advance.",
                  template: "",
                },
                {
                  id: "err-pwe-id-taken",
                  name: "ProceedWithErrorIdTakenError",
                  code: "PROCEED_WITH_ERROR_ID_TAKEN",
                  description:
                    "Another error already has this id. Reusing one would overwrite the record of an earlier failure.",
                  template: "",
                },
                {
                  id: "err-pwe-stale",
                  name: "ProceedWithErrorStaleError",
                  code: "PROCEED_WITH_ERROR_STALE",
                  description:
                    "The queue is no longer on the expected tuple, so the failure would be stamped on the wrong one. Nothing is recorded and nothing moves.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-collections",
          name: "collections",
          description: "Queues, filled and drained while the walk runs.",
          operations: [
            {
              id: "op-add-collection-value",
              name: "ADD_COLLECTION_VALUE",
              description:
                "Push one or more values onto a queue. A parked walk resumes on the next advance.",
              schema:
                "input AddCollectionValueInput {\n    collection: OID!\n    values: [Unknown!]!\n}",
              template:
                "Push one or more values onto a queue. A parked walk resumes on the next advance.",
              reducer:
                '// requires: import { recalculate } from "../machine.js";\nif (state.status !== "IN_PROGRESS") {\n  throw new AddCollectionValueNotInProgressError(\n    `Values may only be queued while the walk is in progress; this queue is ${state.status}. Seed a draft with CREATE_COLLECTION instead.`,\n  );\n}\nconst collection = state.collections.find(\n  (c) => c.id === action.input.collection,\n);\nif (!collection) {\n  throw new AddCollectionValueCollectionNotFoundError(\n    `There is no collection ${action.input.collection}.`,\n  );\n}\nif (action.input.values.length === 0) {\n  throw new AddCollectionValueEmptyError(\n    "No values were given, so this push would queue nothing.",\n  );\n}\n\ncollection.values.push(...action.input.values);\n// The walk may have been parked on this queue being empty. It stays parked\n// until the next advance, which is what hands the new work out \u2014 pushing\n// values is not itself an iteration.\nrecalculate(state);',
              errors: [
                {
                  id: "err-acv-not-running",
                  name: "AddCollectionValueNotInProgressError",
                  code: "ADD_COLLECTION_VALUE_NOT_IN_PROGRESS",
                  description:
                    "Values may only be queued while the walk is in progress. Seed a draft queue with CREATE_COLLECTION instead.",
                  template: "",
                },
                {
                  id: "err-acv-no-collection",
                  name: "AddCollectionValueCollectionNotFoundError",
                  code: "ADD_COLLECTION_VALUE_COLLECTION_NOT_FOUND",
                  description: "There is no collection with that id.",
                  template: "",
                },
                {
                  id: "err-acv-empty",
                  name: "AddCollectionValueEmptyError",
                  code: "ADD_COLLECTION_VALUE_EMPTY",
                  description:
                    "No values were given. A push that queues nothing is a caller mistake rather than a no-op worth recording.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
            {
              id: "op-clear-collection",
              name: "CLEAR_COLLECTION",
              description:
                "Empty a queue. Any cursor over it restarts from the top, so values pushed afterwards are treated as new work rather than as work already done.",
              schema: "input ClearCollectionInput {\n    collection: OID!\n}",
              template:
                "Empty a queue. Any cursor over it restarts from the top, so values pushed afterwards are treated as new work rather than as work already done.",
              reducer:
                '// requires: import { isCollectionCursor, recalculate } from "../machine.js";\nif (state.status !== "IN_PROGRESS") {\n  throw new ClearCollectionNotInProgressError(\n    `Queues may only be cleared while the walk is in progress; this queue is ${state.status}.`,\n  );\n}\nconst collection = state.collections.find(\n  (c) => c.id === action.input.collection,\n);\nif (!collection) {\n  throw new ClearCollectionCollectionNotFoundError(\n    `There is no collection ${action.input.collection}.`,\n  );\n}\n\ncollection.values = [];\n\n// Announce the clear to any cursor walking this queue.\n//\n// Length alone cannot tell "the list shrank, those items are gone" from\n// "cleared, and what arrives next is new work" \u2014 read as a bare shrink, the\n// machine would conclude there was nothing left and finish the level.\n// Resetting the position and un-entering says explicitly that the next value\n// to arrive is unworked and must be handed out.\nconst walkers = state.cursors.filter(\n  (cursor) =>\n    isCollectionCursor(cursor) &&\n    cursor.collection === action.input.collection,\n);\nif (walkers.length > 0) {\n  walkers.forEach((cursor) => {\n    cursor.position = 0;\n  });\n  state.awaitingValues = true;\n}\nrecalculate(state);',
              errors: [
                {
                  id: "err-clear-not-running",
                  name: "ClearCollectionNotInProgressError",
                  code: "CLEAR_COLLECTION_NOT_IN_PROGRESS",
                  description:
                    "Queues may only be cleared while the walk is in progress.",
                  template: "",
                },
                {
                  id: "err-clear-no-collection",
                  name: "ClearCollectionCollectionNotFoundError",
                  code: "CLEAR_COLLECTION_COLLECTION_NOT_FOUND",
                  description: "There is no collection with that id.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-errors",
          name: "errors",
          description:
            "Recording a failure against the tuple that produced it.",
          operations: [
            {
              id: "op-report-error",
              name: "REPORT_ERROR",
              description:
                "Record a failure for the current tuple without advancing.",
              schema:
                "input ReportErrorInput {\n    id: OID!\n    message: String!\n    data: Unknown\n}",
              template:
                "Record a failure for the current tuple without advancing. Pass a collection to file it against a queued value as well.",
              reducer:
                '// requires: import { currentTuple } from "../machine.js";\nif (state.status !== "IN_PROGRESS") {\n  throw new ReportErrorNotInProgressError(\n    `A failure is recorded against the current tuple, and there is none unless the walk is in progress; this queue is ${state.status}.`,\n  );\n}\nif (state.errors.some((error) => error.id === action.input.id)) {\n  throw new ReportErrorIdTakenError(\n    `An error with id ${action.input.id} is already recorded.`,\n  );\n}\n\nstate.errors.push({\n  id: action.input.id,\n  message: action.input.message,\n  data: action.input.data ?? null,\n  cursors: currentTuple(state),\n});',
              errors: [
                {
                  id: "err-report-not-running",
                  name: "ReportErrorNotInProgressError",
                  code: "REPORT_ERROR_NOT_IN_PROGRESS",
                  description:
                    "A failure can only be recorded against a tuple, and there is no current tuple unless the walk is in progress.",
                  template: "",
                },
                {
                  id: "err-report-id-taken",
                  name: "ReportErrorIdTakenError",
                  code: "REPORT_ERROR_ID_TAKEN",
                  description: "Another error already has this id.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-memory",
          name: "memory",
          description: "A named scratchpad carried across iterations.",
          operations: [
            {
              id: "op-update-memory",
              name: "UPDATE_MEMORY",
              description:
                "Write a named scratchpad slot. A null value removes it.",
              schema:
                "input UpdateMemoryInput {\n    key: String!\n    value: Unknown\n}",
              template:
                "Write a named scratchpad slot. A null value removes it.",
              reducer:
                'if (state.status === "FINISHED") {\n  throw new UpdateMemoryFinishedError(\n    "This queue has finished, so there is no further iteration for a scratchpad value to carry into.",\n  );\n}\nconst key = action.input.key.trim();\nif (key === "") {\n  throw new UpdateMemoryKeyEmptyError(\n    "A memory slot needs a name to be read back by.",\n  );\n}\n\nconst existing = state.memory.findIndex((entry) => entry.key === key);\nif (action.input.value === null || action.input.value === undefined) {\n  if (existing !== -1) state.memory.splice(existing, 1);\n  return;\n}\nif (existing === -1) {\n  state.memory.push({ key, value: action.input.value });\n  return;\n}\nstate.memory[existing].value = action.input.value;',
              errors: [
                {
                  id: "err-mem-finished",
                  name: "UpdateMemoryFinishedError",
                  code: "UPDATE_MEMORY_FINISHED",
                  description:
                    "The queue has finished, so there is no further iteration for a scratchpad value to carry into.",
                  template: "",
                },
                {
                  id: "err-mem-empty-key",
                  name: "UpdateMemoryKeyEmptyError",
                  code: "UPDATE_MEMORY_KEY_EMPTY",
                  description: "A memory slot needs a name to be read back by.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
        {
          id: "mod-meta",
          name: "meta",
          description:
            "Descriptions, editable in any status because they never affect the walk.",
          operations: [
            {
              id: "op-set-description",
              name: "SET_DESCRIPTION",
              description: "Describe what this queue backfills.",
              schema: "input SetDescriptionInput {\n    description: String\n}",
              template: "Describe what this queue backfills.",
              reducer: "state.description = action.input.description ?? null;",
              errors: [],
              examples: [],
              scope: "global",
            },
            {
              id: "op-set-cursor-description",
              name: "SET_CURSOR_DESCRIPTION",
              description: "Describe one cursor.",
              schema:
                "input SetCursorDescriptionInput {\n    id: OID!\n    description: String\n}",
              template: "Describe one cursor.",
              reducer:
                "const cursor = state.cursors.find((c) => c.id === action.input.id);\nif (!cursor) {\n  throw new SetCursorDescriptionCursorNotFoundError(\n    `There is no cursor ${action.input.id}.`,\n  );\n}\ncursor.description = action.input.description ?? null;",
              errors: [
                {
                  id: "err-scd-not-found",
                  name: "SetCursorDescriptionCursorNotFoundError",
                  code: "SET_CURSOR_DESCRIPTION_CURSOR_NOT_FOUND",
                  description: "There is no cursor with that id.",
                  template: "",
                },
              ],
              examples: [],
              scope: "global",
            },
          ],
        },
      ],
      version: 1,
      changeLog: [],
    },
  ],
};
