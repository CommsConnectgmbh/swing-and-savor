#!/usr/bin/env node
// Generate atmospheric landing-page imagery via OpenAI gpt-image-1.
// Reads OPENAI_API_KEY from /Volumes/Code/ClaudeCode/.env.shared

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT  = resolve(ROOT, 'img')
mkdirSync(OUT, { recursive: true })

const SHARED = '/Volumes/Code/ClaudeCode/.env.shared'
const envText = readFileSync(SHARED, 'utf-8')
const key = envText.match(/^OPENAI_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) { console.error('OPENAI_API_KEY missing in .env.shared'); process.exit(1) }

const NEGATIVE = 'no text, no letters, no logos, no watermarks, no people in foreground, no UI mockups'

const JOBS = [
  {
    name: 'hero.jpg',
    size: '1536x1024',
    prompt: `Cinematic wide aerial photograph of an immaculate links golf course at golden hour. Long deep shadows from low sun, sweeping fairway curving toward a green by the sea, soft mist hanging in the distance, dramatic lighting, deep moody greens and warm amber light, Hasselblad style, ultra-detailed, ${NEGATIVE}.`,
  },
  {
    name: 'detail-ball.jpg',
    size: '1024x1024',
    prompt: `Atmospheric close-up of a single white golf ball resting on a wooden tee in dewy grass at sunrise. Backlit, shallow depth of field, golden rim light on the ball, dark moody background with bokeh, premium product photography, editorial mood, ${NEGATIVE}.`,
  },
  {
    name: 'fairway.jpg',
    size: '1536x1024',
    prompt: `Aerial drone photograph straight down over a sculpted golf course fairway and bunkers. Geometric sand bunkers, rich green grass with mowing patterns, intersecting paths, mountainous landscape just barely visible at the edge, late afternoon light, hyper-real, magazine cover quality, ${NEGATIVE}.`,
  },
]

async function generate(job) {
  console.log(`→ ${job.name} (${job.size})`)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: job.prompt,
      size: job.size,
      quality: 'high',
      n: 1,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`)
  }
  const body = await res.json()
  const b64 = body?.data?.[0]?.b64_json
  if (!b64) throw new Error(`No b64_json in response: ${JSON.stringify(body).slice(0, 200)}`)
  const buf = Buffer.from(b64, 'base64')
  const outPath = resolve(OUT, job.name.replace(/\.jpg$/, '.png'))
  writeFileSync(outPath, buf)
  console.log(`  saved ${outPath} (${(buf.length / 1024).toFixed(0)} kB)`)
  return outPath
}

const results = []
for (const j of JOBS) {
  if (existsSync(resolve(OUT, j.name.replace(/\.jpg$/, '.png')))) {
    console.log(`✓ ${j.name} already exists — skipping`)
    continue
  }
  try {
    const p = await generate(j)
    results.push({ name: j.name, path: p, ok: true })
  } catch (e) {
    console.error(`✗ ${j.name}: ${e.message}`)
    results.push({ name: j.name, ok: false, error: e.message })
  }
}
console.log('\nDone:', JSON.stringify(results, null, 2))
