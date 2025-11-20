import fs from 'node:fs/promises'
import path from 'node:path'

import type { SDKMessage, SDKSystemMessage } from '@anthropic-ai/claude-agent-sdk'
import { AbortError } from '@anthropic-ai/claude-agent-sdk'
import type {
  IClaudeAgentSDKClient,
  SessionSDKOptions,
} from '@claude-agent-kit/server'

export type CapabilitySummary = {
  tools: string[]
  mcpServers: { name: string; status: string }[]
  slashCommands: string[]
  skills: string[]
  plugins: { name: string; path: string }[]
  model: string
  cwd: string | null
  permissionMode: string
  apiKeySource: string
  localSkills: LocalSkillInfo[]
}

export type LocalSkillInfo = {
  slug: string
  name: string
  description: string | null
  path: string
}

const CAPABILITY_PROMPT = 'claude-agent-sdk-capability-probe'

export async function collectCapabilitySummary(
  sdkClient: IClaudeAgentSDKClient,
  sessionOptions?: SessionSDKOptions,
  workspaceDir?: string,
): Promise<CapabilitySummary> {
  const abortController = new AbortController()
  const options = buildCapabilityOptions(sessionOptions, abortController)
  const stream = sdkClient.queryStream(CAPABILITY_PROMPT, options)

  let initMessage: SDKSystemMessage | null = null

  try {
    for await (const message of stream) {
      if (isInitMessage(message)) {
        initMessage = message
        abortController.abort()
        break
      }
    }
  } catch (error) {
    if (!initMessage && !isAbortError(error)) {
      throw error
    }
  } finally {
    abortController.abort()
  }

  if (!initMessage) {
    throw new Error('Claude Agent SDK did not emit an init message')
  }

  const localSkills = await collectLocalSkills(workspaceDir)

  return mapCapabilityMessage(initMessage, localSkills)
}

function buildCapabilityOptions(
  sessionOptions: SessionSDKOptions | undefined,
  abortController: AbortController,
) {
  const { thinkingLevel: _thinkingLevel, ...options } = sessionOptions ?? {}
  return {
    ...options,
    permissionMode: options.permissionMode ?? 'plan',
    maxTurns: 1,
    abortController,
  }
}

function isInitMessage(message: SDKMessage): message is SDKSystemMessage {
  return message.type === 'system' && message.subtype === 'init'
}

function isAbortError(error: unknown): boolean {
  if (!error) {
    return false
  }

  if (error instanceof AbortError) {
    return true
  }

  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }

  return false
}

function mapCapabilityMessage(
  message: SDKSystemMessage,
  localSkills: LocalSkillInfo[],
): CapabilitySummary {
  return {
    tools: [...(message.tools ?? [])],
    mcpServers: [...(message.mcp_servers ?? [])],
    slashCommands: [...(message.slash_commands ?? [])],
    skills: [...(message.skills ?? [])],
    plugins: [...(message.plugins ?? [])],
    model: message.model,
    cwd: message.cwd ?? null,
    permissionMode: message.permissionMode,
    apiKeySource: message.apiKeySource,
    localSkills,
  }
}

async function collectLocalSkills(workspaceDir?: string): Promise<LocalSkillInfo[]> {
  if (!workspaceDir) {
    return []
  }

  const skillRoot = path.join(workspaceDir, '.claude', 'skills')
  let entries: Awaited<ReturnType<typeof fs.readdir>> = []
  try {
    entries = await fs.readdir(skillRoot, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return []
    }
    console.warn('Failed to read local skills directory:', error)
    return []
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const skillPath = path.join(skillRoot, entry.name)
        return parseSkillMetadata(skillPath, entry.name)
      }),
  )

  return skills.filter((skill): skill is LocalSkillInfo => Boolean(skill))
}

async function parseSkillMetadata(
  skillPath: string,
  fallbackName: string,
): Promise<LocalSkillInfo | null> {
  const manifestPath = path.join(skillPath, 'SKILL.md')
  let content: string
  try {
    content = await fs.readFile(manifestPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`Failed to read SKILL.md for ${skillPath}:`, error)
    }
    return null
  }

  const { name, description } = extractSkillMetadata(content, fallbackName)
  return {
    slug: fallbackName,
    name,
    description,
    path: skillPath,
  }
}

function extractSkillMetadata(content: string, fallbackName: string) {
  const lines = content.split(/\r?\n/)
  const headingLineIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()))
  const name = headingLineIndex >= 0
    ? lines[headingLineIndex].replace(/^#\s+/, '').trim() || fallbackName
    : fallbackName

  let description: string | null = null
  for (let index = headingLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim()
    if (!line) {
      continue
    }
    if (line.startsWith('#')) {
      break
    }
    description = line
    break
  }

  return { name, description }
}
