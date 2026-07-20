import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, '.standalone-build')
const publicDir = path.join(root, 'public')
const deliverablesDir = path.join(root, 'deliverables')
const outputFile = path.join(deliverablesDir, 'DWdetection-v1.1.7-preview.html')

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(target) : [target]
    }),
  )
  return files.flat()
}

async function inlinePublicAssets(source) {
  const files = await walk(publicDir)
  let result = source

  for (const file of files) {
    const extension = path.extname(file).toLowerCase()
    const mime = mimeTypes[extension]
    if (!mime) continue

    const relativePath = path.relative(publicDir, file).split(path.sep).join('/')
    const dataUrl = `data:${mime};base64,${(await fs.readFile(file)).toString('base64')}`
    const variants = [`/${relativePath}`, `../${relativePath}`, `./${relativePath}`, relativePath]

    for (const variant of variants) {
      for (const quote of ['"', "'"]) {
        result = result.split(`${quote}${variant}${quote}`).join(`${quote}${dataUrl}${quote}`)
        result = result
          .split(`url(${quote}${variant}${quote})`)
          .join(`url(${quote}${dataUrl}${quote})`)
      }
      result = result.split(`url(${variant})`).join(`url(${dataUrl})`)
    }

    // Vite preserves BASE_URL template concatenation for paths exported by figma.ts.
    result = result.replace(
      new RegExp(`\\\`\\$\\{[A-Za-z_$][\\w$]*\\}${escapeRegExp(relativePath)}\\\``, 'g'),
      JSON.stringify(dataUrl),
    )
  }

  return result
}

function removeGoogleFontImport(css) {
  return css
    .replace(/@import\s+url\((['"]?)https:\/\/fonts\.googleapis\.com[\s\S]*?\1\);/g, '')
    .replace(/@import\s*(['"])https:\/\/fonts\.googleapis\.com[\s\S]*?\1;/g, '')
}

await build({
  root,
  configFile: path.join(root, 'vite.standalone.config.ts'),
})

let html = await fs.readFile(path.join(buildDir, 'index.html'), 'utf8')
const scriptMatch = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/)
const styleMatch = html.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/)

if (!scriptMatch || !styleMatch) {
  throw new Error('Standalone build did not emit the expected script and stylesheet tags.')
}

const resolveBuildAsset = (reference) =>
  path.join(buildDir, reference.replace(/^\.\//, '').replace(/^\//, ''))

let script = await fs.readFile(resolveBuildAsset(scriptMatch[1]), 'utf8')
let style = await fs.readFile(resolveBuildAsset(styleMatch[1]), 'utf8')

script = await inlinePublicAssets(script)
style = removeGoogleFontImport(await inlinePublicAssets(style))
html = await inlinePublicAssets(html)

html = html
  .replace(styleMatch[0], () => `<style>${style.replace(/<\/style/gi, '<\\/style')}</style>`)
  .replace(
    scriptMatch[0],
    () => `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`,
  )
  .replace(
    '<head>',
    '<head>\n    <!-- DW Detection v1.1.7 standalone interaction preview -->',
  )

await fs.mkdir(deliverablesDir, { recursive: true })
await fs.writeFile(outputFile, html)
await fs.rm(buildDir, { recursive: true, force: true })

const size = (await fs.stat(outputFile)).size
console.log(`Standalone preview created: ${outputFile}`)
console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`)
