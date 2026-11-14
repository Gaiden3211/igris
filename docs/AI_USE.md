# Use of AI

## In the product

- **What**: the assistant uses a large language model through the Radium API (model set by `RADIUM_MODEL`, default `tycho-1.0`).
- **How**: it plans database searches from the user's question and writes an answer from the retrieved records only. Each statement carries a citation that links to the source.
- **Not AI**: the catalog, filters, sorting and charts are plain database queries.
- **Labels**: every answer is marked as AI-generated. Values extracted by a model are marked "extracted automatically".

## In building the project

- Code, database schema, documentation and this presentation plan were written with Claude (Anthropic) under the team's direction and review.
- No AI-generated images or video are used. No NASA logos or mission identifiers appear in generated content.

## Data

All research data comes from the open sources listed in [DATA_SOURCES.md](DATA_SOURCES.md). No AI-generated data is presented as source data.
