import { createServer as createHttpServer } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import type { ViteDevServer } from 'vite'
import { WebSocketServer } from 'ws'

import { Session, SimpleClaudeAgentSDKClient } from '@claude-agent-kit/server'
import type { SessionSDKOptions } from '@claude-agent-kit/server'
import { WebSocketHandler } from '@claude-agent-kit/websocket'
import { registerApiRoutes } from './api'
import { registerSkillUploadRoute } from './api/skills'
import { registerRoutes } from './routes'
import { loadMcpConfig } from './mcp-config'

export interface CreateServerOptions {
  root?: string
}

export async function createServer(options: CreateServerOptions = {}) {
  const root = options.root ?? process.cwd()
  const isProduction = process.env.NODE_ENV === 'production'
  const base = process.env.BASE ?? '/'
  const workspaceDir = process.env.WORKSPACE_DIR ?? path.resolve(root, 'agent')
  await fs.mkdir(workspaceDir, { recursive: true })
  process.env.WORKSPACE_DIR = workspaceDir

  const app = express()
  const httpServer = createHttpServer(app)
  const webSocketServer = new WebSocketServer({ server: httpServer })
  const sdkClient = new SimpleClaudeAgentSDKClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_API_URL,
    model: process.env.ANTHROPIC_MODEL,
  })
  const mcpConfig = await loadMcpConfig({
    projectRoot: root,
    env: {
      WORKSPACE_DIR: workspaceDir,
      PROJECT_ROOT: root,
    },
  })

  const baseOptions = {
    thinkingLevel: 'default_on',
    cwd: workspaceDir,
    permissionMode: 'bypassPermissions',
    get systemPrompt() {
      return {
        type: 'preset',
        preset: 'claude_code',
        append: `\nToday's date is ${new Date().toDateString()}`,
      }
    },
  } as SessionSDKOptions

  if (Object.keys(mcpConfig.mcpServers).length > 0) {
    baseOptions.mcpServers = mcpConfig.mcpServers
  }

  if (mcpConfig.allowedTools.length > 0) {
    const templateSession = new Session(sdkClient)
    const defaultAllowedTools = templateSession.options.allowedTools ?? []
    baseOptions.allowedTools = Array.from(
      new Set([...defaultAllowedTools, ...mcpConfig.allowedTools]),
    )
  }

  const webSocketHandler = new WebSocketHandler(sdkClient, baseOptions)

  webSocketServer.on('connection', (ws) => {
    void webSocketHandler.onOpen(ws)

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString()
      webSocketHandler.onMessage(ws, text).catch((error) => {
        console.error('Failed to handle WebSocket message', error)
      })
    })

    ws.on('close', () => {
      webSocketHandler.onClose(ws)
    })

    ws.on('error', (error) => {
      console.error('WebSocket client error', error)
    })
  })

  let templateHtml = ''
  let vite: ViteDevServer | undefined

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      base,
    })
    app.use(vite.middlewares)
  } else {
    templateHtml = await fs.readFile(path.resolve(root, 'dist/client/index.html'), 'utf-8')
    const compression = (await import('compression')).default
    const sirv = (await import('sirv')).default
    app.use(compression())
    app.use(base, sirv(path.resolve(root, 'dist/client'), { extensions: [] }))
  }

  // Enable JSON body parsing for API routes
  app.use(express.json())

  registerApiRoutes(app, {
    sdkClient,
    defaultSessionOptions: webSocketHandler.options,
    workspaceDir,
  })

  registerSkillUploadRoute(app, { workspaceDir })

  registerRoutes(app, {
    base,
    isProduction,
    root,
    templateHtml,
    vite,
  })

  return { app, vite, httpServer, webSocketServer }
}
