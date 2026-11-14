# Security and limits

## Keys

- `SUPABASE_SECRET_KEY`, `RADIUM_API_KEY`, `RADIUM_API_KEY_BACKUP` exist only as server environment variables (Render) and GitHub Actions secrets. They are never sent to the browser and never committed. `.env*` files are git-ignored.
- The database has row-level security enabled on every table and no policies. The publishable key can read nothing.

## Anonymous quotas

| Limit | Default | Variable |
|---|---|---|
| Messages per visitor per minute | 5 | `LIMIT_PER_MINUTE` |
| Messages per visitor per day | 30 | `LIMIT_PER_DAY` |
| Messages per network address per day | 90 | `LIMIT_PER_IP_DAY` |
| Messages for all visitors per day | 600 | `LIMIT_GLOBAL_PER_DAY` |
| Question length | 2,000 characters | `LIMIT_INPUT_CHARS` |
| Answer length | 1,200 tokens | `LIMIT_OUTPUT_TOKENS` |

When a limit is reached the assistant shows a message that the trial quota is used up; the Catalog and Analytics keep working. The per-address limit exists because a cookie can be cleared. The global limit caps spending. Every request is counted, including ones that fail midway.

## What is stored about visitors

A random id in an `HttpOnly` cookie, a salted SHA-256 hash of the network address (never the address), and per request: time, model, token counts. Message text is not stored.

## Other measures

- Request bodies are validated with zod; ids and filters are checked against strict patterns.
- All database access uses the Supabase client's parameterized queries.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.
- Prompt injection: retrieved text and user text are treated as data by the prompt, and the model has no tools, no network access and no secrets in its context.
- Model failures fall back to the backup key; errors shown to users carry no internal details.

## Known gaps

- Quotas are counted in Postgres, not in an in-memory store, so they add a few queries per message.
- There is no CAPTCHA. If abuse appears, lower `LIMIT_GLOBAL_PER_DAY` or add one.
