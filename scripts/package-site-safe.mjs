// Package this static site without removing staging directories or old files.
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const [project, archive] = process.argv.slice(2)
if (!path.isAbsolute(project || '') || !path.isAbsolute(archive || '')) throw new Error('Provide absolute project and archive paths.')
const manifest = JSON.parse(await readFile(path.join(project, '.openai/hosting.json'), 'utf8'))
if (manifest.static?.directory !== 'dist' || !manifest.project_id) throw new Error('This packager supports this project’s static dist output only.')
await readFile(path.join(project, 'dist/index.html'))
const staging = await mkdtemp(path.join(os.tmpdir(), 'shanhai-sites-package-'))
await cp(path.join(project, 'dist'), path.join(staging, 'dist'), { recursive: true })
await mkdir(path.join(staging, 'dist/.openai'), { recursive: true })
await writeFile(path.join(staging, 'dist/.openai/hosting.json'), JSON.stringify(manifest, null, 2))
await mkdir(path.dirname(archive), { recursive: true })
const packed = spawnSync('tar', ['-czf', archive, '-C', staging, 'dist'], { encoding: 'utf8', windowsHide: true })
if (packed.status !== 0) throw new Error(packed.stderr || 'Archive creation failed.')
const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8', windowsHide: true })
if (listing.status !== 0 || !listing.stdout.split(/\r?\n/).includes('dist/.openai/hosting.json') || listing.stdout.includes('.ai-local/')) throw new Error('Archive validation failed.')
console.log(archive)
// Intentionally retain staging; bulk cleanup is prohibited by project instructions.
