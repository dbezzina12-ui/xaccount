# Studio chat

**Studio chat** uses a server-side OpenAI agent for conversation about the current project, undoable presentation changes, one generated/edited image per message, and handoffs to Claude. It does not inherit the external ChatGPT/Claude chats and cannot change repository source or game math.

## Hosting

Keep the existing private Site: `appgprj_6adbc4a9c2048191aa485a6bc2621da0`, https://gamboligy-studio.djames1.chatgpt.site.

From `slots/`, run `npm run studio:prepare`, then `npm run studio:hosting`. This copies canonical sources into the retained Vinext wrapper at `hosting/`. Install/build/publish it through the Sites workflow, preserving the Site ID and private audience. D1 (`DB`) and R2 (`BUCKET`) are declared; commit the generated Drizzle migrations. Do not create tables from request handlers.

Provision `OPENAI_API_KEY` securely as a server secret. Optional variables: `OPENAI_CHAT_MODEL` (default `gpt-6-astra`) and `OPENAI_IMAGE_MODEL` (default `gpt-image-2.5-sunburst`). Verify the API project's Agents read/write, Responses inference and image access with a bounded live check. Local env files are ignored. Keys never enter the frontend, project JSON, Git, handoffs or hosting manifest.

`npm run serve` still runs offline quick edits but has no `/api/studio/*` server.

## State and safety

- Sites user identity owns every run and handoff; cross-origin writes are rejected.
- A transactional D1 lock allows one assistant writer per user/project. It remains until the result is applied or discarded. An interrupted provider must be stopped before releasing its lock.
- A durable request ID and input hash prevent duplicate paid submissions. Repeating an ID retrieves the existing result; changed input cannot reuse it.
- Agents API uses `environment: {type: 'none'}` for constrained studio functions. Limits: 12 tool calls, 50 edits, one generated image and five minutes per request. No code sandbox is exposed.
- Only a completed turn counts as success; an idle event or closed stream does not. Completed sessions are removed. Uncertain sessions retain their IDs for cancellation/recovery.
- R2 holds private results and generated image bytes. D1 holds metadata. The editor can restore a saved response after disconnecting. Projects and the visible transcript remain browser-local; export/import transfers projects.
- Operations are validated twice and applied as one Undo step. A running game round or changed local revision prevents automatic application. The browser records application before acknowledging it, so an acknowledgment failure does not cause repeated application.
- Only applied/acknowledged work produces a handoff. Discarding never advances the other agent.

## Claude adapter

Register Claude in `providers` in `server/service.js`. It is deliberately `null` until Claude implements and tests the adapter and configures its server credential. Outgoing work stays `waiting_connection` without spending.

```js
{
  configured: env => Boolean(env.ANTHROPIC_API_KEY),
  async run(env, input, {progress, sessionCreated, signal}) {
    return {text, operations, handoff: null};
    // Optional return handoff: {to:'openai',summary:'...',nextTask:'...'}
  }
}
```

Read current Anthropic docs, reuse project validation, enforce tool/spend limits and handle cancellation. **Make cancellation provider-specific before registering Claude**; the current implementation targets the only active provider, OpenAI. Never accept arbitrary provider URLs, shell commands or credentials from model output.

| Route | Purpose |
|---|---|
| `GET /api/studio/status` | Connection flags/capabilities, no credentials |
| `POST /api/studio/chat` | NDJSON status/text/result/error stream |
| `GET /api/studio/active` | Find unfinished owned requests |
| `GET /api/studio/runs/:id` | Restore status/result |
| `POST /api/studio/runs/:id/ack` | `{applied,autoContinue}`; release lock, create one handoff |
| `POST /api/studio/runs/:id/cancel` | Stop/discard work |
| `GET /api/studio/handoffs` | Owned shared provider queue |
| `POST /api/studio/handoffs/:id/start` | Claim once and invoke the registered target |

Chat input: `{id,message,provider,project,scene,selection,attachment,history}`. `project` is validated Studio state, `attachment` is an existing asset ID, and history holds bounded `{role,text}` messages. Handoff start receives the same current project context; the server supplies the task/provider from its saved record.

With **Continue automatically** enabled, the browser starts the next connected provider after acknowledgment. Two handoffs per chain are allowed before pausing. Missing providers wait.

**Boundary:** automatic continuation currently requires the studio to remain open. Worker requests are not a durable background dispatcher. Unattended operation needs signed provider webhooks and a durable dispatcher that respects private Site access. Editing `HANDOFF.md` or finishing an external Claude.ai/ChatGPT conversation does not itself start an agent. Repository coding additionally needs a configured code sandbox and source-access integration.

## Verification

`npm test` includes SQLite-backed service tests with simulated providers: identity, tenant isolation, locks, request reuse, acknowledgment/discard rules, sequential handoffs and limits. Adapter tests cover SSE and function results with a mocked OpenAI transport. They do not establish real model access or replace a live credentialed check.
