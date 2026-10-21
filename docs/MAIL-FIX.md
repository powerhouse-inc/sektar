# Mail drive write timeouts: fix

## Applied (2026-10-21)

The sketch below was incomplete in two ways that the tests caught:

1. **`Keyframe.revision` is a 32-bit `integer` column.** Querying it with
   `MAX_SAFE_INTEGER` fails in Postgres ("out of range for type integer"). This
   is the practical reason head reads skipped keyframes. Fix:
   `KyselyKeyframeStore.findNearestKeyframe` drops the upper bound when the
   target is above the column's range.
2. **The executor relies on "invalidate, then the next head read replays the
   whole log".** UNDO, REDO and any skip need the full operation history, and
   a keyframe carries one operation. Dropping the early return alone broke
   `test/sync/two-reactor-convergence.test.ts` (3/3 fail; baseline 2/2 pass).
   Fix: `invalidate()` now records a marker covering the invalidated
   document, scope or stream. The next head read of a marked stream replays
   in full, exactly as before, and clears the marker. Unmarked cold reads
   (restart, LRU eviction) start from the latest keyframe.

Files in `../powerhouse` (uncommitted, branch `feat/host-icons`):
`packages/reactor/src/cache/kysely-write-cache.ts`,
`packages/reactor/src/storage/kysely/keyframe-store.ts`,
`packages/reactor/test/cache/write/keyframe-revision-label.test.ts` (6 new
head-read tests).

Verification:
- Full reactor suite with Postgres (`reactor-postgres` on 5433): 344/344
  files, 4,445 tests passed.
- Root `pnpm typecheck` clean.
- Reactor build OK.
- Live `mail`: cold write 6.1 s, warm 1.4 s (was a 30 s timeout every time).
  Nodes unchanged at 16,394.

---

Original sketch, kept for the record. Status at the time: not applied. Backup of the full `.ph` store taken first:
`D:\projects\ph-win\backups\sektar-ph-2026-10-21-before-mail-fix` (6.3 GB, 16,015 files).

## The fault

`KyselyWriteCache.findNearestKeyframe` (`packages/reactor/src/cache/kysely-write-cache.ts:625`):

```ts
if (targetRevision === Number.MAX_SAFE_INTEGER || targetRevision <= 0) {
  return undefined;
}
```

Every write job loads the head (`targetRevision` undefined, which becomes
`MAX_SAFE_INTEGER`). So a cold head read always replays the whole log. The
keyframes the cache writes every 10 revisions are only ever used by reads that
ask for a specific revision. For `mail` that means about 18k global operations
plus 16.5k document-scope operations, which takes longer than the 30 s job
timeout. A timed-out job caches nothing, so the next job starts again from zero.

## Why head reads skip keyframes, and why that no longer applies

- The early return dates from 34bc595c83 (Oct 2025). That design probed exact
  revisions (target, target−10, and so on). A head read has no number to probe
  from, so it returned early.
- Today the keyframe store answers `revision <= target ORDER BY revision DESC
  LIMIT 1` (`storage/kysely/keyframe-store.ts:66`). With `MAX_SAFE_INTEGER` as
  the target, that is simply the latest keyframe.
- The old keyframe rows labelled by count are already safe. The clamp from
  4aa32fe1bd resumes at `min(header revision − 1, row label)`, and
  `keyframe-revision-label.test.ts` covers both legacy shapes, though only for
  reads with an explicit target.
- **Document-scope state on the keyframe path is not stale.**
  - The keyframe path replays only UPGRADE / DELETE / PURGE from the document
    scope. Those are the only actions that change `state.document`
    (`version`, `hash`, `isDeleted`).
  - ADD_RELATIONSHIP and similar actions change no state (`_baseReducer` only
    handles SET_NAME and SET_PREFERRED_EDITOR).
  - Revisions and `lastModified` are re-stamped from the store by
    `stampRevisions`.
  - Small existing gap, unchanged by this fix: a SET_NAME issued after the
    keyframe is not reflected in `header.name`. Reads with an explicit target
    already have this gap.
- **Skips are already guarded.** Any operation after the keyframe with
  `skip > 0` falls back to a full replay (4da993040a). UNDO, REDO and NOOP+skip
  also invalidate the cache before the load.

## The change

1. `findNearestKeyframe`: skip only non-positive targets.

   ```ts
   if (targetRevision <= 0) {
     return undefined;
   }
   ```

2. Tests in `test/cache/write/keyframe-revision-label.test.ts` (mirroring the
   existing cases, but with head reads):
   - A head read after a keyframe at 10, with operations up to 12, resumes from
     the keyframe. Assert the state equals a from-scratch rebuild, and that
     `operationStore.getSince` for the scope was called with `startRevision 10`
     instead of `-1`.
   - The count-convention head row and the positional row (global: 25 at 10),
     both read as head. They must equal a from-scratch rebuild.
   - Head read with a skip after the keyframe falls back to the full replay.
   - Document-scope head read uses the document-scope keyframe and still
     applies a later DELETE_DOCUMENT.

3. Run the full reactor suite (`pnpm vitest run` in `packages/reactor`) plus
   root `pnpm typecheck`, then `pnpm build` for the reactor so Vetra picks it up.

Optional and separate, not needed for the unblock:

- Forward `jobTimeoutMs` in `apps/switchboard/src/builder-defaults.mts`.
- Insert drive nodes by binary search (`insertNodeSorted`). The per-op cost is
  O(n log n) today; on 10k nodes this is what makes even keyframe-free replays
  slow.
- Store a finished rebuild even if the job that asked for it has timed out.

## Verification on the live store

1. Stop Vetra (my PID tree only), build reactor, start Vetra with the usual env.
2. Watch `.ph/vetra.log`: the first `mail` write should finish in seconds, with
   no "aborted due to timeout".
3. Compare the mail drive's node count and the latest global revision before
   and after (GraphQL `document(idOrSlug)` state).
4. If anything is off: stop Vetra, restore the backup with robocopy, start
   again.

## Then

Find and file the orphaned email documents: the ones created and linked but
never added as drive nodes while writes failed.
