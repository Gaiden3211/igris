# PSI file availability and searchable contents

Checked on 14 November 2026. The current combustion inventory has 593 database rows representing 591 distinct investigation/filename pairs. Two summary tables also occur in the ordinary-file category, so they are extracted once. The API deduplicates the displayed filenames.

## Result

- 589 distinct files returned actual bytes through the official NASA PSI download flow.
- Two Saffire-I PDF objects repeatedly returned HTTP 404 from storage, including rechecks with the latest version. They are marked unavailable, have no indexed text, and remain in the provenance inventory rather than being treated as working evidence.
- 68 small files were downloaded locally, totaling approximately 22 MB. No binaries were uploaded to Supabase.
- Text from 63 files across 15 investigations became 1,018 searchable excerpts. Forty-three files were indexed within the extraction limits; 20 were indexed partially. Three PDFs contained no usable extracted text and two DOCX graph files were not parsed.
- 521 accessible files were not selected for text extraction. This includes large archives, media, and other files outside the size/format limits. Accessibility is not the same as indexed content or full archive integrity.
- The other 1,479 non-combustion inventory rows have not undergone this file-availability audit.

The complete access outcomes, SHA-256 hashes for full downloads, extraction coverage and original stable URLs are in [the audit manifest](psi-file-audit-2026-11-14.json). Access probes requested a small byte range; this does not verify entire multi-gigabyte archives. The two failed objects each had repeated resolver/storage checks. NASA's currently supplied download service resolves short-lived S3 URLs; those signed URLs are never persisted or shown as permanent citations.

## Evidence boundaries

CSV excerpts preserve source header cells, original string values and record numbers. Excel excerpts retain sheet names, row numbers and preceding header context. Cached workbook values are read without executing formulas or macros. PDF excerpts retain page and line locators. Missing units, blank cells, ambiguous headers and spreadsheet date serials are not guessed or normalized into scientific parameters. PDF diagrams and image-only pages have not been interpreted.

The 63 indexed files include BASS, BASS-II, CFI, ACME CFI-G, SAME, SAME-R, DAFT and Saffire summary tables, plus cool-flame analyzed data and selected technical documents. Indexing an excerpt does not validate the experiment's methodology or make different test conditions comparable. The structured `investigation_parameters` table remains unchanged.

Chat and comparison receive bounded file excerpts with `FILE-{chunk_id}` citations. Relevant full-text matches are preferred; a fixed-investigation comparison can include a small default selection. Every file citation points to the stable NASA download endpoint and carries the source row/sheet/page locator. The response prompt and verifier still check claims against the actual supplied excerpt; a filename or inventory count is not evidence of a measured result.

Investigation responses retain download availability, indexed-content status and the audit date. The interface links to original downloads without repeating these technical status lines beneath every file. A regular PSI metadata reimport preserves file-evidence passages; a fresh file audit and index synchronization are needed to refresh their dated content.

## Reproduce

1. With database environment loaded, run `node --env-file=.env.local scripts/audit-psi-files.mjs /tmp/igris-file-audit`. It refreshes public investigation metadata, checks downloads with bounded requests, and downloads selected CSV, TXT, DAT, XLS/XLSX and PDF files no larger than 2 MiB, under a 60 MiB total budget. Only specific NASA and NASA-returned S3 hosts are accepted.
2. Run `scripts/extract-psi-files.py /tmp/igris-file-audit` with the bundled Python runtime containing openpyxl, plus xlrd for legacy XLS support and Poppler's `pdftotext`. Install optional readers into your chosen Python environment or pass their directory through `PYTHONPATH`; the script has no machine-specific dependency paths. The script reads existing sources and writes the public status snapshot and text excerpts. It never edits source workbooks or executes workbook content. XML workbook expansion is bounded.
3. Run `node --env-file=.env.local --import tsx scripts/index-psi-files.ts`. It synchronizes only the audited investigations' `file:` passages. Stable investigation/filename hashes identify excerpts. Repeated runs update them without duplicating evidence and verify the resulting count.
4. Run `npm run check:files`, `npm run check:references`, `npm run typecheck`, and `npm run lint`, then the production build.

Local downloaded files are temporary extraction inputs. Saved application data consists of source metadata and text excerpts, approximately 2.8 MB of excerpt content before database/FTS overhead. The JSON transport snapshot is approximately 3.7 MB because of escaping and metadata. This is not a measurement of total Supabase disk usage.

## Verification completed

Live full-text search returned the BASS-II file excerpts. HTTP smoke tests confirmed that chat receives the selected study's file evidence, known `FILE-*` citations can be published after review, unknown file IDs are blocked, and investigation responses expose availability/index status without duplicate filenames. The permanent NASA URL was checked to return an HTTP 302 download redirect. Model-facing checks used a local model stub; real-model scientific accuracy was not measured.

Repeated indexing added zero duplicate passages. Total searchable passages after this import: 1,611, including 1,018 file excerpts. Reference-boundary tests, file provenance/cell-alignment tests, TypeScript, lint and production build passed.
