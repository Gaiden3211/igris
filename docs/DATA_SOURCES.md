# Data sources

## Data

| Source | Publisher | Access | Used for |
|---|---|---|---|
| [Physical Sciences Informatics (PSI) repository](https://psi.nasa.gov/physci/repo/search?q=combustion) | NASA Biological and Physical Sciences | Open, no login | Investigation metadata, file inventories, publication lists |
| [NASA Technical Reports Server (NTRS) API](https://ntrs.nasa.gov/api/openapi/) | NASA STI Program | Open, no login | Related technical reports and abstracts |

Endpoints used by `scripts/ingest.ts`:

- `GET https://psi.nasa.gov/geode-py/ws/repo/search?source=psi&type=investigation&size=200&from=0`
- `GET https://psi.nasa.gov/geode-py/ws/repo/investigations/{PSI-ID}`
- `GET https://ntrs.nasa.gov/api/citations/search?q=...&page.size=5`

## References

All from the challenge's resource list:

- [Flame in Freefall challenge statement](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/): scope, reference scenarios, hardware groupings
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/)
- [A Researcher's Guide to International Space Station Combustion Science](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/)
- [Apollo 1](https://sma.nasa.gov/sma-disciplines/accllp/apollo-1), [Apollo 13](https://sma.nasa.gov/sma-disciplines/accllp/apollo-13), [Fire Aboard Space Station Mir](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/)
- Spinoff: [Fireman's Air Tanks](https://spinoff.nasa.gov/node/9582), [Fire Detector](https://spinoff.nasa.gov/node/9407), [New Technology for the Fire Attire](https://spinoff.nasa.gov/node/9918)

## Images

None yet. Every image added later gets a row in the `sources` table (`kind = 'image'`) with its original URL and credit, and appears on the Sources page.

## How the data is handled

- Values are stored as published. Empty or missing values stay empty; nothing is estimated.
- Each investigation keeps its full source record (`investigations.raw`) and a link to the original page.
- Reference scenarios (station cabin, lunar habitat or rover, spacesuit) use the figures given in the challenge statement.
- Hardware labels (CIR, MDCA, MSG…) are assigned from investigation acronyms following the groupings in the challenge statement.

## Known limitations

- The PSI API is not formally documented. The import reads fields tolerantly and reports anything it cannot map.
- A file listed in PSI can still fail to download. Igris lists files; it does not mirror them.
- NTRS reports are matched by acronym search, so a listed report may be related rather than produced by the investigation.
- Structured test conditions (oxygen, pressure, flow) are not present in PSI metadata. They have to be added from summary tables and papers; until then the conditions chart stays empty.
- PSI has no partial-gravity combustion data.
