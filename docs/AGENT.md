# Assistant

Igris uses `clarke-1.0` through the OpenAI-compatible Radium API. The model interprets the question and history, chooses a mode, and writes the response. There are no stored conversational replies. Prompts live in `src/lib/agent/prompt.ts`; source selection is shared by chat and comparisons in `src/lib/agent/research.ts`.

## Three modes

| Mode | When used | What happens |
|---|---|---|
| Conversation | Greetings, capabilities, preferences and app questions | The model streams a contextual reply; no source search or scientific reviewer |
| Context | A follow-up answerable from earlier sources | The server re-reads those source IDs, then answers from that evidence. Live reports receive semantic review; local follow-ups normally use citation checks |
| Search | A new topic, study, evidence request or missing information | The server searches and assembles evidence; overviews stream grounded paragraphs, while comparisons and detailed file/measurement questions undergo semantic review |

The planner sees the last eight turns, selected studies and previous source IDs. History helps resolve references; old model prose is not itself scientific evidence. Source IDs are validated and re-read from the catalog or NASA NTRS, so the browser cannot supply invented source text. A context request with unavailable sources falls back to search. A new named study does not inherit unrelated comparison focus.

Only actual work is shown in the UI: reading earlier sources, searching, writing, and (for new research) checking evidence. The internal routing call does not display a fictitious search-plan action.

## Live public research

Chat can consult the public [NASA NTRS repository](https://ntrs.nasa.gov/) when the planner identifies an external evidence request or when local retrieval lacks evidence relevant to the request. The planner supplies up to two short English bibliographic queries. The server never substitutes the raw question or conversation history as a NASA query. An explicit NASA NTRS citation can be opened by its ID, and follow-ups reopen earlier NTRS IDs without running a new text search.

Each public lookup has one 6.5-second budget and considers up to four reports, including excerpts when NASA provides extracted text. Chat and comparison share the lookup, filtering and citation rules. Missing text or a temporary NASA error leaves the catalog evidence available. Abstracts and partial text excerpts are distinguished from measured results and search matches do not establish an exact study association. Live evidence passes the existing answer review. Set `PUBLIC_RESEARCH_ENABLED=false` to disable the integration.

A new catalog comparison uses the same search with the selected study titles and any already linked NASA report IDs. The first matching reports from each search are considered before additional hits. The verified answer and its source cards are cached together, so reopening does not repeat the model or NASA calls. The regenerate action explicitly requests a new, metered answer and saves it in the current browser conversation; it does not overwrite the shared cached answer.

## Search and evidence selection

- Exact PSI accessions and acronyms are resolved first; Unicode hyphens and case normalize consistently.
- Explicit detail/comparison requests keep the requested studies instead of adding unrelated studies.
- Topic searches try all-term matching first and broaden only when that query has no hits. Rank fusion combines query results. A normal topic answer gets up to four investigations; explicitly named sets can use up to eight.
- `search_study_chunks` reserves relevant abstracts and file passages for selected investigations. Deploy the scoped-search migration before using this RPC on another database.
- Reviewed references match their identifiers, titles, keywords, reviewed summaries and saved source text. Direct study associations remain distinct from program context and related work.
- The model requests file evidence when values, tables, test IDs or detailed conditions are needed. General introductions need not carry large file tables. Excerpts retain filename, headers, row/sheet/page locator, snapshot date and coverage.
- Context contains at most eight abstracts, generally two per investigation, and at most six file excerpts when requested. Missing values and units stay unknown; inventories do not prove file contents were read.

## Grounding and review

Scientific claims need supporting citations at the end of the relevant paragraph or comparison cell. Objectives, observed findings, modeling, reanalysis and preliminary results stay separate. Related studies cannot donate results to the selected study. Comparisons require aligned quantities, units and conditions. Unknown catalog records and missing evidence are different gaps.

Comparison and detailed file/measurement drafts are buffered while reviewed. Ordinary overviews and context follow-ups stream paragraphs after citation-ID/destination checks; a citation problem triggers a bounded correction instead of publishing the invalid paragraph. The reviewer can accept the draft or return one corrected version retaining the supported parts and explaining specific gaps. Invalid citation IDs and authored destinations cannot pass final checks. A reviewer-format/provider failure is reported as a service failure, rather than falsely claiming the sources lack the answer. Model review is fallible and does not certify scientific correctness.

Local context follow-ups stream grounded paragraphs and check citation IDs and destinations. Live reports also receive semantic review. This mode is for existing evidence. Requests for new evidence should route to search. Streaming citation checks validate identifiers and destinations, not the scientific truth of every sentence. Conversation replies stream without scientific verification and must not invent study findings.

`taskContent` includes the task in the final API message while nesting the question, evidence and draft under `input`. Direct tests of this Radium endpoint returned prose instead of plans when the task appeared only in the system role. The prompt constants remain the single instruction source.

## Runtime settings

- `RADIUM_MODEL=clarke-1.0`, `RADIUM_REASONING_EFFORT=low` by default; effort can be low, medium or high.
- Input: 2,000 characters; history: eight turns; default visible output budget: 2,000 tokens plus 2,000 reasoning tokens. Comparisons get 600 extra output tokens.
- `LIMIT_MODEL_TIMEOUT_MS=30000` bounds a complete model call or stream; `LIMIT_REQUEST_TIMEOUT_MS=60000` bounds the request. Browser requests stop after 70 seconds.
- `LIMITS_ENABLED=false` disables server quotas for local testing. It defaults to true when absent; set true in production. Usage accounting continues, but no remaining-message countdown is sent or shown. See [SECURITY.md](SECURITY.md).

Keys live only in `.env.local` or deployment environment variables. They never enter prompts, browser code or saved history.

## Chat behavior

Conversation history stays in the browser. Copy acts on the assistant response, with copied/failed feedback. Regenerate/try again replaces the latest response to the same user turn without duplicating that turn. Stop cancels the request; running indicators settle on cancellation, failure or disconnect. Source cards distinguish citations used in the answer from other retrieved matches.

## Verification

Run `npm run check:agent`, `check:references`, `check:files`, `check:ingest`, `typecheck`, `lint`, `build`, then `check:api`. API tests use isolated database/model fixtures, including conversation generation, context reuse without search, revised answers, invalid citations, unfinished streams, timeouts and both quota-switch states. They do not spend provider credits or establish real-model answer quality. Test live conversations separately in chat.

Design research and primary-source links: [research-agent-design-2026-11-15.md](research-agent-design-2026-11-15.md).
