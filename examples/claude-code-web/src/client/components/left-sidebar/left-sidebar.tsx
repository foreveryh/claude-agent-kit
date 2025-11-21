import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRoute } from '@/hooks/use-route'
import { buildProjectPath, buildSessionPath, navigateTo } from '@/lib/route'

import {
  LeftSidebarProps,
  Project,
  ProjectWithActivity,
  SessionSummary,
} from './types'
import { ProjectPicker } from './project-picker'
import { SessionList } from './session-list'
import { SidebarHeader } from './sidebar-header'
import { computeLatestActivity, isAbortError } from './utils'
import { CapabilitiesPanel } from './capabilities-panel'

const PROJECTS_ENDPOINT = '/api/projects'

export function LeftSidebar({
  selectedSessionId,
  onSessionSelect,
  onProjectChange,
  onNewSession,
  onCreateProject,
  capabilities,
  isLoadingCapabilities,
  capabilitiesError,
  onRefreshCapabilities,
  onDeleteProject,
}: LeftSidebarProps) {
  const { projectId: routeProjectId, sessionId: routeSessionId } = useRoute()

  const [projects, setProjects] = useState<ProjectWithActivity[]>([])
  const [projectSessions, setProjectSessions] = useState<
    Record<string, SessionSummary[]>
  >({})
  const [projectsReloadToken, setProjectsReloadToken] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)
  const [isNewSessionPending, setIsNewSessionPending] = useState(false)

  const applySessionsUpdate = useCallback(
    (targetProjectId: string, sessions: SessionSummary[]) => {
      setProjectSessions((prev) => ({
        ...prev,
        [targetProjectId]: sessions,
      }))

      setProjects((prev) =>
        prev.map((project) =>
          project.id === targetProjectId
            ? { ...project, latestActivity: computeLatestActivity(sessions) }
            : project,
        ),
      )
    },
    [setProjectSessions, setProjects],
  )

  const refreshSessionsForProject = useCallback(
    async (targetProjectId: string) => {
      try {
        const sessions = await fetchProjectSessions(targetProjectId)
        applySessionsUpdate(targetProjectId, sessions)
        setErrorMessage(null)
      } catch (error) {
        console.error('Failed to refresh sessions:', error)
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load sessions.',
        )
      }
    },
    [applySessionsUpdate],
  )

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    async function loadProjectsAndSessions() {
      setIsLoadingProjects(true)
      setErrorMessage(null)

      try {
        const projectsResponse = await fetch(PROJECTS_ENDPOINT, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!projectsResponse.ok) {
          throw new Error(
            `Failed to load projects (status ${projectsResponse.status})`,
          )
        }

        const body = (await projectsResponse.json()) as {
          projects?: Project[]
        }
        const fetchedProjects: Project[] = Array.isArray(body?.projects)
          ? body.projects
          : []

        if (!isMounted) {
          return
        }

        if (fetchedProjects.length === 0) {
          setProjects([])
          setProjectSessions({})
          setSelectedProjectId(null)
          setHasLoadedInitialData(true)
          return
        }

        // Initialize projects without activity first
        const nextProjects: ProjectWithActivity[] = fetchedProjects.map(
          (project) => ({
            ...project,
            latestActivity: null,
          }),
        )

        setProjects(nextProjects)
        setHasLoadedInitialData(true)
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        console.error(error)
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load projects.',
          )
          setProjects([])
          setProjectSessions({})
          setSelectedProjectId(null)
          setHasLoadedInitialData(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          if (isMounted) {
            setIsLoadingProjects(false)
          }
        }
      }
    }

    void loadProjectsAndSessions()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [projectsReloadToken])

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return
    }
    if (!selectedSessionId) {
      return
    }
    if (projects.length > 0) {
      return
    }

    setProjectsReloadToken((token) => token + 1)
  }, [hasLoadedInitialData, selectedSessionId, projects.length])

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return
    }

    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null)
      }
      return
    }

    const projectIds = new Set(projects.map((project) => project.id))

    if (routeProjectId && projectIds.has(routeProjectId)) {
      if (selectedProjectId !== routeProjectId) {
        setSelectedProjectId(routeProjectId)
      }
      return
    }

    const fallbackProjectId = projects[0]?.id ?? null
    if (!fallbackProjectId) {
      return
    }

    if (selectedProjectId !== fallbackProjectId) {
      setSelectedProjectId(fallbackProjectId)
    }

    if (routeProjectId !== fallbackProjectId) {
      navigateTo(buildProjectPath(fallbackProjectId), {
        replace: !routeProjectId,
      })
    }
  }, [hasLoadedInitialData, projects, routeProjectId, selectedProjectId])

  const currentProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return
    }

    onProjectChange?.(currentProject)
  }, [currentProject, onProjectChange, hasLoadedInitialData])

  useEffect(() => {
    const projectId = selectedProjectId
    if (!projectId) {
      return
    }

    if (projectSessions[projectId]) {
      return
    }

    const controller = new AbortController()
    let isMounted = true

    async function loadSessions(targetProjectId: string) {
      setIsLoadingSessions(true)
      setErrorMessage(null)

      try {
        const sessions = await fetchProjectSessions(
          targetProjectId,
          controller.signal,
        )

        if (!isMounted) {
          return
        }

        applySessionsUpdate(targetProjectId, sessions)
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        console.error(error)
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load sessions.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessions(false)
        }
      }
    }

    void loadSessions(projectId)

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [projectSessions, selectedProjectId, applySessionsUpdate])



  const currentSessions = selectedProjectId
    ? projectSessions[selectedProjectId] ?? []
    : []

  const derivedSessionId = useMemo(() => {
    if (!currentSessions || currentSessions.length === 0) {
      return null
    }

    if (
      routeSessionId &&
      currentSessions.some((session) => session.id === routeSessionId)
    ) {
      return routeSessionId
    }

    return currentSessions[0]?.id ?? null
  }, [currentSessions, routeSessionId])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    if (!derivedSessionId) {
      return
    }

    if (isNewSessionPending && !routeSessionId) {
      return
    }

    const nextPath = buildSessionPath(selectedProjectId, derivedSessionId)

    if (!routeSessionId) {
      navigateTo(nextPath, { replace: true })
      onSessionSelect?.({
        sessionId: derivedSessionId,
        projectId: selectedProjectId,
      })
      return
    }

    if (routeSessionId !== derivedSessionId) {
      navigateTo(nextPath, { replace: true })
      onSessionSelect?.({
        sessionId: derivedSessionId,
        projectId: selectedProjectId,
      })
    }
  }, [
    selectedProjectId,
    routeSessionId,
    derivedSessionId,
    onSessionSelect,
    isNewSessionPending,
  ])

  useEffect(() => {
    if (routeSessionId) {
      setIsNewSessionPending(false)
    }
  }, [routeSessionId])

  useEffect(() => {
    setIsNewSessionPending(false)
  }, [selectedProjectId])

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId)
    setIsProjectPickerOpen(false)
    navigateTo(buildProjectPath(projectId))
  }, [])

  const handleNewSessionClick = useCallback(() => {
    if (!selectedProjectId) {
      return
    }
    setIsNewSessionPending(true)
    navigateTo(buildProjectPath(selectedProjectId))
    onNewSession?.(selectedProjectId)
  }, [onNewSession, selectedProjectId])

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      if (!selectedProjectId) {
        return
      }

      navigateTo(buildSessionPath(selectedProjectId, sessionId))
      onSessionSelect?.({ sessionId, projectId: selectedProjectId })
    },
    [onSessionSelect, selectedProjectId],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!selectedProjectId) {
        return
      }

      const confirmed = window.confirm(
        'Delete this session permanently? This cannot be undone.',
      )
      if (!confirmed) {
        return
      }

      try {
        const response = await fetch(
          `${PROJECTS_ENDPOINT}/${encodeURIComponent(
            selectedProjectId,
          )}/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: 'DELETE',
          },
        )

        if (!response.ok && response.status !== 404) {
          throw new Error(
            `Failed to delete session (status ${response.status})`,
          )
        }

        await refreshSessionsForProject(selectedProjectId)
      } catch (error) {
        console.error('Failed to delete session:', error)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to delete session.',
        )
      }
    },
    [selectedProjectId, refreshSessionsForProject],
  )

  useEffect(() => {
    if (!selectedProjectId || !selectedSessionId) {
      return
    }

    const sessions = projectSessions[selectedProjectId]
    if (sessions) {
      const exists = sessions.some(
        (session) => session.id === selectedSessionId,
      )
      if (exists) {
        return
      }
    }

    void refreshSessionsForProject(selectedProjectId)
  }, [
    selectedProjectId,
    selectedSessionId,
    projectSessions,
    refreshSessionsForProject,
  ])

  const effectiveSessionId = derivedSessionId

  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-sidebar">
      <SidebarHeader
        onNewSession={handleNewSessionClick}
        disabled={!selectedProjectId}
        projectName={currentProject ? currentProject.name : null}
        latestActivity={currentProject ? currentProject.latestActivity : null}
      />
      <div className="flex-1 overflow-hidden">
        <div className="h-full w-full overflow-y-auto">
          <div className="flex h-full flex-col gap-3 px-2 py-3">
            <SessionList
              sessions={currentSessions}
              selectedSessionId={effectiveSessionId}
              onSelect={handleSessionClick}
              onDelete={handleDeleteSession}
              isLoading={isLoadingSessions}
              errorMessage={errorMessage}
            />
          </div>
        </div>
      </div>
      <div className="border-t border-border p-3">
        <CapabilitiesPanel
          capabilities={capabilities}
          isLoading={isLoadingCapabilities}
          errorMessage={capabilitiesError}
          onRefresh={onRefreshCapabilities}
        />
      </div>
      <div className="border-t border-border px-3 py-3">
        <ProjectPicker
          projects={projects}
          selectedProjectId={selectedProjectId}
          isLoading={isLoadingProjects}
          isOpen={isProjectPickerOpen}
          onOpenChange={setIsProjectPickerOpen}
          onSelect={handleProjectSelect}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
        />
      </div>
    </div>
  )
}

async function fetchProjectSessions(
  projectId: string,
  signal?: AbortSignal,
): Promise<SessionSummary[]> {
  const response = await fetch(
    `${PROJECTS_ENDPOINT}/${encodeURIComponent(projectId)}`,
    {
      method: 'GET',
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to load sessions for project '${projectId}' (status ${response.status})`,
    )
  }

  const body = (await response.json()) as { sessions?: SessionSummary[] }
  return Array.isArray(body?.sessions) ? body.sessions : []
}
