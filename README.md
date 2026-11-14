# Igris

Search, compare and understand microgravity research investigations, with an assistant that cites every source.

Built for the NASA Space Apps Challenge 2026, challenge **Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data**. Combustion science is the first research area; the data model is not tied to it (see [Architecture](docs/ARCHITECTURE.md#research-areas-are-data)).

Igris is an independent project. It is not affiliated with or endorsed by NASA or any space agency.

## What it does

| Page | Purpose |
|---|---|
| **Assistant** | Ask a question in English or Ukrainian. The answer is written only from retrieved records and each statement links to its source. |
| **Catalog** | Full-text search, filters (topic, hardware, data availability) and sorting over every investigation. |
| **Investigation** | Objective, hypothesis, approach, conditions, files, publications and related work for one record. |
| **Analytics** | Charts of the data set: by year, topic and hardware, plus tested oxygen and pressure against reference scenarios. |
| **Sources & AI** | Every data source and reference, and a plain statement of how AI is used. |

Light and dark themes, an optional background glow, English and Ukrainian interface, desktop and mobile layouts.

## Stack

- **Next.js 16** (App Router, TypeScript): UI and API in one service
- **Astryx** design system (`@astryxdesign/core`, `@astryxdesign/charts`, canary channel)
- **Supabase** (Postgres): data, full-text search, usage log
- **Radium** API (OpenAI-compatible) for the assistant, with a backup key
- **Render** free web service for hosting

## Quick start

```bash
git clone https://github.com/Gaiden3211/igris.git && cd igris
npm ci
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

The app starts without any keys: pages render and show "not connected" states until the database and the model are configured.

Load the data once the database is set up:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run ingest
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): how the parts fit, request flow, database schema
- [Assistant](docs/AGENT.md): master prompt, retrieval skills, guardrails
- [Security and limits](docs/SECURITY.md): quotas, keys, what is stored about visitors
- [Deployment](docs/DEPLOYMENT.md): Supabase, Render, keep-alive, data import
- [Data sources](docs/DATA_SOURCES.md): every source, endpoint and known limitation
- [Use of AI](docs/AI_USE.md): AI in the product and in building it
- [Presentation plan](docs/PRESENTATION.md): the 7-slide demo

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run ingest` | Import PSI and NTRS data into Supabase (`-- --dry` to preview) |

## License

MIT. See [LICENSE](LICENSE). Data belongs to its publishers; see [Data sources](docs/DATA_SOURCES.md).
