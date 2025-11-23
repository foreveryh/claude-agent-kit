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

    const tempExtractDir = path.join(os.tmpdir(), `claude-skill-${randomUUID()}`)

    try {
      await fs.mkdir(skillsRoot, { recursive: true })
      await fs.mkdir(tempExtractDir, { recursive: true })

      // 1. Extract to temp directory
      await extractZipSafely(req.file.path, tempExtractDir)

      // 2. Handle top-level directory if present
      let sourceDir = tempExtractDir
      const extractedEntries = await fs.readdir(tempExtractDir)

      if (extractedEntries.length === 1) {
        const possibleDir = path.join(tempExtractDir, extractedEntries[0])
        const stat = await fs.stat(possibleDir)
        if (stat.isDirectory()) {
          sourceDir = possibleDir
        }
      }

      // 3. Validate skill structure (must have SKILL.md or skill.yaml/yml)
      const hasSkillMd = await fileExists(path.join(sourceDir, 'SKILL.md'))
      const hasSkillYaml = await fileExists(path.join(sourceDir, 'skill.yaml')) || await fileExists(path.join(sourceDir, 'skill.yml'))

      if (!hasSkillMd && !hasSkillYaml) {
        throw new Error('Invalid skill package: Missing SKILL.md or skill.yaml at the root level.')
      }

      // 4. Determine final skill name and path
      const requestedName = typeof req.body?.name === 'string' ? req.body.name : undefined
      const derivedName = inferSkillBaseName(req.file.originalname)
      const skillName = normalizeSkillName(requestedName ?? derivedName ?? randomUUID())
      const targetDir = path.join(skillsRoot, skillName)

      // 5. Move to final destination
      // If target exists, we might want to overwrite or fail.
      // For now, let's remove it first to ensure clean state (overwrite).
      await fs.rm(targetDir, { recursive: true, force: true })
      await fs.mkdir(targetDir, { recursive: true })

      // Move contents from sourceDir to targetDir
      const sourceEntries = await fs.readdir(sourceDir)
      for (const entry of sourceEntries) {
        await fs.rename(path.join(sourceDir, entry), path.join(targetDir, entry))
      }

      res.json({ ok: true, skillPath: targetDir })
    } catch (error) {
      console.error('Failed to upload skill', error)
      res.status(500).json({ error: 'Failed to upload skill', details: formatErrorMessage(error) })
    } finally {
      // Cleanup
      await fs.unlink(req.file.path).catch(() => { })
      await fs.rm(tempExtractDir, { recursive: true, force: true }).catch(() => { })
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
