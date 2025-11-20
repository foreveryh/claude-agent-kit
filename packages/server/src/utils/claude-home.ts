import os from "node:os";
import path from "node:path";

export interface ResolveClaudeHomeOptions {
  cwd?: string | null | undefined;
}

function normalizeDirPath(value?: string | null): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }
  return path.resolve(trimmed);
}

function getSystemHomeDir(): string | null {
  const bunHome =
    (typeof globalThis !== "undefined"
      ? (globalThis as { Bun?: { env?: Record<string, string | undefined> } }).Bun?.env?.HOME
      : undefined) ?? null;
  const envHome =
    bunHome ??
    (typeof process !== "undefined" ? process.env?.HOME ?? process.env?.USERPROFILE : undefined) ??
    (typeof os.homedir === "function" ? os.homedir() : undefined);

  return normalizeDirPath(envHome ?? null);
}

/**
 * Resolves the root directory that should contain `.claude` artifacts.
 * Prefers explicit overrides, then workspace/cwd hints, and finally falls back to the OS home dir.
 */
export function resolveClaudeHomeDir(options?: ResolveClaudeHomeOptions): string | null {
  const envOverride =
    normalizeDirPath(process.env.CLAUDE_HOME) ?? normalizeDirPath(process.env.CLAUDE_AGENT_HOME);
  if (envOverride) {
    return envOverride;
  }

  const cwdDir = normalizeDirPath(options?.cwd ?? null);
  if (cwdDir) {
    return cwdDir;
  }

  const workspaceEnv = normalizeDirPath(process.env.WORKSPACE_DIR ?? null);
  if (workspaceEnv) {
    return workspaceEnv;
  }

  return getSystemHomeDir();
}
