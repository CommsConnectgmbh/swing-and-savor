// Rasterizes public/icon.svg → PNG variants used by the PWA manifest,
// favicon and Apple touch icon. Run with `node scripts/generate-icons.mjs`.
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'public/icon.svg')
const outDir = resolve(root, 'public/icons')
mkdirSync(outDir, { recursive: true })

const svg = readFileSync(src)

const variants = [
  { name: 'icon-192.png',         size: 192, padding: 0 },
  { name: 'icon-512.png',         size: 512, padding: 0 },
  { name: 'maskable-192.png',     size: 192, padding: 0.18, bg: '#05070a' },
  { name: 'maskable-512.png',     size: 512, padding: 0.18, bg: '#05070a' },
  { name: 'apple-touch-icon.png', size: 180, padding: 0 },
  { name: 'favicon-32.png',       size: 32,  padding: 0 },
  { name: 'favicon-16.png',       size: 16,  padding: 0 },
]

for (const v of variants) {
  const inner = Math.round(v.size * (1 - v.padding * 2))
  const offset = Math.round((v.size - inner) / 2)
  const base = sharp({
    create: { width: v.size, height: v.size, channels: 4, background: v.bg ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
  const rendered = await sharp(svg).resize(inner, inner).png().toBuffer()
  await base.composite([{ input: rendered, top: offset, left: offset }])
            .png({ compressionLevel: 9 })
            .toFile(resolve(outDir, v.name))
  console.log('wrote', v.name)
}
