# Studio chat

**Studio chat** lets Dylan talk to either assistant from one panel: a server-side OpenAI agent (conversation, undoable presentation changes, one generated/edited image per message) and Claude (conversation, undoable presentation changes, engine/math planning). It is one conversation: Dylan addresses `@ChatGPT` or `@Claude` (prefix match, so `@chat` and `@claudr` work) or `@both`; a message without a mention goes to whoever answered last. With several mentions, the assistants answer in the order named, and each later one sees the earlier replies. Either can hand finished work to the other through a shared, bounded queue. Neither inherits the external ChatGPT/Claude chats, and neither can change repository source or game math from the studio.

## Hosting

Keep the existing private Site: `appgprj_6adbc4a9c2048191aa485a6bc2621da0`, https://gamboligy-studio.djames1.chatgpt.site.

From `slots/`, run `npm run studio:prepare`, then `npm run studio:hosting`. This copies canonical sources into the retained Vinext wrapper at `hosting/`. Install/build/publish it through the Sites workflow, preserving the Site ID and private audience. D1 (`DB`) and R2 (`BUCKET`) are declared; commit the generated Drizzle migrations (`hosting/drizzle/`, generated from `server/schema.ts`). Do not create tables from request handlers.

Server secrets (never in the frontend, project JSON, Git, handoffs or hosting manifest; local env files are ignored):

| Variable | Needed for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI chat | Optional `OPENAI_CHAT_MODEL` (default `gpt-6-astra`), `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-sunburst`). |
| `ANTHROPIC_API_KEY` | Claude chat | Optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `ANTHROPIC_EFFORT` (`low`…`max`, default `medium`). |
| `STUDIO_DISPATCH_SECRET` | Background handoffs | At least 32 random characters. Without it the dispatch route answers 404 and the background option is hidden. |

Verify each key with a bounded live check after provisioning. `npm run serve` still runs offline quick edits but has no `/api/studio/*` server.

## State and safety

- Sites user identity owns every run and handoff; cross-origin writes are rejected.
- A transactional D1 lock allows one assistant writer per user/project. It remains until the result is applied or discarded. A provider must be confirmed stopped before its lock is released.
- **Cancellation is provider-specific.** Each run records its `provider`. OpenAI runs cancel the recorded Agents session at OpenAI. Claude runs use the stateless Messages API: generation stops when the stream closes, and the invocation streaming it aborts on its next heartbeat once the run is no longer `running`. A provider that cannot confirm the stop keeps the lock (`interrupted`).
- **Leases.** The invocation streaming a run renews `lease_until` every 15 s (90 s lease). A run whose lease lapsed (closed tab, lost Worker) is stopped at its provider, marked failed and its lock released when another request needs the project. Only a run still `running` can complete: a late result from a cancelled, discarded or reclaimed run is rejected and never reaches the browser.
- A durable request ID and input hash prevent duplicate paid submissions. Repeating an ID retrieves the existing result; changed input cannot reuse it.
- OpenAI: Agents API with `environment: {type: 'none'}`. Claude: Messages API with two client tools (`stage_scene_edits`, `complete_handoff`), adaptive thinking, server-side refusal fallback (`fallbacks: "default"`), prompt caching. Limits per request: 12 tool calls, 50 edits, five minutes; OpenAI one generated image; Claude 120k output tokens per turn. No code sandbox is exposed to either.
- Only a completed turn counts as success; an idle event, refusal, truncated tool call or closed stream does not.
- R2 holds private results, generated image bytes and background snapshots. D1 holds metadata. The editor can restore a saved response after disconnecting. Projects and the visible transcript remain browser-local; export/import transfers projects.
- Operations are validated twice and applied as one Undo step. A running game round or changed local revision prevents automatic application. The browser records application before acknowledging it, so an acknowledgment failure does not cause repeated application.
- The transcript records which assistant wrote each reply. Each model receives the other's replies as labelled conversation, never as its own turns.

## Handoffs

A handoff is created only from applied work. With **Continue automatically**, the browser starts the next connected assistant after acknowledgment. Two handoffs per chain, then `paused_limit`. Missing providers wait (`waiting_connection`). Each job allows one retry after a lost connection (`attempts`, request IDs `next-…` then `r2-next-…`); a second loss marks it `failed`. **Stop** on a queue item, Stop on a running request, or discarding a result stops everything derived from it.

