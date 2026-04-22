# Workspace

## Overview

VaultChat — a private, secure chat platform with accounts, multi-room chat, invite codes, and file/image attachments. Data is stored locally in SQLite.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Frontend**: React + Vite + Tailwind + shadcn/ui (artifact: `vaultchat`)
- **Backend**: Express 5 (artifact: `api-server`)
- **Database**: SQLite via `better-sqlite3` (file at `artifacts/api-server/data/vaultchat.db`)
- **Auth**: bcrypt password hashes + `express-session` with a custom SQLite-backed store
- **File uploads**: `multer` to `artifacts/api-server/data/uploads/` (10MB limit, access restricted to room members)

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/vaultchat run dev` — run web client locally

## API

See `artifacts/vaultchat/API.md` for the full HTTP contract.
