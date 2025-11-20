# Session Management

> Source: Claude Agent SDK documentation – *Session Management*

Key points from the official guide and how they map to our implementation.

## Tracking session IDs

- The SDK’s first system message for any `query()` call includes `subtype: "init"` and `session_id`.
- Capture that ID if you want to resume later. In our server, `Session.processIncomingMessage()` already calls `updateSessionId()` when it sees one, and `SessionManager` stores it per client.
- When building clients, surface the session ID (e.g., `examples/claude-code-web` lets users switch sessions by ID).

## Resuming sessions

- Pass `options.resume = "<sessionId>"` to continue an existing conversation. Our `Session.send()` does this automatically whenever `sessionId` is set, so multi-turn chats keep context without extra work.
- `Session.resumeFrom()` loads prior messages via `sdkClient.loadMessages()` whenever a WebSocket client reconnects or explicitly calls `type: "resume"`.
- Reminder: we rely on local `.claude/projects/<id>.jsonl` files to load transcripts. If they’re missing, resume will return an empty history (document that for devs).

## Forking sessions

- The SDK supports `forkSession: true` (TypeScript) / `fork_session: true` (Python) to branch from a prior session while keeping the original intact.
- **Current status**: Our `Session` doesn’t expose that option yet. We always send `options.resume = this.sessionId` for multi-turn interactions, meaning we continue the original session.
- TODO: Decide whether we need forking support (e.g., for “try alternate approach” flows). Implementation would look like:
  - Add a `forkSession` flag to `SessionSDKOptions`.
  - Allow clients to request forking (new WebSocket message type or part of `setSDKOptions`).
  - When set, pass `forkSession: true` to the SDK once and update `sessionId` to the returned forked ID.

## Operational notes

- `SessionManager.getSession(sessionId, shouldLoadMessages=true)` already calls `resumeFrom` to hydrate state when a client targets a specific session.
- We should document that session files live under `~/.claude/projects/<projectName>/<sessionId>.jsonl` (see `packages/server/src/utils/session-files.ts`) so devs can backup/restore conversations.
- Consider exposing session metadata (last modified, summary, etc.) via an API endpoint so UIs can list resumable sessions without reading files directly.

## TODO / Deep Research

1. **Forking UX** – Decide if the Web UI should offer a “Fork session” action. Requires understanding how users expect branch IDs to appear and whether to track parent-child relationships.
2. **Session cleanup** – Document how/when to prune old `.claude/projects` files. Maybe add a CLI command in this repo to list/remove idle sessions.
3. **Cross-device resume** – Evaluate whether syncing `.claude` state (e.g., via cloud storage) is feasible for shared environments and what implications that has for our loader.
