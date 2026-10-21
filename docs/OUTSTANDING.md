# Outstanding

Open items from the invoice, quarterly-filing and Business Travel work. Last updated 2026-10-21.

## Platform

- [x] **Writes to the `mail` drive time out after every Vetra restart.** Fixed locally 2026-10-21, not yet committed upstream: cold write 6.1 s, warm 1.4 s (was a 30 s timeout). See [MAIL-FIX.md](MAIL-FIX.md).
  - **Symptom.** Every `ADD_FILE` job on `mail` fails with "The operation was aborted due to timeout", repeating every ~35 s. The drive has ~18k global ops and ~10k nodes.
  - **Scope.** Reads still work. Relationships (the document scope) still advance.
  - **Cause: no snapshot on a cold start.** After a restart the write cache rebuilds the drive's latest state from the whole operation log, and that takes longer than the 30 s job timeout. `findNearestKeyframe` in `packages/reactor/src/cache/kysely-write-cache.ts` returns early for head reads (`targetRevision === Number.MAX_SAFE_INTEGER`), so the keyframes saved every 10 revisions are never used. A timed-out job caches nothing, and timeouts are not retried (`simple-job-executor-manager.ts`), so every later job repeats the full replay.
  - **Origin: upstream.** The early return came from Benjamin Jordan's "feat: compatibility fixes" (34bc595c83, Oct 2025) and is on `origin/main`. Commit 4aa32fe1bd (Jul 2026) later added the clamp for legacy keyframe rows labelled by position.
  - **Fix applied** in the `../powerhouse` working tree (uncommitted, on `feat/host-icons`); details in [MAIL-FIX.md](MAIL-FIX.md). Store backed up first.
  - **Contributing cost.** The document-drive `ADD_FILE` reducer re-sorts every node on each insert (`insertNodeSorted`, `handleTargetNameCollisions`).
  - **Config.** Switchboard exposes no `jobTimeoutMs` (`apps/switchboard/src/builder-defaults.mts`).
  - **Options:**
    - (a) Use the latest keyframe for head cold misses.
    - (b) Forward a long `jobTimeoutMs` once so one rebuild completes and warms the cache.
    - (c) Insert nodes by binary search in the drive reducer.
- [ ] **File the orphaned email documents**, and commit the reactor fix upstream (branch and PR still to decide).
  - The distyra backfill workflows probably left email documents that were created and linked but never filed as drive nodes. Find and file them once writes work again.
- [ ] **The Invoice subgraph resolves v2 actions against v1.**
  - `filterLatestDocumentModelVersions` in `packages/reactor-api/src/graphql/graphql-manager.ts` picks the v1 module, because every version carries all specs.
  - Effect: the subgraph's own mutations fail with "Action X not found".
  - Workaround in our scripts: the generic `execute` mutation.
  - Fix, not applied: compare `module.version`.

- [ ] **Folder sync to disk.**
  - Done: the model, the UI, and the Switchboard processor `processors/folder-sync`.
  - Live: kwartaalaangiftes/2026-Q3 → `D:\Dropbox (Personal)\KSDC\kwartaalaangiftes\2026-Q3` (99 written, 1 already identical).
  - The Switchboard writes only below the folders in `.ph/folder-sync-roots.txt`; currently the Dropbox `kwartaalaangiftes` folder.
  - Still to do: the Activepieces trigger and action; "export as .phd" for non-File documents (reported as an issue for now).
- [ ] **Performance, in layers:**
  - (1) A progress indication for the boot jobs (processor backfills, catch-up).
  - (2) Log slow requests, both external (GraphQL, HTTP) and internal (jobs, processor batches, queries).
  - (3) Optimize from that data.
- [ ] **Every package change re-indexes everything (~15 min).**
  - After a new build, or when the Switchboard reloads the package (e.g. a processor was generated), the processors run `runBackfill` from scratch instead of resuming from their cursors.
  - Shown by a CPU profile (2026-10-21 13:17): mostly PGlite queries and result parsing, `processors/email-index` replaying the mail drive, plus ~6% `fdatasync` per write.
  - Suspect: processor or factory ids that change between builds (`processor-manager.ts`, `${factoryId}:${driveId}:${slot}`). Not confirmed.

## Finance

- [ ] **Issue the Q3 2026 sales invoices** (drafts in the Sektar drive, Invoices folder). All are due 2026-10-31.

  | Draft | Suggested number |
  |---|---|
  | Powerhouse July | 2026010 |
  | Powerhouse August | 2026011 |
  | Powerhouse September | 2026012 |
  | Dai Fonden Q3 | 2026013 |

