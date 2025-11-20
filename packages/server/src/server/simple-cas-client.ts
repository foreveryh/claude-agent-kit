import { promises as fs } from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  Options as SDKOptions,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { IClaudeAgentSDKClient } from "../types";
import { 
  getProjectsRoot, 
  locateSessionFile, 
  normalizeSessionId, 
  readSessionMessages as readSessionMessagesFromDisk 
} from "../utils/session-files";
import { resolveClaudeHomeDir } from "../utils/claude-home";
// import { AGENT_PROMPT } from "./agent-prompt";

export { parseSessionMessagesFromJsonl, readSessionMessages } from "../utils/session-files";

export interface SimpleClientConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  executable?: SDKOptions["executable"];
  executableArgs?: SDKOptions["executableArgs"];
}

export class SimpleClaudeAgentSDKClient implements IClaudeAgentSDKClient {
  private config: SimpleClientConfig;

  constructor(config: SimpleClientConfig = {}) {
    this.config = config;
  }

  async *queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<SDKOptions>
  ): AsyncIterable<SDKMessage> {
    // Build custom environment variables from config
    const customEnv: Record<string, string | undefined> = {};

    if (this.config.apiKey) {
      customEnv.ANTHROPIC_API_KEY = this.config.apiKey;
    }
    if (this.config.baseURL) {
      customEnv.ANTHROPIC_BASE_URL = this.config.baseURL;
      customEnv.ANTHROPIC_API_URL = this.config.baseURL;
    }
    if (this.config.model) {
      customEnv.ANTHROPIC_MODEL = this.config.model;
    }

    const claudeHome = resolveClaudeHomeDir({ cwd: options?.cwd });
    if (claudeHome) {
      try {
        await ensureClaudeDirectories(claudeHome);
        if (!customEnv.HOME) {
          customEnv.HOME = claudeHome;
        }
        if (process.platform === "win32" && !customEnv.USERPROFILE) {
          customEnv.USERPROFILE = claudeHome;
        }
      } catch (error) {
        console.warn(`[SimpleClaudeAgentSDKClient] Failed to prepare Claude home at ${claudeHome}:`, error);
      }
    }

    // Merge with existing options and add custom environment
    const baseEnv = options?.env ?? process.env ?? {};
    const mergedOptions: Partial<SDKOptions> = {
      ...options,
      env: {
        ...baseEnv,
        ...customEnv,
      },
    };

    if (!mergedOptions.executable && this.config.executable) {
      mergedOptions.executable = this.config.executable;
    }

    if (!mergedOptions.executableArgs && this.config.executableArgs) {
      mergedOptions.executableArgs = this.config.executableArgs;
    }

    for await (const message of query({
      prompt,
      options: mergedOptions
    })) {
      yield message;
    }
  }

  async loadMessages(sessionId: string | undefined): Promise<{ messages: SDKMessage[] }> {
    if (!sessionId) {
      return { messages: [] };
    }

    const projectsRoot = getProjectsRoot();
    if (!projectsRoot) {
      return { messages: [] };
    }

    const normalizedSessionId = normalizeSessionId(sessionId);

    let filePath: string | null;
    try {
      filePath = await locateSessionFile({
        projectsRoot,
        sessionId: normalizedSessionId,
      });
    } catch (error) {
      console.error(`Failed to locate session '${normalizedSessionId}':`, error);
      return { messages: [] };
    }

    if (!filePath) {
      return { messages: [] };
    }

    try {
      const messages = await readSessionMessagesFromDisk(filePath);
      return { messages };
    } catch (error) {
      console.error(`Failed to read session file '${filePath}':`, error);
      return { messages: [] };
    }
  }
}

async function ensureClaudeDirectories(homeDir: string): Promise<void> {
  await fs.mkdir(homeDir, { recursive: true });
  await fs.mkdir(path.join(homeDir, ".claude"), { recursive: true });
}
