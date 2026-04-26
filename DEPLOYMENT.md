# Deploying VaultChat

VaultChat is a stateful chat app with three runtime needs that affect how it must be deployed:

1. **SQLite database** stored on disk at `artifacts/api-server/data/vaultchat.db`
2. **WebSocket realtime** (chat + WebRTC call signaling) at `/api/realtime`
3. **In-memory subscriber map** for routing events to connected users

These all require a single, always-on instance with persistent disk. **Autoscale and serverless platforms (Vercel, Netlify, Cloudflare Workers) will not work** — they tear instances down between requests, lose WebSocket connections, and wipe the SQLite file.

## Recommended: Replit Deployments (VM)

1. Click **Publish** in the workspace.
2. In **Advanced**, set the deployment type to **Reserved VM** (not Autoscale).
3. Set the required secret:
   - `SESSION_SECRET` — a long random string (the server refuses to start in production without it).
4. Publish.

The two artifacts (`api-server` on `/api/*` and `vaultchat` on `/`) are already configured in their `artifact.toml` files and will be built and routed automatically.

## Alternative: Single-process self-hosting (Railway, Render, Fly.io, VPS)

The Express server can serve the built React app statically. Build steps:

```bash
pnpm install
pnpm --filter @workspace/vaultchat run build   # outputs artifacts/vaultchat/dist/public
pnpm --filter @workspace/api-server run build  # outputs artifacts/api-server/dist/index.mjs
```

Run with:

```bash
PORT=8080 SESSION_SECRET=<long-random> NODE_ENV=production \
  node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Mount a persistent volume at `artifacts/api-server/data/` so the SQLite file and uploaded attachments survive restarts.

## Calls and NAT traversal

In-browser audio/video calls use WebRTC peer-to-peer. The app currently relies only on Google's public STUN server. Calls between users on restrictive networks (corporate NAT, mobile carrier-grade NAT) may fail without a TURN server. To support those cases, add a TURN service (e.g. coturn, Twilio Network Traversal, Cloudflare TURN) and pass its credentials into `RTCPeerConnection` config in `artifacts/vaultchat/src/hooks/use-call.ts`.
