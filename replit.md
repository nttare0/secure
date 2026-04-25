# Workspace

## Overview

VaultChat — a private, secure chat platform with accounts, multi-room chat, invite codes, and file/image attachments. Data is stored locally in SQLite.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Frontend**: React + Vite + Tailwind + shadcn/ui (artifact: `vaultchat`)
- **Backend**: Express 5 (artifact: `api-server`)
- **Database**: SQLite via `better-sqlite3` (file at `artifacts/api-server/data/vaultchat.db`)
- **Auth**: bcrypt password hashes + `express-session` with a custom SQLite-backed store; session id is regenerated on login/register to prevent session fixation
- **File uploads**: `multer` to `artifacts/api-server/data/uploads/` (10MB limit, access restricted to room members; filenames validated)
- **Validation**: `zod` schemas + `validateBody` middleware on every write route
- **Rate limiting**: `express-rate-limit` — 5/15min on login, 5/hr on register, 30/min on writes, 10/min on room actions, 120/min generally
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; secure cookie + 100kb body limit; `SESSION_SECRET` required from env in production
- **T&C**: `/terms` page on the web client; registration requires `acceptedTerms: true` (enforced server-side in `registerSchema`)
- **Admin**: `users` table has `is_admin` and `is_disabled` flags. On first server startup an admin is auto-seeded — username comes from `ADMIN_USERNAME` (default `admin`); password from `ADMIN_PASSWORD` if set, otherwise a random one is generated and written to `data/admin-credentials.txt`. Disabled accounts cannot log in. Admin endpoints live under `/api/admin/*` (list users, view a user's rooms/messages/DMs, disable/enable, delete user, delete a single message or DM). Admins cannot disable, delete, or demote each other. The web client exposes `/admin` (gated by `user.isAdmin`) with a sidebar shortcut.

## Responsive UI

- Sidebar is fixed-overlay on mobile (slides in from left, closes on selection or backdrop click) and a static 320px column from `md` and up
- Chat headers expose a hamburger toggle (`Menu`) on mobile via the `menuSlot` prop

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/vaultchat run dev` — run web client locally

## API

See `artifacts/vaultchat/API.md` for the full HTTP contract. Register requires `{ username, password, acceptedTerms: true }`.
