// Runs once when the server starts. Keeps the free Render instance from idling out by requesting
// its own public URL. It cannot wake an instance that is already asleep; .github/workflows/keepalive.yml
// covers that case from outside.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const base = process.env.RENDER_EXTERNAL_URL ?? process.env.PUBLIC_URL;
  if (!base) return;
  const ping = () => fetch(`${base}/api/health`, {cache: 'no-store'}).catch(() => {});
  setInterval(ping, 10 * 60 * 1000).unref();
}
