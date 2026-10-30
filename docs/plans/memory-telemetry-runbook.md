# Memory telemetry runbook

How to measure Vetra's memory growth during a mail backfill, one run per fix.
Background: `workspace/memory-telemetry-plan.md`, section 8.

## Settings

Add to the project's `.env`, which is not committed:

```
PH_PROCESSOR_TIMING=basic
PH_MEMORY_TELEMETRY=on
PH_MEMORY_TELEMETRY_OUTPUT=memory,file,console
PH_MEMORY_TELEMETRY_INTERVAL_MS=30000
```

Use `PH_PROCESSOR_TIMING=detailed` while diagnosing a slow catch-up: it adds time
per document type and a warning for each batch over `PH_PROCESSOR_SLOW_BATCH_MS`.

## One run

1. Wouter restarts Vetra. Kill the old process tree by PID first, and never run two
   stacks on one store.
2. Start the mail backfill and leave it for 90 minutes. Keep the same workload
   and window for every run.
3. Check the console. Every five minutes a line reads:

   ```
   memory: rss 4.12 GB (+61 MB/min) · heap 2.35 GB, post-GC 2.10 GB (+49 MB/min) · pglite 3.60 GB · 1830 ops/30s, 17 MB/1k ops · top: processors.bufferedLiveOps +2.9k/min
   ```

4. Take two heap snapshots from the Memory tab of the reactor monitor, at about
   2.5 GB and 30 minutes later. A snapshot blocks the server for seconds to
   minutes, and needs about the heap's size in free memory. Compare them in
   Chrome DevTools ("Comparison"), looking for `JobInfo`, `Task` arrays under
   `ProcessorQueue`, and long strings.
5. Record the post-GC MB/min, the MB per 1000 operations, the top gauges and the
   PGlite WASM per store.

## Reading the results

- The samples are in `.ph/telemetry/memory-<start>-<pid>.jsonl`, one JSON object
  per line, and in the Memory tab.
- The post-GC heap is the leak signal. `heapUsed` saw-tooths.
- PGlite WASM only grows, so rising RSS with a flat heap is not a JS leak.
- Rising `contexts.native` or `contexts.detached` points at module graphs kept
  across Vite reloads.
- `jobTracker.failedPayloadBytes` is what failed jobs hold in memory.
- `queue.completedJobs`, `consistency.keys` and `processors.bufferedLiveOps` are
  the gauges the planned fixes should flatten.

The processors tab's Time view shows each processor's busy time. Comparing the
same catch-up at `PH_PROCESSOR_TIMING=off` and `basic` shows what the timing costs.

## Container host

`hosts/cli/cli.env.example` lists the same settings. The container has no `ph`
console display, so add `PH_PROCESSOR_TIMING_LOG_MS=60000` to get the slowest
processors in its log.
