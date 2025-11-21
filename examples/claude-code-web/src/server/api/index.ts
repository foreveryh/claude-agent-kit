import type { Express } from 'express'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type {
  IClaudeAgentSDKClient,
  SessionSDKOptions,
} from '@claude-agent-kit/server'

import { collectProjects, deleteProjectSession } from './projects'
import { collectSessionSummaries, readSessionDetails } from './project-sessions'
import { formatErrorMessage } from './errors'
import { collectCapabilitySummary } from './capabilities'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type RegisterApiRoutesOptions = {
  sdkClient?: IClaudeAgentSDKClient
  defaultSessionOptions?: SessionSDKOptions
  workspaceDir?: string
}

export function registerApiRoutes(
  app: Express,
  options: RegisterApiRoutesOptions = {},
) {
  const { sdkClient, defaultSessionOptions, workspaceDir } = options

  app.use('/api', (req, res, next) => {
    res.set(corsHeaders)

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  })

  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await collectProjects(workspaceDir)
      res.json({ projects, debug: true })
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to list projects', details: formatErrorMessage(error) })
    }
  })

  app.get('/api/projects/:projectId', async (req, res) => {
    const { projectId } = req.params

    try {
      const sessions = await collectSessionSummaries(projectId)

      if (sessions === null) {
        res.status(404).json({ error: `Project '${projectId}' not found` })
        return
      }

      res.json({ sessions })
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to list project sessions', details: formatErrorMessage(error) })
    }
  })

  app.get('/api/projects/:projectId/sessions/:sessionId', async (req, res) => {
    const { projectId, sessionId } = req.params

    try {
      const session = await readSessionDetails(projectId, sessionId)

      if (session === null) {
        res
          .status(404)
          .json({ error: `Session '${sessionId}' not found` })
        return
      }

      res.json(session)
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to read session details', details: formatErrorMessage(error) })
    }
  })

  app.delete('/api/projects/:projectId/sessions/:sessionId', async (req, res) => {
    const { projectId, sessionId } = req.params

    try {
      const result = await deleteProjectSession(projectId, sessionId)
      if (result === 'not_found') {
        res
          .status(404)
          .json({ error: `Session '${sessionId}' not found in project '${projectId}'` })
        return
      }

      res.status(204).end()
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to delete session', details: formatErrorMessage(error) })
    }
  })

  app.get('/api/capabilities', async (_req, res) => {
    if (!sdkClient) {
      res.status(503).json({ error: 'Capability inspection is not available' })
      return
    }

    try {
      const capabilities = await collectCapabilitySummary(
        sdkClient,
        defaultSessionOptions,
        workspaceDir,
      )

      res.json({ capabilities })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to inspect Claude Agent SDK capabilities',
        details: formatErrorMessage(error),
      })
    }
  })

  app.get('/api/system-info', (_req, res) => {
    res.json({
      workspaceDir,
      homeDir: os.homedir(),
      pathSeparator: path.sep,
    })
  })

  app.post('/api/create-directory', async (req, res) => {
    const { name: projectName } = req.body

    if (!workspaceDir) {
      res.status(500).json({ error: 'Workspace directory not configured' })
      return
    }

    if (!projectName || typeof projectName !== 'string') {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    // Validate project name: alphanumeric, spaces, hyphens, underscores only
    const validNamePattern = /^[\w][\w\s-]*$/
    if (!validNamePattern.test(projectName)) {
      res.status(400).json({
        error: 'Invalid project name. Use only letters, numbers, spaces, hyphens, and underscores.'
      })
      return
    }

    // Prevent overly long names
    if (projectName.length > 100) {
      res.status(400).json({ error: 'Project name too long (max 100 characters)' })
      return
    }

    try {
      // Construct full path server-side
      const fullPath = path.join(workspaceDir, projectName)

      // Security: Verify the resolved path is still within workspaceDir
      const resolvedWorkspace = path.resolve(workspaceDir)
      const resolvedProject = path.resolve(fullPath)

      if (!resolvedProject.startsWith(resolvedWorkspace + path.sep) &&
        resolvedProject !== resolvedWorkspace) {
        res.status(403).json({
          error: 'Invalid project path. Path traversal detected.'
        })
        return
      }

      // Create directory
      await fs.mkdir(fullPath, { recursive: true })
      res.json({ success: true, path: fullPath })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create directory',
        details: formatErrorMessage(error),
      })
    }
  })

  app.delete('/api/projects/:name', async (req, res) => {
    const { name: projectName } = req.params

    if (!workspaceDir) {
      res.status(500).json({ error: 'Workspace directory not configured' })
      return
    }

    if (!projectName) {
      res.status(400).json({ error: 'Project name is required' })
      return
    }

    try {
      // Construct full path
      const fullPath = path.join(workspaceDir, projectName)

      // Security: Verify the path is within workspaceDir
      const resolvedWorkspace = path.resolve(workspaceDir)
      const resolvedProject = path.resolve(fullPath)

      if (!resolvedProject.startsWith(resolvedWorkspace + path.sep) &&
        resolvedProject !== resolvedWorkspace) {
        res.status(403).json({
          error: 'Invalid project path. Path traversal detected.'
        })
        return
      }

      // Check if directory exists
      try {
        const stats = await fs.stat(fullPath)
        if (!stats.isDirectory()) {
          res.status(400).json({ error: 'Not a directory' })
          return
        }
      } catch (error) {
        res.status(404).json({ error: 'Project not found' })
        return
      }

      // Delete directory recursively
      await fs.rm(fullPath, { recursive: true, force: true })
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete project',
        details: formatErrorMessage(error),
      })
    }
  })
}
