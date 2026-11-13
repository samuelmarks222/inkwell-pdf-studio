# Inkwell — PDF Studio · online edition (Vercel)

Stateless, serverless build of Inkwell for Vercel's hobby tier. The browser holds
the PDF in memory; every operation ships the bytes to an isolated Python function
and gets the new bytes back. Nothing is stored — refresh the tab and it's gone.

## Layout

- `main.py` — Vercel FastAPI zero-config entrypoint; re-exports `api.index:app`.
- `api/index.py` — the FastAPI application (all `/api/*` routes).
- `api/fonts/` — byte-identical copy of the font pack, bundled next to the
  function so PDF embedding works regardless of `includeFiles` resolution.
- `public/` — static frontend (`index.html`, `app.js`, `style.css`) plus the
  122-file, 36-face open font pack under `public/fonts/` (see
  `public/fonts/FONTS.md` for the licensing matrix).
- `vercel.json` — only sets `functions.api/index.py.includeFiles` so the font
  pack is available to the function at runtime.

## Deploy

Deployed as the `inkwell-pdf-studio` Vercel project (framework preset `fastapi`,
region `iad1`). `public/` is served as static assets at `/`; the Python function
handles everything under `/api/` — the fastapi preset owns the routing, so
`vercel.json` intentionally has no rewrites. The app lives at
**https://inkwell-pdf-studio.vercel.app**.

Notes:

- The team-scoped aliases and deployment URLs sit behind Vercel Authentication;
  the plain `*.vercel.app` alias is public.
- Production deploys come from the `main` branch of
  `samuelmarks222/inkwell-pdf-studio`.

## Limits

- ~4 MB max PDF size (Vercel Hobby request-body cap of 4.5 MB)
- No accounts, no recents, no server-side persistence — by design
- Undo lives in browser memory for the session

For unlimited local use, grab the desktop edition instead.
