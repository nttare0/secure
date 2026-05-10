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

## Realtime, Profiles, Wallpapers, Voice

- **WebSocket realtime**: `ws` server attached at `/api/realtime` (lib/realtime.ts), authenticated via the existing `vc.sid` session cookie through SqliteStore. Events broadcast: `presence:update`, `room:message:new|update|delete`, `dm:message:new|update|delete`, `user:profile`, and client→server `typing` (relayed to room members or DM peer with a 4s TTL). Existing 2s polling is retained as a safety net.
- **Login lockout**: 5 failed logins in a sliding window triggers a 3-minute lockout (`lib/login-lockout.ts`); `/login` returns `429 { error, lockedUntil, retryAfterMs }` when locked, or `401 { error, attemptsLeft }` while still under the threshold. The login page surfaces a live countdown that re-enables the form when it elapses.
- **Profile pictures**: `users.avatar_kind` (`initials`|`preset`|`anime`|`image`) and `users.avatar_value`. 16 emoji-gradient presets (`vaultchat/src/lib/avatars.ts`) + 10 anime characters from Naruto/Dragon Ball/Demon Slayer (`vaultchat/src/lib/anime-avatars.ts`, PNGs in `vaultchat/public/avatars/`) + custom uploads (POST `/api/users/me/avatar`, multer 4MB, served via `/api/uploads/avatar-*`). Old uploaded avatar files are deleted when replaced. Settings dialog → Profile tab; saved via `PATCH /api/users/me`. Avatar uploads bypass the room/DM membership check on the uploads route.
- **Account settings**: Settings dialog → Account tab shows username/ID/role/joined date and a Change-password form (POST `/api/users/me/password` verifies current via bcrypt before updating).
- **Wallpapers**: 15 presets stored in `vaultchat/public/wallpapers/`, registered in `vaultchat/src/lib/wallpapers.ts`. Saved per-user via `users.wallpaper_id`. Applied as `bg-cover bg-center` on the chat `<main>` with a soft top→bottom gradient overlay (`bg-background/30→/40` light, `/40→/55` dark) so the chosen image stays clearly visible behind messages. Selectable from Settings dialog → Wallpaper tab; "None" clears it.
- **Sidebar extras**: Direct tab shows a live online-friends count badge; Rooms list shows member count with a small users icon next to each room.
- **Admin console**: Rebuilt `/admin` with three tabs — Overview (live workspace stats card grid auto-refreshing every 30s, GET `/api/admin/stats`), Users (search + filter chips for All/Online/Admins/Disabled, per-user actions: disable/enable, promote/demote with last-admin protection, reset password via dialog using `/api/admin/users/:id/reset-password`, delete account, plus the existing message/DM moderation), and Rooms (table view with member/message counts, owner, last activity; delete via `/api/admin/rooms/:id`). User list/detail render real avatars with online dots.
- **Voice notes**: `MediaRecorder` (audio/webm;opus) capped at 5 minutes with a live RMS level meter (`vaultchat/src/components/chat/voice-recorder.tsx`). Sent through the existing message file-upload route; the existing `FileViewer` plays them back as audio.

## AI Chat (VaultBot)

- **Sidebar entry**: "VaultBot AI" button with a sparkle icon appears above the action buttons in the sidebar for all logged-in users.
- **Frontend**: `vaultchat/src/components/chat/ai-chat.tsx` — self-contained chat UI with local message state (conversations not persisted to DB), typing indicator, suggestion chips, and a clear-conversation button.
- **Backend**: `POST /api/ai/chat` (`api-server/src/routes/ai.ts`) — requires auth, accepts `{ message, history[] }`, calls Google Gemini (`gemini-2.5-flash`), returns `{ reply }`.
- **API key**: `AIzaSyCd7PUj7hlwwyQ9ggv1y9I9lq2hYirKfqQ` embedded in `ai.ts` (can be overridden via `GEMINI_API_KEY` env var).
- **Rate limiting**: Uses the existing `writeLimiter` (30 req/min per user).

## API

See `artifacts/vaultchat/API.md` for the full HTTP contract. Register requires `{ username, password, acceptedTerms: true }`.
