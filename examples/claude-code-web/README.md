# Claude Agent Kit — Web Example (Express + Vite + ws)

A full-stack example that streams Claude Agent sessions over WebSockets using `@claude-agent-kit/server` and `@claude-agent-kit/websocket`, served via Express with a Vite-powered client.

## Features
- Express server with `ws` WebSocket bridge
- React client with reconnect + resume support
- Session lifecycle via `SessionManager`/`Session`
- Clean separation of server and client code

## Prerequisites
- Node.js 18+
- An Anthropic API key exported as `ANTHROPIC_API_KEY`

## Getting Started
```bash
pnpm install
export ANTHROPIC_API_KEY=your-key-here
cd examples/claude-code-web
pnpm dev
# open http://localhost:5173
```

Build for production:
```bash
pnpm build
pnpm preview
```

## Run with Docker
This example now ships with a multi-stage Dockerfile that builds the client + SSR bundle and starts the Express server in production mode.

```bash
# Build the image from the repo root
docker build -f examples/claude-code-web/Dockerfile -t claude-code-web .

# Run it (expose port 5173 and pass your Anthropic-compatible credentials)
docker run \
  -p 5173:5173 \
  -e ANTHROPIC_API_KEY=your-key \
  -e ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic \
  -e ANTHROPIC_MODEL=glm-4.6 \
  --name claude-code-web \
  claude-code-web

# visit http://localhost:5173
```

Environment variables:
- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_URL`, `ANTHROPIC_MODEL` (optional overrides for Claude-compatible endpoints)
- `PORT` (default `5173`)
- `WORKSPACE_DIR` (optional, defaults to `<project>/agent`; controls where skills/uploads are stored)

### Docker Compose workflow
Prefer using an env file? A ready-to-go `docker-compose.yml` is included.

```bash
cd examples/claude-code-web
cp .env.example .env   # edit values as needed
docker compose up --build
# stop later with:
docker compose down
```

## Server Wiring (simplified)
```ts
// src/server/server.ts
import { createServer as createHttpServer } from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'
import { SimpleClaudeAgentSDKClient } from '@claude-agent-kit/server'
import { WebSocketHandler } from '@claude-agent-kit/websocket'

export async function createServer() {
  const app = express()
  const httpServer = createHttpServer(app)
  const wss = new WebSocketServer({ server: httpServer })
  const sdkClient = new SimpleClaudeAgentSDKClient()
  const wsHandler = new WebSocketHandler(sdkClient, { thinkingLevel: 'default_on' })

  wss.on('connection', (ws) => {
    void wsHandler.onOpen(ws)
    ws.on('message', (data) => wsHandler.onMessage(ws, String(data)))
    ws.on('close', () => wsHandler.onClose(ws))
  })

  return { app, httpServer, wss }
}
```

## Client Usage (hook)
A robust browser hook with auto-reconnect and session resume is provided:
`src/client/hooks/use-web-socket.ts`.

Minimal usage:
```ts
import { useWebSocket } from './hooks/use-web-socket'

const { isConnected, sendMessage, setSDKOptions } = useWebSocket({
  url: 'ws://localhost:5173',
  onMessage: (payload) => console.log(payload),
})

// send a chat message
sendMessage({ type: 'chat', content: 'Hello Claude!' })

// update SDK options
setSDKOptions({ thinkingLevel: 'default_on' })
```

## WebSocket Payloads
Inbound messages:
- chat: `{ type: 'chat', content: string, attachments?: AttachmentPayload[] }`
- setSDKOptions: `{ type: 'setSDKOptions', options: Partial<SessionSDKOptions> }`
- resume: `{ type: 'resume', sessionId: string }`

Outbound messages:
- message_added: `{ type: 'message_added', sessionId, message }`
- messages_updated: `{ type: 'messages_updated', sessionId, messages }`
- session_state_changed: `{ type: 'session_state_changed', sessionId, sessionState }`

Errors are serialized as: `{ type: 'error', code?: string, error: string }`.

## Skill upload API
You can upload packaged skills at runtime by POSTing a `.zip` file to `/api/skills/upload`.

```
curl -F "file=@my-skill.zip" -F "name=my-skill" http://localhost:5173/api/skills/upload
```

The archive is extracted into `${WORKSPACE_DIR:-agent}/.claude/skills/<name>` inside the container (or developer machine). The directory becomes available to Claude Agent SDK on the next session.

## Customize
- Default SDK options: adjust when constructing `WebSocketHandler`.
- Client resume: include `{ type: 'resume', sessionId }` after reconnect to reload history.
- Message rendering: see `src/client/components` for mapping content blocks to UI.
