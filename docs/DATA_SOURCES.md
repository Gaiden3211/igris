# Data sources

## Live search and catalog statistics

The live search service is the official [NASA Technical Reports Server](https://ntrs.nasa.gov/). Igris sends short scientific keywords, a catalog study title, or a known NTRS citation ID to that service. It reads publicly available abstracts and extracted text within a fixed time and size budget. The chat and comparison views use the same lookup. Individual sources appear as citations in results.

Analytics counts the local snapshot of records, inventories, and publication links. Live search results do not change those counts. Catalog and analytics normalize whitespace and hardware names, including known DECLIC spelling variants, without modifying the imported records. File inventories record listed files; indexed excerpts are a separate measure of evidence coverage. In the local snapshot checked on 15 November 2026, 133 study records and 253 publications were present. The file index held 1,018 excerpts across 15 studies. Counts will change after future imports.

## Data

| Source | Publisher | Access | Used for |
|---|---|---|---|
| [Physical Sciences Informatics (PSI) repository](https://psi.nasa.gov/geode-py/ws/repo/search?source=psi&type=investigation&size=1&from=0) | NASA Biological and Physical Sciences | Open, no login | Investigation metadata, file inventories, publication lists |
| [NASA Technical Reports Server (NTRS) API](https://ntrs.nasa.gov/api/citations/search?q=combustion&page.size=1) | NASA STI Program | Open, no login | Related technical reports and abstracts |

Endpoints used by `scripts/ingest.ts`:

- `GET https://psi.nasa.gov/geode-py/ws/repo/search?source=psi&type=investigation&size=200&from=0`
- `GET https://psi.nasa.gov/geode-py/ws/repo/investigations/{PSI-ID}`
- `GET https://ntrs.nasa.gov/api/citations/search?q=...&page.size=5`

## References

All from the challenge's resource list:

- The Flame in Freefall challenge page is retained only as historical attribution in the audit archive: its endpoint could not be read during the 2026-11-14 checks.
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/)
- [A Researcher's Guide to International Space Station Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/)
- [Apollo 1](https://sma.nasa.gov/sma-disciplines/accllp/apollo-1), [Apollo 13](https://sma.nasa.gov/sma-disciplines/accllp/apollo-13), [Fire Aboard Space Station Mir](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/)
- Spinoff: [Fireman's Air Tanks](https://spinoff.nasa.gov/node/9582), [Fire Detector](https://spinoff.nasa.gov/node/9407), [New Technology for the Fire Attire](https://spinoff.nasa.gov/node/9918)

## Images

None yet. Every image added later gets a row in the `sources` table (`kind = 'image'`) with its original URL and credit, and appears on the Sources page.

## How the data is handled

- Values are stored as published. Empty or missing values stay empty; nothing is estimated.
- Each investigation keeps its full source record (`investigations.raw`) and a link to the original page.
- Three atmospheric reference scenarios were removed from active data on 2026-11-14 because their cited values could not be reverified. Their complete records are preserved in the source audit.
- Hardware labels (CIR, MDCA, MSG…) are assigned from investigation acronyms following the groupings in the challenge statement.

## Known limitations

- The PSI API is not formally documented. The import reads fields tolerantly and reports anything it cannot map.
- A file listed in PSI can still fail to download. Igris lists files; it does not mirror them.
- NTRS reports are matched by acronym search, so a listed report may be related rather than produced by the investigation.
- Structured test conditions (oxygen, pressure, flow) are not present in PSI metadata. They have to be added from summary tables and papers; until then the conditions chart stays empty.
- PSI has no partial-gravity combustion data.


## Finding and checking the data

Catalog queries match IDs, acronyms, titles, and indexed English text. Filter by topic, hardware, and listed files or tables. Sort by relevance, start date, name, files, tables, or publication count. An unknown start date goes last in either date order. File counts are publisher inventories; the investigation screen links to PSI for original access.

Before the 2026-11-14 source audit, Supabase returned 72 investigations, 776 publication records, 2,072 indexed file rows, 277 searchable passages, and zero structured parameter rows. A missing value is not zero. The snapshot did not contain an exact record for FLEX-2, so it should not be represented as a catalog study. The [NASA program review](https://ntrs.nasa.gov/citations/20130004397) describes FLEX-2 separately. The [BASS-II summary report](https://ntrs.nasa.gov/citations/20210011385) is another example of an original source for manual review.

A future structured measurement should carry the source URL, page or table, original value and unit, and curation status. A connected Excel workbook can help review and sort those candidate rows; Supabase remains the application database.


## Flame in Freefall research sources

| Topic | Primary source | Use in Igris |
|---|---|---|
| Solid fuels, oxygen, and ventilation | [BASS-II summary report](https://ntrs.nasa.gov/citations/20210011385) | Reported observations and estimates |
| Droplet burning and extinction | [FLEX detailed tests](https://ntrs.nasa.gov/citations/20150023456) | Results of early FLEX tests and links to test-level tables |
| Multicomponent fuel and droplet pairs | [NASA low-gravity combustion program review](https://ntrs.nasa.gov/citations/20130004397) | Scope of FLEX-2 |
| Gaseous flames, soot, and cool flames | [ACME overview](https://ntrs.nasa.gov/citations/20220015583) | Scope of the experiment series |
| Large-scale flame spread | [Saffire IV and V](https://ntrs.nasa.gov/citations/20210017780) | Preliminary results for uncrewed Cygnus tests |
| Smoke and detection | [Smoke properties and transport](https://ntrs.nasa.gov/citations/20080012612) | Experimental particle measurements and separate modeling results |

The catalog can link to these records without downloading PDFs or search results at request time. Run `npm run ingest -- --references-only` with the project's database environment to register their bibliographic records. The same records are included in the regular import.


## Review on 14 November 2026

The reviewed source list now includes journal reports on quiescent SoFIE acrylic sheets (2026), SoFIE-GEL spheres (2025), FLEX-2 soot analysis (2025), Saffire VI preliminary findings (2024) and vehicle modeling (2025), lunar flammability facility tests (2025), and the SoFIE-GEL FY2026 project report. Full bibliographic links and evidence types are displayed on the Sources page.

Run `npm run refresh:references` to fetch NASA abstracts into `src/lib/agent/reference-content.json`. Requests use fixed NASA API endpoints, fail on invalid records, and replace the snapshot only after the refresh succeeds. DOI and university sources currently use reviewed summaries. The agent receives the included text, its publication year, evidence type and review date in chat and comparison. A link alone does not supply unindexed paper sections, and abstracts do not supply complete test tables. Links may lead to publishers that restrict automated access. The reviewed set is a dated selection, and its review date does not certify exhaustive coverage or continuous updates.


The expanded review includes 31 sources. Added coverage includes exploration atmospheres (2026), fire barrier test development (2026), the LUCI rotating-rocket experiment (2025), battery thermal-runaway products (2025), portable extinguisher modeling (2024), acid-gas uptake and postfire interpretation (2023), ISS aerosol monitoring (2026), JAXA FLARE experiments (2023–2024), and wire ignition, partial-gravity tests and numerical modeling (2026). The registry marks experimental evidence, modeling, scope, preliminary findings and reanalysis separately. Its NASA abstract snapshots and reviewed summaries occupy approximately 45 KB. Topic retrieval was checked on 11 questions spanning the expanded coverage.


## Source accessibility audit, 14 November 2026

The audit checked 601 distinct original URLs with retries and alternative official APIs, looked up 199 distinct publication titles without usable links, and checked recovered DOIs. It retained 251 publication rows with extractable source text and archived 525 rows without extractable content. Thirty-six retained rows received recovered or repaired links. Before this audit all publication abstracts in the database were empty; the retained text is now stored and indexed. Most retained texts are abstracts, two are dataset descriptions, and one is the abstract extracted from an open PDF. None of these imply that every section or data file was downloaded.

The complete removed records, atmospheric scenarios, challenge source row, per-URL access results, retained texts and post-application counts are in [the audit archive](source-audit-2026-11-14.json). Publisher blocking, empty content, missing metadata, timeouts and confirmed missing pages are recorded separately. A blocked publisher is not evidence that a paper is invalid. Removing a row from the working corpus prevents unsupported citations; the archive makes the decision reversible.

All 72 PSI investigation records remain. The 2,072 file inventory rows are metadata; individual binary downloads were not verified. The 31 curated research references remain usable through their saved NASA abstracts or explicitly labeled reviewed summaries, including when publisher sites restrict automated access. Three registry links were repaired, and the inaccessible challenge registry entry was removed. No atmospheric scenario values remain active.

Title-only publications can appear in investigation details and retrieval as references. Only indexed text supports factual claims. Reimport preserves audited abstracts and repaired links by normalized exact title, and excludes publications with no URL or text. Investigation publication counts are recomputed from the retained rows. No Exa integration is included in the application.


## Targeted expansion and catalog links, 14 November 2026

A second targeted review expanded the curated set from 31 to 34 sources. The additions are the 2026 Saffire heat/smoke analysis (NTRS 20260001992), CFI pressure/radiation modeling (20260002014), and partial-gravity centrifuge CFD (20260000641). Official abstracts are saved; NASA-hosted PDF availability was checked, but full PDF tables are not yet indexed. The JAXA June 2026 explanation is linked as supporting provenance for existing REF-7 rather than counted as another independent experiment. See [research findings](research-source-expansion-2026-11-14.md).

Reviewed associations connect 24 sources to 16 catalog investigations through 65 links. Ten sources have an explicit catalog gap and remain searchable thematic references without a forced study identity. Every association has one of three relationships: `study` (that investigation), `program` (broader program overview), or `related` (another study/context). Source and investigation pages show these relationships and link in both directions. The catalog's additional source count is separate from its publication count. The complete mapping and reasons are in [the association manifest](research-source-links-2026-11-14.json).

Only two exact study links with official abstracts are promoted to publications: the BASS-II summary for PSI-25 and the 2026 CFI radiation paper for PSI-39. Saffire VI papers are related work for Saffire I–III and are never registered as those flights' direct publications. Chat, comparison and the answer verifier receive the same relationship qualifiers. Direct evidence outranks newer related work when an exact PSI identifier is requested. Linked source text is also indexed for full-text search.

After applying this expansion: 46 source registry rows (including data/software/background), 34 curated research sources, 253 publication rows, and 593 searchable passages. The earlier audit archive preserves the counts at its own completion time.

Run `npm run check:references` for snapshot integrity, relationship boundaries, and exact-study retrieval priority. To synchronize the reviewed references, direct publications and linked search passages without reimporting all PSI data, run `node --env-file=.env.local --import tsx scripts/ingest.ts --references-only`. Repeating it updates the existing links without creating duplicates. Normal ingestion also preserves these associations.

## Combustion file audit and extraction

The 593 combustion file inventory rows were audited separately from publication URLs. They represent 591 unique files: 589 accessible and two repeatedly missing storage objects. Small-file extraction indexed 1,018 excerpts from 63 files across 15 investigations, with original CSV record, Excel sheet/row and PDF page locators. Twenty files have partial coverage. The other 1,479 non-combustion rows remain inventory-only and unverified for download availability. [Details and reproduction](PSI_FILES.md).
