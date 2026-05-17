#!/usr/bin/env node
// Capture real app screenshots from a logged-in Tiger W. session.
// Usage: node screenshots/capture.mjs [--app-url=https://app.swingandsavor.at]
//
// Flow:
// 1. admin/generate_link → email_otp for apple-review@swingandsavor.at
// 2. POST /auth/v1/verify → access_token + refresh_token
// 3. Playwright sets the supabase session JSON into localStorage
// 4. Navigate to each screen, wait for content, take screenshot

import { chromium, devices } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'marketing', 'img', 'screens')

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')))
const APP_URL = args['--app-url'] || 'https://app.swingandsavor.at'
const SUPABASE_URL = 'https://rcqichlyllhwougopfkg.supabase.co'
const SUPABASE_REF = 'rcqichlyllhwougopfkg'
const REVIEWER_EMAIL = 'apple-review@swingandsavor.at'

// Direct in-browser Auth via admin-generated OTP, no UI involvement.
const ACCESS_TOKEN_MGMT = process.env.SUPABASE_ACCESS_TOKEN
if (!ACCESS_TOKEN_MGMT) {
  console.error('SUPABASE_ACCESS_TOKEN missing — source /Volumes/Code/ClaudeCode/.env.shared')
  process.exit(1)
}

async function fetchKeys() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN_MGMT}` },
  })
  const keys = await res.json()
  return {
    service: keys.find((k) => k.name === 'service_role').api_key,
    anon: keys.find((k) => k.name === 'anon').api_key,
  }
}

async function generateOtp(serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: REVIEWER_EMAIL }),
  })
  const j = await res.json()
  return j.email_otp
}

// Use the reviewer-bypass flow that the live App supports natively.
// Email + code are hardcoded in supabase/functions/reviewer-bypass/index.ts.
const REVIEWER_CODE = '87654321'

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // iPhone 14 Pro Max profile — close to App Store 6.7" requirement
  const profile = devices['iPhone 14 Pro Max'] ?? devices['iPhone 13 Pro Max']
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    ...profile,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
  })

  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('sns_lang', 'en')
      localStorage.setItem('sns_marketing_lang', 'en')
    } catch {}
  })

  const page = await ctx.newPage()
  page.on('console', (msg) => {
    const t = msg.type()
    if (t === 'error' || (t === 'warning' && !/Future Flag/.test(msg.text()))) {
      console.log(`[browser ${t}]`, msg.text())
    }
  })
  page.on('response', async (resp) => {
    const url = resp.url()
    if (/\/rest\/v1\/profiles/.test(url) || /\/auth\/v1\/token/.test(url)) {
      const body = await resp.text().catch(() => '')
      console.log(`[NET ${resp.status()}]`, url.replace(SUPABASE_URL, ''), '→', body.slice(0, 180))
    }
  })

  async function shoot(name, opts = {}) {
    console.log(`📸 ${name}`)
    // Wait until App rendered content that is NOT sign-in or onboarding
    await page.waitForFunction(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
      if (text.length < 30) return false
      if (text.includes('Profil anlegen')) return false
      if (text.includes('Welcome to Swing & Savor')) return false
      if (text.includes('Send code')) return false
      if (text.includes('Code senden')) return false
      return true
    }, { timeout: 20000 }).catch(() => {})
    if (opts.waitFor) await page.waitForSelector(opts.waitFor, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(opts.delay ?? 1500)
    await page.addStyleTag({ content: '*{ caret-color: transparent !important;} ::-webkit-scrollbar{display:none}' })
    const file = resolve(OUT_DIR, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log('   ↳', file)
  }

  async function navTo(href) {
    await page.evaluate((h) => { window.history.pushState({}, '', h); window.dispatchEvent(new PopStateEvent('popstate')) }, href)
    await page.waitForTimeout(500)
  }

  // Admin-OTP → in-browser verifyOtp via the App's own supabase client.
  // This populates 'sas-auth' through the official path (events fire, profile loads).
  console.log('→ generating admin OTP…')
  const { service } = await fetchKeys()
  const otp = await generateOtp(service)
  console.log('  OTP:', otp)

  console.log('→ navigating to sign-in to bootstrap supabase…')
  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })

  console.log('→ verifying OTP inside the browser…')
  const result = await page.evaluate(async ({ email, token }) => {
    try {
      const mod = await import('/src/lib/supabase.js')
      const { data, error } = await mod.supabase.auth.verifyOtp({ email, token, type: 'email' })
      return { ok: !error, err: error?.message, user: data?.user?.id }
    } catch (e) {
      return { ok: false, err: String(e) }
    }
  }, { email: REVIEWER_EMAIL, token: otp })
  console.log('  verify:', result)

  // Wait for AuthProvider to load the profile and render content
  await page.waitForFunction(() => {
    const txt = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
    return txt.length > 50 && !txt.includes('Send code') && !txt.includes('Code senden')
  }, { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(1500)
  console.log('  rendered:', (await page.evaluate(() => (document.body?.innerText || '').slice(0, 140))))
  // Persist the session to disk so subsequent page.goto reloads keep it
  const lsDump = await page.evaluate(() => ({
    sas: localStorage.getItem('sas-auth'),
    keys: Object.keys(localStorage),
  }))
  console.log('  localStorage keys:', lsDump.keys.join(','))
  console.log('  sas length:', lsDump.sas?.length)

  // Use SPA navigation (no full reload → session persists in memory)
  await navTo('/board')
  await shoot('board', { delay: 2000 })

  await navTo('/cup')
  await shoot('cup-list', { delay: 1500 })

  await navTo('/matches')
  await shoot('matches', { delay: 1500 })

  // Open first match detail if present
  const matchHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/matches/"]')
    return a ? a.getAttribute('href') : null
  })
  if (matchHref) {
    await navTo(matchHref)
    await shoot('match-detail', { delay: 2000 })
  }

  await navTo('/me')
  await shoot('profile', { delay: 1500 })

  // Public cup is its own route (open w/o auth — full reload is fine)
  await page.goto(`${APP_URL}/c/SPRING26`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const pubFile = resolve(OUT_DIR, 'public-cup.png')
  await page.addStyleTag({ content: '*{ caret-color: transparent !important;} ::-webkit-scrollbar{display:none}' })
  await page.screenshot({ path: pubFile, fullPage: false })
  console.log('   ↳', pubFile)

  await browser.close()
  console.log('✓ done — screenshots in', OUT_DIR)
}

main().catch((e) => { console.error(e); process.exit(1) })