**Background (opt-in, requires `STUDIO_DISPATCH_SECRET`).** With "Keep going while the studio is closed", the acknowledgment stores the applied project snapshot with the job. Each background hop runs from its stored snapshot, stages its result for review, and queues the next hop from the snapshot plus those edits. The chain keeps the project lock until Dylan reviews the results in the studio, oldest first. Nothing changes the browser's project without that review.

Background hops run when a signed trigger calls `POST /api/studio/hooks/dispatch`:

```
X-Studio-Timestamp: <unix seconds>
X-Studio-Signature: sha256=<hex HMAC-SHA256(STUDIO_DISPATCH_SECRET, "<timestamp>.<raw body>")>
{"id":"<unique event id, 8–120 of [-\w.:]>"}
```

Timestamps older than five minutes are rejected and each event ID is accepted once (seven-day replay window). Each accepted event recovers abandoned background jobs, then runs the oldest ready one to completion and answers `{status, id, next}` (never result content). One event runs one hop.

**Boundary.** The Sites manifest declares no cron, queue or Durable Object binding, so nothing in this Site calls the dispatch route by itself. Unattended operation needs Dylan to connect a caller (for example an hourly scheduler holding the secret), and to confirm the private Site lets that unauthenticated, signed POST reach `/api/studio/hooks/dispatch`. Editing `HANDOFF.md` or finishing an external Claude.ai/ChatGPT conversation does not start an agent. Repository coding additionally needs a configured code sandbox and source-access integration; the scene tools cannot modify source code.

| Route | Purpose |
|---|---|
| `GET /api/studio/status` | Connection flags/capabilities (`openai`, `claude`, `background`), no credentials |
| `POST /api/studio/chat` | NDJSON status/text/result/error stream; `provider` is `openai` or `claude` |
| `GET /api/studio/active` | Find unfinished owned requests (`stale` when the lease lapsed) |
| `GET /api/studio/runs/:id` | Restore status/result |
| `POST /api/studio/runs/:id/ack` | `{applied,autoContinue,background?,snapshot?}`; release lock, create one handoff |
| `POST /api/studio/runs/:id/cancel` | Stop/discard work at its provider, and anything handed off from it |
| `GET /api/studio/handoffs` | Owned shared provider queue |
| `POST /api/studio/handoffs/:id/start` | Claim once and invoke the registered target (reclaims an abandoned attempt) |
| `POST /api/studio/handoffs/:id/stop` | Stop a queued or running handoff and its descendants |
| `POST /api/studio/hooks/dispatch` | Signed background trigger (no Sites identity; HMAC only) |

Chat input: `{id,message,provider,project,scene,selection,attachment,history}`. `project` is validated Studio state, `attachment` is an existing asset ID, and history holds bounded `{role,text,speaker}` messages (`speaker`: `user`, `openai` or `claude`). Handoff start receives the same current project context; the server supplies the task/provider from its saved record (and the stored snapshot for background jobs).

## Providers

`providers` in `server/service.js` registers both adapters with the same contract:

```js
{
  label: 'Claude',
  configured: env => Boolean(env.ANTHROPIC_API_KEY),
  async run(env, input, {progress, sessionCreated, signal}) { return {text, operations, handoff}; },
  async cancel(env, run) { /* resolve when stopped; throw when it cannot be confirmed */ },
}
```

`server/claude.js` uses `@anthropic-ai/sdk` (`client.beta.messages.stream`) in a manual tool loop so the studio's limits, validation and cancellation stay in one place. Tool inputs stream eagerly and are validated before use; an unparseable streamed input is re-issued at most twice. Claude cannot generate images; it hands artwork to OpenAI.

## Verification

Run `npm ci` in `slots/` once first; it installs the pinned `@anthropic-ai/sdk`. `npm test` includes SQLite-backed service tests built from the committed Drizzle migrations, with simulated providers: identity, tenant isolation, locks, request reuse, acknowledgment/discard rules, sequential handoffs and limits, provider-specific cancellation, a provider that cannot be stopped, stale/late completions, concurrent writers, lost-connection retry and its limit, background chains with stored snapshots, discard cascades and the signed trigger. Adapter tests cover SSE and function results with a mocked OpenAI transport, and Claude's tool loop with a stand-in SDK client. `npm run test:studio-browser` drives the chat panel in Chromium against the real server code. None of this establishes real model access or replaces a live credentialed check.
