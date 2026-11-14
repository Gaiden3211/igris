# Architecture

```
Browser ── Next.js on Render ──┬── Supabase Postgres (data, search, usage log)
  (Astryx UI)   (UI + /api)    └── Radium API (assistant model, primary + backup key)

GitHub Actions ── scripts/ingest.ts ── PSI API + NTRS API ──► Supabase
GitHub Actions ── keep-alive ping every 10 min ──► /api/health
```

One Next.js service serves the pages and the API. The browser never talks to Supabase or Radium directly: both keys stay on the server.

## Request flow: a question to the assistant

1. `POST /api/chat` validates the body (zod), identifies the visitor (cookie id + hashed address) and checks quotas.
2. **Plan**: a short model call turns the question into up to three English search queries and a language tag.
3. **Retrieve**: Postgres full-text search over investigations and text passages; named accessions or acronyms are resolved directly. Matching records, their parameters and publication abstracts become a `SOURCES` block, each item with a citation id (`PSI-25`, `PUB-412`).
4. **Answer**: the model streams an answer written only from `SOURCES`. The browser receives newline-delimited JSON events (`step`, `sources`, `delta`, `done`, `error`) and turns citation tags into links.
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

Astryx `AppShell` + `SideNav` give the desktop layout; below the medium breakpoint the navigation moves into a drawer and the assistant fills the screen. Theme mode, language, glow color and research area are stored per browser in `localStorage`.
