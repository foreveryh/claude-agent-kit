import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';

// Mocking the logic from skills.ts
async function extractZipSafely(zipPath: string, targetDir: string) {
    const zip = new AdmZip(zipPath)
    for (const entry of zip.getEntries()) {
        const normalized = path.normalize(entry.entryName)
        if (!normalized || normalized === '.' || normalized.startsWith('..') || path.isAbsolute(normalized)) {
            continue
        }

        const destinationPath = path.join(targetDir, normalized)
        if (entry.isDirectory) {
            await fs.promises.mkdir(destinationPath, { recursive: true })
            continue
        }

        await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true })
        await fs.promises.writeFile(destinationPath, entry.getData())
    }
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath)
        return true
    } catch {
        return false
    }
}

async function processUpload(zipPath: string, finalTargetDir: string) {
    const tempExtractDir = path.join(os.tmpdir(), `claude-skill-test-${randomUUID()}`)
    console.log(`Processing ${zipPath}...`);

    try {
        await fs.promises.mkdir(tempExtractDir, { recursive: true })

        // 1. Extract to temp directory
        await extractZipSafely(zipPath, tempExtractDir)

        // 2. Handle top-level directory if present
        let sourceDir = tempExtractDir
        const extractedEntries = await fs.promises.readdir(tempExtractDir)

        if (extractedEntries.length === 1) {
            const possibleDir = path.join(tempExtractDir, extractedEntries[0])
            const stat = await fs.promises.stat(possibleDir)
            if (stat.isDirectory()) {
                console.log('  Detected top-level directory, stripping...');
                sourceDir = possibleDir
            }
        }

        // 3. Validate skill structure
        const hasSkillMd = await fileExists(path.join(sourceDir, 'SKILL.md'))
        const hasSkillYaml = await fileExists(path.join(sourceDir, 'skill.yaml')) || await fileExists(path.join(sourceDir, 'skill.yml'))

        if (!hasSkillMd && !hasSkillYaml) {
            throw new Error('Invalid skill package: Missing SKILL.md or skill.yaml at the root level.')
        }
        console.log('  Validation passed.');

        // 5. Move to final destination
        if (fs.existsSync(finalTargetDir)) {
            await fs.promises.rm(finalTargetDir, { recursive: true, force: true })
        }
        await fs.promises.mkdir(finalTargetDir, { recursive: true })

        const sourceEntries = await fs.promises.readdir(sourceDir)
        for (const entry of sourceEntries) {
            await fs.promises.rename(path.join(sourceDir, entry), path.join(finalTargetDir, entry))
        }
        console.log(`  Success! Installed to ${finalTargetDir}`);

        // Verify content
        const installedFiles = await fs.promises.readdir(finalTargetDir);
        console.log(`  Installed files: ${installedFiles.join(', ')}`);

    } catch (error) {
        console.error(`  Failed: ${(error as Error).message}`)
    } finally {
        await fs.promises.rm(tempExtractDir, { recursive: true, force: true }).catch(() => { })
    }
}

async function run() {
    const tmpDir = os.tmpdir();
    const skillsRoot = path.join(tmpDir, 'claude-skills-test-root');
    await fs.promises.mkdir(skillsRoot, { recursive: true });

    // Case 1: Flat zip with SKILL.md
    console.log('\n--- Case 1: Flat zip with SKILL.md ---');
    const zip1Path = path.join(tmpDir, 'skill-flat.zip');
    const zip1 = new AdmZip();
    zip1.addFile('SKILL.md', Buffer.from('# My Skill'));
    zip1.addFile('index.js', Buffer.from('console.log("hi")'));
    zip1.writeZip(zip1Path);
    await processUpload(zip1Path, path.join(skillsRoot, 'skill-flat'));

    // Case 2: Nested zip with SKILL.md (zipped folder)
    console.log('\n--- Case 2: Nested zip with SKILL.md ---');
    const zip2Path = path.join(tmpDir, 'skill-nested.zip');
    const zip2 = new AdmZip();
    zip2.addFile('my-skill/SKILL.md', Buffer.from('# My Nested Skill'));
    zip2.addFile('my-skill/index.js', Buffer.from('console.log("hi")'));
    zip2.writeZip(zip2Path);
    await processUpload(zip2Path, path.join(skillsRoot, 'skill-nested'));

    // Case 3: Invalid zip (no SKILL.md)
    console.log('\n--- Case 3: Invalid zip (no SKILL.md) ---');
    const zip3Path = path.join(tmpDir, 'skill-invalid.zip');
    const zip3 = new AdmZip();
    zip3.addFile('index.js', Buffer.from('console.log("hi")'));
    zip3.writeZip(zip3Path);
    await processUpload(zip3Path, path.join(skillsRoot, 'skill-invalid'));

    // Case 4: .skill extension
    console.log('\n--- Case 4: .skill extension ---');
    const zip4Path = path.join(tmpDir, 'my-skill.skill');
    const zip4 = new AdmZip();
    zip4.addFile('SKILL.md', Buffer.from('# My Skill File'));
    zip4.writeZip(zip4Path);
    await processUpload(zip4Path, path.join(skillsRoot, 'skill-ext'));
}

run().catch(console.error);
