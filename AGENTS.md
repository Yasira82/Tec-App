# AGENTS.md

## Cursor Cloud specific instructions

This repo is effectively a single product: the **TEC Hub** Next.js 15 frontend in `tec-frontend/`.
The backend microservices described in `README.md` were removed — all server calls go to an
external API gateway (`API_GATEWAY_URL`). There is no local database to run; `prisma/` is legacy.

It is an **npm workspaces** monorepo: the only tracked lockfile is the root `package-lock.json`,
and dependencies hoist into the root `node_modules/`. Install from the repo root, not per-package.

### Standard commands (run from `tec-frontend/`)
Scripts live in `tec-frontend/package.json`; root `package.json` proxies them via workspaces:
- Lint: `npm run lint` — passes with only `no-img-element` warnings.
- Typecheck: `npm run typecheck` (run `rm -f tsconfig.tsbuildinfo` first if stale).
- Unit tests: `npm test` (Vitest, ~2000 tests; Pi SDK is mocked, no network needed).
- Build: `npm run build` (Next.js webpack production build — works).
- E2E: `npm run test:e2e` (Playwright; needs `npx playwright install chromium` first, and
  builds + serves via `npm run start`).

### Running the dev server (non-obvious caveats)
- Use Turbopack: `cd tec-frontend && npx next dev --turbopack`.
  Plain `next dev` (webpack) **crashes** because `next.config.js` sets
  `optimization.usedExports`, which conflicts with Next dev's `cacheUnaffected`
  (`optimization.usedExports can't be used with cacheUnaffected`). The production
  `npm run build` is unaffected and works normally.
- The `@yasser172/tec-sdk` logger loads the `pino-pretty` transport when
  `NODE_ENV=development` (which `next dev` forces). `pino-pretty` is therefore a dev
  dependency in `tec-frontend`. Under Turbopack you'll still see a non-fatal
  `thread-stream/lib/worker.js` / "worker thread exited" `uncaughtException` in the logs
  (Turbopack remaps cwd to `/ROOT`); it does **not** break SSR — pages still return 200.
- `/`, `/ai`, `/pi-test`, `/privacy`, `/terms` render without auth. `/hub/*`, `/dashboard/*`,
  and `/login` return 307 redirects from the auth middleware when there is no Pi session.
  Full Pi auth/payment flows only work inside the Pi Browser, so they can't be exercised here.

### Environment
Copy `.env.example` to `tec-frontend/.env.local` (gitignored). Keep
`NEXT_PUBLIC_PI_SANDBOX=true` for local/dev; the build throws if it's not `false` on Vercel.
