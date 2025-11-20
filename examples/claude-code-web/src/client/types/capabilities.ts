export type CapabilityPayload = {
  tools: string[]
  mcpServers: { name: string; status: string }[]
  slashCommands: string[]
  skills: string[]
  plugins: { name: string; path: string }[]
  model: string
  cwd: string | null
  permissionMode: string
  apiKeySource: string
  localSkills: LocalSkill[]
}

export type CapabilitySnapshot = CapabilityPayload & {
  fetchedAt: number
}

export type LocalSkill = {
  slug: string
  name: string
  description: string | null
  path: string
}
