# Architecture

```
Browser ── Next.js on Render ──┬── Supabase Postgres (data, search, usage log)
  (Astryx UI)   (UI + /api)    └── Radium API (assistant model, primary + backup key)

GitHub Actions ── scripts/ingest.ts ── PSI API + NTRS API ──► Supabase
GitHub Actions ── keep-alive ping every 10 min ──► /api/health
```

One Next.js service serves the pages and the API. The browser never talks to Supabase or Radium directly: both keys stay on the server.

## Request flow: a question to the assistant

1. `POST /api/chat` validates the body (zod), identifies the visitor (cookie id + hashed address) and checks quotas when `LIMITS_ENABLED` is true.
2. **Route**: the model uses the question, recent history and previous source IDs to choose conversation, context reuse or new search.
3. **Read evidence when needed**: context reuse re-reads known source IDs; new search resolves named investigations, performs scoped/strict-first full-text search and selects reviewed references and optional file excerpts.
4. **Answer**: conversation and context replies stream model text. Ordinary research overviews stream grounded paragraphs; comparisons and detailed file/measurement drafts undergo semantic review, which may accept or correct them. Citation IDs and destinations are checked against authoritative source cards. The browser shows only the work actually performed, with copy, retry/regenerate and stop actions.
5. The request is logged in `usage_events` (token counts, no message text).

The model is not asked to call tools itself. The server runs the retrieval steps, so the flow works with any OpenAI-compatible chat model. See [AGENT.md](AGENT.md).

## Source layout

| Path | Contents |
|---|---|
| `src/app/` | Pages (`page.tsx`, `catalog`, `investigations/[id]`, `analytics`, `sources`) and API routes (`api/*`) |
| `src/components/` | `Shell` (navigation and settings), `ChatView`, `PageHeader` |
| `src/lib/` | `env`, `supabase`, `llm` (failover), `limits`, `visitor`, `catalog`, `i18n`, `agent/` (prompts, retrieval) |
| `src/instrumentation.ts` | Self-ping that keeps the instance awake |
| `scripts/ingest.ts` | Data import |
| `supabase/migrations/` | Schema and reference data |

## Research areas are data

Nothing in the code is specific to combustion:

- `domains`: one row per research area. The import creates a row for every area it meets in PSI.
- `parameter_definitions`: the parameters that matter for an area (for combustion: oxygen, pressure, flow speed, fuel…), with English and Ukrainian labels and a unit.
- `investigation_parameters`: one row per value, with the original unit, a source link and an `origin` (`source`, `curated`, `ai_extracted`). A new parameter is a new row, not a migration.
- `scenarios`: named reference conditions per area, used for chart overlays and ranking.

Adding an area means adding rows to these tables. The area selector, filters and charts read from them.

## Database

| Table | Purpose |
|---|---|
| `domains` | Research areas |
| `investigations` | One row per investigation, with a generated full-text column and the raw source record |
| `parameter_definitions`, `investigation_parameters` | Structured test conditions |
| `publications` | Papers listed by PSI and reports found in NTRS |
| `files` | Summary tables and the largest archive files (exact counts live on `investigations`) |
| `chunks` | Text passages the assistant may cite |
| `scenarios` | Reference conditions |
| `sources` | Everything shown on the Sources page |
| `visitors`, `usage_events` | Anonymous quota accounting |
| `chats`, `messages` | Reserved for saved history (not used by the anonymous trial) |

Functions `search_investigations` and `search_chunks` do ranked full-text search. Row-level security is enabled on every table with no policies, so only the server's secret key can read or write.

## Interface

`Shell` owns navigation and settings; on small screens navigation opens in a drawer. Astryx supplies chat presentation, menus, source disclosures and loading indicators; assistant-ui owns thread editing, branching and generation controls. Theme and language are stored per browser in `localStorage`.

`ConversationSessions` retains runtime owners in stable portal containers at the application provider level. Route slots attach/detach these containers without remounting assistant-ui. Active requests continue during same-tab navigation; ten recent idle sessions are retained, and active sessions are never evicted. Closing or reloading the tab still ends client-owned requests: this is not a server job queue.

Chat and comparison history, pinned state and unread response identities are validated and saved in browser storage. Running state is transient. A response becomes read when its end is visible on the active screen in a visible tab; hover and context-menu gestures never mark it read. Deleting a conversation disposes its runtime and blocks late writes from recreating it. Chat and comparison follow-ups send an explicit surface and selected investigation IDs to the shared agent pipeline.


Sidebar titles are generated in the background for a conversation when it is opened or finishes a response. One bounded request through `/api/conversation-title` returns English and Ukrainian variants together. The browser validates and stores both variants with the conversation, preserving them across future messages and selecting the interface language without another model request. Older history receives titles when opened; unconfigured or failed metadata requests retain the local fallback. Title requests use the existing model quota and usage accounting and never delay an answer.
