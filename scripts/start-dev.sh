#!/bin/bash
set -e

# Build and start the API server in the background
pnpm --filter @workspace/api-server run build
PORT=8000 NODE_ENV=development node --enable-source-maps artifacts/api-server/dist/index.mjs &
API_PID=$!

# Start the Vite dev server in the foreground (this is the webview)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/vaultchat run dev &
VITE_PID=$!

# Wait for either process to exit
wait -n $API_PID $VITE_PID
