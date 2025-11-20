import type { Express, RequestHandler } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import AdmZip from 'adm-zip'

import { formatErrorMessage } from './errors'

const upload = multer({ dest: path.join(os.tmpdir(), 'claude-skill-uploads') })

type SkillUploadOptions = {
  workspaceDir?: string
}

export function registerSkillUploadRoute(app: Express, options: SkillUploadOptions = {}) {
  const workspaceDir = options.workspaceDir
    ?? process.env.WORKSPACE_DIR
    ?? process.env.AGENT_WORKSPACE
    ?? path.resolve(process.cwd(), 'agent')
  const skillsRoot = path.join(workspaceDir, '.claude', 'skills')

  app.post('/api/skills/upload', upload.single('file') as RequestHandler, async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    try {
      await fs.mkdir(skillsRoot, { recursive: true })

      const requestedName = typeof req.body?.name === 'string' ? req.body.name : undefined
      const derivedName = inferSkillBaseName(req.file.originalname)
      const skillName = normalizeSkillName(requestedName ?? derivedName ?? randomUUID())
      const targetDir = path.join(skillsRoot, skillName)
      await fs.mkdir(targetDir, { recursive: true })

      await extractZipSafely(req.file.path, targetDir)

      res.json({ ok: true, skillPath: targetDir })
    } catch (error) {
      console.error('Failed to upload skill', error)
      res.status(500).json({ error: 'Failed to upload skill', details: formatErrorMessage(error) })
    } finally {
      await fs.unlink(req.file.path).catch(() => {})
    }
  })
}

function normalizeSkillName(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9-_]/g, '_')
}

function inferSkillBaseName(fileName?: string | null): string | undefined {
  if (!fileName) {
    return undefined
  }
  const normalized = fileName.replace(/\.(zip|skill)$/i, '').trim()
  return normalized || undefined
}

async function extractZipSafely(zipPath: string, targetDir: string) {
  const zip = new AdmZip(zipPath)
  for (const entry of zip.getEntries()) {
    const normalized = path.normalize(entry.entryName)
    if (!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized)) {
      continue
    }

    const destinationPath = path.join(targetDir, normalized)
    if (entry.isDirectory) {
      await fs.mkdir(destinationPath, { recursive: true })
      continue
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true })
    await fs.writeFile(destinationPath, entry.getData())
  }
}
