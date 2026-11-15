# Flame in Freefall: targeted source expansion

Reviewed on 14 November 2026 against the existing 31-source registry. This review prioritizes newly available experimental evidence, useful modeling, accessible original text, and provenance. It does not claim an exhaustive literature search or a popularity ranking: no verified citation-count comparison was performed.

## Recommended additions

| Official record | Publication date | Evidence | Contribution | Catalog relationship |
|---|---|---|---|---|
| [Heat and Smoke Emission from Tests on the Saffire VI Experiment](https://ntrs.nasa.gov/citations/20260001992) | July 2026 | Experimental conference paper | Seven long-duration orbital fire tests, with gas and aerosol monitoring under different atmospheres. The analysis concerns hazardous products and explains why a small temperature rise need not mean a small hazard. | Related to PSI-98/99/100 (Saffire I/II/III), **not direct results of those flights**. The title in NTRS says VI, while the abstract aggregates seven tests. Do not rename the paper or infer a single-flight dataset. |
| [The Effect of Pressure on Radiative Losses in Hot, Warm, and Cool Microgravity Spherical Diffusion Flames](https://ntrs.nasa.gov/citations/20260002014) | Online March 2026; journal issue May 2026 | Modeling compared with experiments | Examines radiative reabsorption and ambient pressure, helping explain transitions and extinction. Simulated burner-supported flames and experimental droplets are distinct configurations. | Direct relevance to PSI-39 Cool Flames Investigation. The [publisher's Experimental section](https://www.sciencedirect.com/science/article/abs/pii/S0010218026001203) explicitly identifies CFI droplet data. |
| [Computational Fluid Dynamics Analysis of Flame Dynamics in Partial Gravity Environments in a Rotating Centrifuge](https://ntrs.nasa.gov/citations/20260000641) | April 2026 | Validated computational study | Examines how centrifugal acceleration, Coriolis effects, and recirculation complicate interpretation of reduced-gravity flame tests. Useful for evaluating partial-gravity transferability. | No verified exact counterpart among the 17 existing combustion investigations. Keep as a thematic source rather than forcing a direct catalog link. |

All three official citation APIs return substantive abstracts and list NASA-hosted PDFs. DOI links for the two journal articles are [10.1016/j.combustflame.2026.114884](https://doi.org/10.1016/j.combustflame.2026.114884) and [10.1016/j.combustflame.2026.114808](https://doi.org/10.1016/j.combustflame.2026.114808). Full metadata and original abstract text were retrieved for implementation; the application should label their indexed coverage accurately.

## Additional useful checks

The [JAXA update dated 29 June 2026](https://humans-in-space.jaxa.jp/kibouser/pickout/74526.html) corroborates the already indexed wire/centrifuge article, DOI 10.1016/j.combustflame.2026.114800. It provides an accessible official explanation when the publisher restricts automated access, but it is **not a new independent experiment**. JAXA explains that artificial gravity produced in a rotating chamber and parabolic-flight gravity can yield different burning behavior even at similar acceleration magnitude. Its [16 September 2026 operations update](https://humans-in-space.jaxa.jp/kibouser/information/program/74583.html) reports preparations for resumed FLARE operations; this is operational status, not a published results dataset.

The [FY2026 SoFIE-GEL Task Book report](https://taskbook.nasaprs.com/tbp/index.cfm?TASKID=AB7D53A58994730B8E16F73F5BF545F7&action=public_query_taskbook_content) remains useful and is already in the registry. Its latest bibliography lists a 2026 conference contribution and a 2026 thesis on PMMA sphere growth. Do not count the project report, its bibliography, and the same conference summary as three independent experimental datasets.

## Rejected duplicates and misleading dates

NASA's CHORUS records [33762050316338](https://ntrs.nasa.gov/citations/33762050316338), [30616385703094](https://ntrs.nasa.gov/citations/30616385703094), and [20339522334248](https://ntrs.nasa.gov/citations/20339522334248) were distributed into NTRS on 13 November 2026. That is an **indexing date**, not a new research publication date. The underlying DOI articles are from 2022/2023/2021, respectively. Their citation APIs returned no abstract during this check. They were not recommended as newly published 2026 evidence.

Existing sources on Saffire VI modeling (20250002675), preliminary Saffire VI findings (20240002981), SoFIE extinction (20240007628), and SoFIE-GEL (REF-3 and REF-4) were recognized as duplicates and retained rather than added again. Rocket propulsion, terrestrial wildfire segmentation, and the unrelated meteorology/solar SOFIE acronym matches were excluded from the topic.

## Linking rule

Link a source to a catalog investigation as direct only if its actual text names that investigation or its exact data/configuration. Use a visibly labeled related-work link for a different Saffire flight, a broader program review, or a similar physics question. Leave genuinely new experiments without an exact catalog counterpart in the thematic source list. Matching the word "oxygen", "smoke", "CIR", or "microgravity" alone does not establish a direct study relationship.


## Implemented and verified

All three recommended sources were added to the curated registry and saved abstract index, bringing it to 34. The existing REF-7 now also links to the JAXA explanation. No new external search service was added to the application.

The [reviewed association manifest](research-source-links-2026-11-14.json) records 65 links from 24 sources to 16 investigations, with direct-study, program and related-work labels. Ten sources remain topic-only because an exact catalog counterpart was not verified. Exact BASS-II and CFI papers were also registered as publications. The live database now has 46 source registry rows, 253 publications and 593 searchable passages.

Verification covered source snapshots, valid PSI IDs, direct-versus-related publication boundaries, retrieval priority, a live full-text query for CFI radiative reabsorption, HTTP catalog/detail responses, source-page links and repeated synchronization without duplicates. Lint, TypeScript, production build and chat/comparison grounding smoke tests passed. Grounding smoke tests use a local model stub and the configured database through a read-only proxy; they do not establish real-model scientific accuracy.
