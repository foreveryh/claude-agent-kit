# Permissions Handling

> Source: Claude Agent SDK documentation – *Handling Permissions*

This note condenses the official permission controls into actionable guidance for our project. The SDK offers four complementary levers:

1. **Permission modes** – global behavior switches (`default`, `acceptEdits`, `bypassPermissions`, `plan`*). Mode affects the “fall through” stage after hooks/rules run.
2. **`canUseTool` callback** – runtime decision point once hooks + rules + mode can’t auto-accept or deny. Use it to surface approval prompts to users (e.g., UI modals).
3. **Hooks** – `PreToolUse`/`PostToolUse` handlers with complete visibility into tool inputs and outputs; can `allow`, `deny`, `ask`, or `continue` before the SDK evaluates rules.
4. **settings.json permission rules** – declarative allow/deny/ask policies (including bash command parsing) that run after hooks but before mode/callback.

*\* `plan` mode isn’t implemented in SDK transports yet (per upstream doc).*

## Permission Flow (summary)

```
Tool request
  → PreToolUse hook (can allow/deny/ask/continue)
  → Deny rules (settings.json)
  → Allow rules
  → Ask rules
  → Permission Mode check
      - bypassPermissions ⇒ auto-allow remaining tools
      - other modes ⇒ fall through
  → canUseTool callback
  → PostToolUse hook
```

- Deny rules always win—even in `bypassPermissions`.
- Hooks run before rule evaluation and after execution (post hook can inspect results).
- `acceptEdits` mode only auto-approves file edits & filesystem operations; other tools still run through the pipeline.
- `bypassPermissions` mode skips the `canUseTool` callback for any tool that survived hooks/rules.

## Mappings to our repo

- **Default options** (`packages/server/src/server/session.ts`): `permissionMode` isn’t explicitly surfaced; we should propagate the SDK’s default (“default”) and allow `setSDKOptions` callers to adjust it (UI already exposes a permission selector).
- **Hooks usage**: Example project (`examples/claude-code-v0/ccsdk/ai-client.ts`) demonstrates a `PreToolUse` hook to block writes outside `agent/custom_scripts/`. We can reference this sample in documentation.
- **`canUseTool`**: not yet implemented in our backend. If we need fine-grained approval flows (e.g., manual “Allow Bash command?” prompts), we should wire `Session` to accept a callback and forward decisions back to clients.
- **settings.json rules**: we currently rely on user/project configs stored in `.claude/settings.json` when `settingSources` include `user`/`project`. Mention this here so devs know SDK rule files still apply.

## TODO / Deep Research

1. **Expose `canUseTool` in our server** – Currently `Session` doesn’t surface a way for clients to approve/deny tools interactively. We should explore how to forward SDK callbacks through WebSocket events so UI can prompt users (requires design around concurrency and timeout handling).
2. **Permission mode UX** – The `claude-code-web` client stores a `permissionMode` in jotai state, but we should double-check the available modes vs. the SDK (e.g., `plan` not supported) and document which modes are functional.
3. **Publish settings.json guidance** – Our README doesn’t explain how `.claude/settings.json` rules interact with the server; writing a short section or linking to this doc would help devs reason about declarative allow/deny policies.

## Suggested doc updates

1. Extend the main README (or new `docs/reference/permissions.md`) with:
   - A “Permission Controls” section that points to this note.
   - Instructions for toggling permission mode via our UI (`examples/claude-code-web` sidebar uses jotai state).
   - Guidance on adding `canUseTool` once we expose it (roadmap item).
2. Add future work issue: expose `canUseTool` through `SessionManager` so WebSocket clients can drive approvals.

Keeping these notes in `docs/reference/` ensures we stay aligned with the upstream permission model as we add features like interactive approvals.
