// Run the Sites workflow with a packager that honors this project's no-bulk-delete rule.
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const [pluginRoot, ...args] = process.argv.slice(2)
if (!path.isAbsolute(pluginRoot || '') || args[0] !== '--project-id' || args.length !== 2) throw new Error('Usage: node scripts/sites-workflow-safe.mjs ABSOLUTE_SITES_PLUGIN_ROOT --project-id PROJECT_ID')
const packager = fileURLToPath(new URL('./package-site-safe.mjs', import.meta.url))
let workflow = await readFile(path.join(pluginRoot, 'scripts/site-workflow.mjs'), 'utf8')
for (const helper of ['workflow-metrics.mjs', 'build-site.mjs', 'package-site.mjs']) {
  const target = helper === 'package-site.mjs' ? packager : path.join(pluginRoot, 'scripts', helper)
  const needle = `"./${helper}"`
  if (!workflow.includes(needle)) throw new Error('Sites workflow changed; inspect it before adapting the packager.')
  workflow = workflow.replace(needle, JSON.stringify(pathToFileURL(target).href))
}
const temporary = await mkdtemp(path.join(os.tmpdir(), 'shanhai-sites-workflow-'))
const file = path.join(temporary, 'site-workflow.mjs')
await writeFile(file, workflow)
const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit', windowsHide: true })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code || 0 })
// Keep temporary files; project policy prohibits bulk removal.
