export type Project = {
  id: string
  name: string
  path: string
}

export type ProjectWithActivity = Project & {
  latestActivity: number | null
}

export type SessionSummary = {
  id: string
  prompt: string
  firstMessageAt: number
  lastMessageAt: number
}

export type SessionSelectPayload = {
  sessionId: string
  projectId: string
}

import type { CapabilitySnapshot } from '@/types/capabilities'

export type LeftSidebarProps = {
  selectedSessionId?: string | null
  onSessionSelect?: (payload: SessionSelectPayload) => void
  onProjectChange?: (projectId: string | null) => void
  onNewSession?: (projectId: string) => void
  capabilities?: CapabilitySnapshot | null
  isLoadingCapabilities?: boolean
  capabilitiesError?: string | null
  onRefreshCapabilities?: () => void | Promise<void>
}
