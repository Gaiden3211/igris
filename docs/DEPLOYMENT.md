# Deployment

## 1. Supabase

The project `aeycforegdtnshjszpdg` (region eu-central-1) already has the schema applied. For a fresh project, run the files in `supabase/migrations/` in order in the SQL editor.

From **Project Settings → API** copy the project URL and the **secret** key.

## 2. Render

1. New → Blueprint → pick this repository. Render reads [`render.yaml`](../render.yaml) (free plan, Frankfurt, health check `/api/health`).
2. Fill in the variables it asks for: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RADIUM_API_KEY`, `RADIUM_API_KEY_BACKUP`.
3. Deploy. Every push to the default branch redeploys.

Check `https://<your-app>.onrender.com/api/health`: `database` and `assistant` should both be `ok`.

## 3. Keep the service awake

A free Render service stops after 15 minutes without requests and takes about a minute to start again. Two mechanisms prevent that:

- `src/instrumentation.ts` requests the app's own public URL every 10 minutes while it is running.
- `.github/workflows/keepalive.yml` pings it from outside every 10 minutes, which also wakes it if it did stop. Set the repository **variable** `APP_URL` to the app URL (Settings → Secrets and variables → Actions → Variables).

The same ping touches the database, which keeps the free Supabase project from pausing after a week of inactivity. GitHub may delay scheduled workflows by several minutes; open the site a few minutes before a demo.

## 4. Import the data

Add repository **secrets** `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then run **Actions → Import data → Run workflow**. Tick "dry run" first to preview without writing.

Or locally:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run ingest
```

The import takes a few minutes, is safe to re-run, and replaces each investigation's files, publications and passages.

## Environment variables

See [`.env.example`](../.env.example).
