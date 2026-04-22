# VaultChat API

All endpoints under `/api`. Auth via session cookie (set automatically on login/register). All requests should include `credentials: "include"`.

## Auth
- `POST /api/auth/register` body `{username, password}` -> `{user: {id, username}}`. Auto-logs in.
- `POST /api/auth/login` body `{username, password}` -> `{user: {id, username}}`.
- `POST /api/auth/logout` -> `{ok: true}`
- `GET /api/auth/me` -> `{user: {id, username}}` or 401

## Rooms
- `GET /api/rooms` -> `[{id, name, code, isOwner, memberCount, lastMessageAt}]`
- `POST /api/rooms` body `{name}` -> `{id, name, code, isOwner: true}`
- `POST /api/rooms/join` body `{code}` -> `{id, name, code, isOwner: false}`
- `POST /api/rooms/:id/leave` -> `{ok: true}`
- `DELETE /api/rooms/:id` (owner only) -> `{ok: true}`
- `GET /api/rooms/:id/members` -> `[{id, username}]`

## Messages
- `GET /api/rooms/:id/messages?before=<msgId>&limit=50` -> `[{id, userId, username, content, attachment: {filename, originalName, mimeType, size} | null, createdAt}]` (newest first)
- `POST /api/rooms/:id/messages` multipart/form-data fields: `content` (string, optional), `file` (binary, optional, max 10MB). At least one required. Returns the created message.

## Files
- `GET /api/uploads/:filename` — returns the file with proper headers. Requires session and membership in a room that contains the file.

## Errors
All errors return `{error: "message"}` with 4xx/5xx status.

## Notes for frontend
- Use `import.meta.env.BASE_URL` (which is `/`) prepended; e.g. `${import.meta.env.BASE_URL}api/auth/me`.
- Always pass `credentials: "include"` on fetch.
- Poll `GET /api/rooms/:id/messages` every 2s for new messages (no websockets).
- Show invite codes prominently so users can share them.

## Direct Messages (DMs)
- `GET /api/dms` — list active conversations: `[{ userId, username, lastMessageAt, lastMessage }]`
- `GET /api/dms/users/search?q=foo` — search users (returns `[{ id, username }]`, max 10)
- `GET /api/dms/:userId/messages?limit=50&before=ID` — `{ peer: { id, username }, messages: Message[] }`
- `POST /api/dms/:userId/messages` — multipart, fields `content` and optional `file` (10MB max)

## Auto-created starter room
- On `POST /api/auth/register`, a personal room named `"<username>'s Room"` is auto-created with a unique invite code, and the new user is added as owner/member.
