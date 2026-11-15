# Code review — 15 November 2026

Scope: the accumulated source-catalog, retrieval, grounded-answer and PSI file-index changes. This pass made reliability fixes and simplified existing code; it did not add another data provider or change the corpus.

## Fixes

- Publication reimport retains audited years, repaired URLs/DOIs, authors and saved abstracts. Exact normalized titles may omit a trailing bibliographic year. Source/title keys deduplicate publisher rows without merging NASA PSI and NTRS identities.
- Regular ingestion upserts retained/new publications before removing stale rows. Publication IDs remain stable instead of deleting and recreating every paper. This reduces the risk of data loss from a failed publication write. The full multi-table import is still not a single database transaction.
- The references-only importer uses the same bibliographic merge, so it does not clear existing repaired metadata.
- A single file-excerpt parser is shared by ingestion and retrieval. Invalid JSON, missing locators, invalid field types and oversized records are rejected.
- The file index checks exact NASA endpoint paths, decoded filenames, audit dates, file hashes in section keys, accessible-source status and per-file excerpt counts before writing. Empty or mismatched input cannot clear the working index.
- The file-audit CLI now has explicit functions and limits, readable control flow, bounded responses/downloads, pagination and specific allowed hosts. Resume skips only accessible current-day records with the same file version and current access permissions. Unsupported DOCX files are no longer selected for new downloads.
- Python extraction no longer imports dependencies from a hardcoded temporary directory. Source paths are resolved before checking that they remain inside the download directory.
- Investigation responses deduplicate displayed filenames in one pass and format their response fields separately.

## Verification

Passed:

- `npm run check:ingest`: bibliographic repairs, year/author preservation, cached evidence, source identity and duplicate handling.
- `npm run check:files`: all 1,018 saved excerpts, source locators, BASS-II header/value alignment, malformed records, citation links and selected-study priority.
- `npm run check:references`: 34 saved references, explicit catalog relationships, direct-publication boundaries and retrieval priority.
- `npm run check:api`: a production Next.js server with isolated database/model fixtures; chat, comparison, FILE citations, unsupported/unknown/malformed answer rejection, linked source cards and investigation/catalog metadata. This test is now kept in the repository rather than a temporary file. Run `npm run build` before it.
- An isolated audit-CLI fixture checked duplicate filenames, blocked non-NASA hosts, repeated 404 checks, large-file download avoidance, resume behavior and omission of temporary signed URLs.
- An isolated index fixture checked all 1,018 excerpts and paginated existing rows: zero additions, updates or removals for an identical index.
- TypeScript, ESLint, production build, JavaScript/Python syntax and `git diff --check`.
- `npm audit --omit=dev`: zero known vulnerabilities reported in production dependencies at review time. No dependency versions were changed.

## Limits of this pass

The current `.env.local` targets a local Supabase endpoint at `127.0.0.1:54321`, which was not running. Live-database synchronization attempts therefore failed before reading or changing research records; this review did not reverify or mutate the hosted database. Its settings were left untouched. API verification used deterministic local fixtures, not a live model or a real scientific-accuracy evaluation. No deployment was performed.

## Follow-up review: chat sessions and model responses

Reviewed the complete `295749f` change set, including assistant-ui sessions, sidebar actions, saved comparisons, metadata titles, NASA retrieval, source citations and ingestion boundaries.

Corrections:

- Plan, verdict and title parsing now share a bounded JSON decoder for ordinary, fenced, JSON-string-wrapped and once-escaped provider responses. Escaped quotes inside revised answers are preserved. Each caller still validates its own schema; malformed output is rejected or uses the existing search fallback.
- Unread response identity uses the last assistant response instead of concatenating the entire history, so trimming old messages does not change the identity after reload.
- Reimport retains bibliography entries without abstracts and retains repaired metadata even without a saved abstract. Only actual abstracts become evidence passages; title-only entries remain explicitly labeled as such during retrieval.
- Sidebar actions use keyboard-visible focus rather than all focus, so a pointer click no longer leaves pin and menu buttons visible after the pointer leaves.
- A scoped npm override upgrades only the ESLint parser's nested `minimatch` to `11.0.1` for GHSA-g3hv-75wg-m249. Remove the override when the upstream parser requires a patched version itself. Both production and development dependency audits report zero known vulnerabilities after this change.
- File-index documentation now matches the current UI and supported download formats.

Validation includes parser/ingestion regressions, an escaped-verdict production-API fixture, all 34 reference snapshots and 1,018 file excerpts, mounted chat/branch/background-session/title persistence checks, TypeScript, ESLint, production build, script syntax and a scan of tracked files for credential patterns. The live local investigation endpoint was read successfully without mutating the database. No ingestion, schema migration, deployment or remote push was performed in this follow-up.
