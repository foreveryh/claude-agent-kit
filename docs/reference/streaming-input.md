# Streaming Input Modes

> Source: Claude Agent SDK documentation – *Streaming Input*

This note captures the official guidance on the two input modes supported by the Claude Agent SDK and how they relate to our implementation.

## 1. Streaming Input Mode (default & recommended)

- **Behavior**: Run `query()` with an async generator/iterable. The session stays alive, accepts queued user messages (including images), surfaces tool permission prompts, and streams partial responses until completion or interruption.
- **Why it matters**: Unlocks all platform capabilities—image attachments, hooks, tool + MCP access, long-lived filesystem state, interruption control, and rich UX feedback.
- **Implementation pattern**: Yield user messages from an async generator (wait between yields if needed). Consume the SDK’s async iterator to render streamed messages/results. See doc sample pseudo:
  ```ts
  for await (const message of query({
    prompt: generateMessages(), // async generator
    options: { maxTurns: 10, allowedTools: ["Read", "Grep"] }
  })) { ... }
  ```
- **Mapping to our repo**: `@claude-agent-kit/server`’s `Session.send()` and `SessionManager` always operate in streaming mode; we queue prompts, maintain busy/loading state, and push streamed messages to WebSocket clients by default.

## 2. Single Message Input

- **Behavior**: Pass a literal prompt (string or single message) to `query()` per call. Can optionally resume by passing `continue: true` / `resume`. Suited for stateless workers (e.g., lambdas) needing only one response.
- **Limitations**: No direct image blocks, no hooks, no queued turns, no fine-grained interruption, limited multi-turn context (must manually manage session IDs).
- **Usage**: Call `query({ prompt: "…", options: { maxTurns: 1 } })` for each one-shot; re-use `continue/resume` if you must stitch turns.
- **Mapping to our repo**: We currently expose only the streaming pipeline. If we ever add a “fire-and-forget” HTTP endpoint, note that it won’t support tooling/images/hooks unless we switch that path to streaming.

## Operational guidance for our project

1. **Default to streaming** for WebSocket/chat flows (already true). Keep documenting that our handlers expect an async generator of messages.
2. **When building automations** (e.g., scheduled jobs) consider whether a lightweight single-message helper is desirable; document its trade-offs if added.
3. **Docs alignment**: Update README references (future work) to explicitly call out that our `Session` API is the streaming path, and link to this note for one-shot vs. streaming considerations.

## TODO / Deep Research

- Evaluate whether a “single message” helper adds value (e.g., an HTTP endpoint for one-off tasks). If we add it, we need to clarify limitations (no image blocks, no hooks) and reuse session resume logic carefully.
- Confirm whether our WebSocket handler should support streaming input with images directly (e.g., multi-part attachments) and document best practices for attachments in a future note.

Keeping this summary in `docs/reference/` lets us drop in other SDK excerpts (e.g., Skills, prompt customization) as we integrate more features.