- [ ] **Record the Dai Fonden payment** of €1,393.87 (paid 2026-10-07, "Q3 2026 BOARD REM") once 2026013 is issued.
- [ ] **Assumed payments on the archived invoices.** 246 invoices from 2014–2025 are marked paid with method "Other" and reference "assumed: closed year, no bank line matched". Keep them, or replace them with real bank lines?
- [ ] **Delivery date of 2026003** is stored as 2025-02-28; it should be 2026.
- [ ] **Unreadable lines on issued invoices.** The page footer prints over a row in the issued PDF. These are placeholders, kept unless the invoices are reissued:
  - 2023006: "Line not readable from the PDF", US$143.13
  - 2023014: "Line not readable from the PDF", US$19.45, plus one garbled train-line description
- [ ] **AWS Route 53 hosted-zone charges** (~$1.40–1.65 a month) can't be tied to a domain, so they are not forward-billed. Decide.
- [ ] **Mobile Vikings, 2 a month (SIMs …6530 on the 12th, …8670 on the 20th):** July's two are missing from 2026-Q3, and 20 Oct (…8670) from 2026-Q4. The Peppol downloads are the originals.
- [ ] **Receipts still to come on the Q3 drafts:** July: Trattoria Da Dino (07/07, €57.80), DB ticket Berlin Hbf (07/07, €5), Descript ($105), Notion ($2,640). The September S-Bahn, ODEG and Parking Zaventem scans are in 2026012-supporting-materials but not yet attached to their draft lines.
- [ ] **Left over from the invoice downloads** (the rest were swapped in on 2026-10-21):
  - **AWS June invoices dated 1 July:** EUINBE26-179713 and -182272 are filed in 2026-Q2, but their invoice date puts them in Q3. Keep them in Q2 or move them? (The printed June statement was removed from Q3.)
  - **AWS July line on 2026010:** bills $87.33, the whole EUINBE26-200560: the powerhouse.io domain at $85.91 (incl. 21% VAT), plus $1.42 for Route 53 and RDS. Forward billing is at what was paid, VAT included, so the question is only whether the $1.42 of hosting belongs on it ($85.91 vs $87.33).
  - **Distyra:** credit note DISTC-2026-000003 (−€10.50 against the reverse-charge DIST-2026-000006) looks wrong. The documents net to €39.50, but €50 was paid. Ask Distyra to void it.
  - **OpenRouter:** Invoice-GJOWTVBD-0001 is billed to Wouter Kampmann personally, with no KSDC bv and no VAT number. Ask OpenRouter to reissue it.
- [x] **Download the real invoices behind printed mails** (then swap them into the quarter folders and draft lines):
  - **Proximus:** 05/07, 05/08, 05/09, 05/10.
  - **Heroku:** 113030196, 113480171, 113925607.
  - **Webflow:** 11/07, 11/08, 11/09.
  - **Figma:** 13/07, 13/08, 13/09, 13/10.
  - **Proton:** 15/09.
  - **AWS:** Route 53 powerhouse.io 25/07; statements for account 8850 for Jun, Aug, Sep, and the missing Jul.
  - **Optional:** Namecheap (4), Distyra (2), OpenRouter (1).
- [ ] **Missing from the 2026-Q3/Q4 quarter folders** (no documents in the mail): Notion, Descript, Radius fuel, Acerta, KBC card statements, Bolero, Petit Mazda, LRS insurance, Vlabel, POM, till receipts.

## Business Travel

- [ ] **Still undated:** Boston's return taxi (no receipt) and the Funding the Commons ticket (the receipt only gives the purchase date).
- [ ] **Billed but on no trip:** the PARKOFFICE co-working day of 2025-08-06 (2025010).
- [ ] **Personal 2026 trips left out:** Australia, China, Barcelona in April, the Berlin festival. Confirm.
- [ ] **Trips without a billed hotel**, dated from their flights and trains: Bogotá, Toronto, Denver 2023 and 2025, Copenhagen Dec 2025, and the Barcelona retreat nights.

## Housekeeping

- [ ] **Commit the trip scripts?** They live in `.ph/trips/` and are not committed: `build-trips.mjs`, `receipts-pass.mjs`, `receipts-manual.mjs`, `review*.mjs`. Only the importer and the Business Travel app are committed (089b13e).
- [ ] **`tsc` errors outside this package.** `tsc` reports TS6059 rootDir errors, all from the linked `../powerhouse` checkout; none come from this package's own files.
