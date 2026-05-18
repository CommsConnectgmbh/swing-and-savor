#!/usr/bin/env node
// Scrape course scorecards from homepages using local Ollama (Qwen 2.5 14B).
//
// Pipeline per course:
//   1. Fetch website (root)
//   2. Find candidate scorecard/course-info link in HTML
//   3. Fetch candidate page (or root if none)
//   4. Strip HTML → plain text
//   5. Ask Ollama for JSON { pars:[18], hcps:[18] }
//   6. Validate (length=18, par∈{3,4,5}, hcp 1..18 unique, sum ∈ 64..76)
//   7. UPDATE courses if valid
//
// Usage: node scripts/scrape-scorecards.mjs [--limit N] [--id UUID] [--concurrency 3] [--dry]

import { createClient } from '@supabase/supabase-js';
import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';

const envPath = new URL('../.env.local', import.meta.url);
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_SWINGSAVOR;
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b-instruct';
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing env');

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const UA = 'Mozilla/5.0 (compatible; swing-savor-scorecard-bot/1.0; +mailto:rainer.roloff@comms-connect.de)';

const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const LIMIT = parseInt(argVal('--limit') || '0', 10) || null;
const ONLY_ID = argVal('--id');
const CONCURRENCY = parseInt(argVal('--concurrency') || '3', 10);
const DRY = args.includes('--dry');
const LOG_DIR = new URL('../.local-scrape-logs/', import.meta.url).pathname;
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const RUN_LOG = `${LOG_DIR}run-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;

function logRow(obj) { appendFileSync(RUN_LOG, JSON.stringify(obj) + '\n'); }

async function fetchWithTimeout(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('pdf') || ct.includes('image')) return { html: '', isBinary: true, contentType: ct };
    const html = await r.text();
    return { html, isBinary: false, contentType: ct };
  } catch { return null; }
  finally { clearTimeout(t); }
}

const STRIP_RE = /<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi;
function htmlToText(html) {
  return html
    .replace(STRIP_RE, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCandidateLinks(html, baseUrl) {
  const out = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  // DE/EN/ES/IT/FR/NL/TR keywords + common path tokens
  const keywords = /(scorecard|scorekarte|score-?card|bahnen|spielbahn|platz(?:[-_ ]?(?:info|beschreibung|guide|details|tour))?|course[-_ ]?(?:info|guide|details|layout|overview|tour)|loch[-_ ]?übersicht|loecher|l[oö]cher|hole[-_ ]?by[-_ ]?hole|18[-_ ]?l[oö]cher|18[-_ ]?holes?|fairway|kursinfo|the[-_ ]?course|our[-_ ]?course|el[-_ ]?campo|recorrido|hoyos?|percorso|buche|parcours|baan|baanrecord|sahalar|championship[-_ ]?course)/i;
  // Skip obvious noise
  const noise = /(facebook|instagram|twitter|youtube|tel:|mailto:|\.pdf$|\.jpg$|\.png$)/i;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (noise.test(href) && !/\.pdf/i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ').trim();
    if (keywords.test(href) || keywords.test(text)) {
      try { out.add(new URL(href, baseUrl).toString()); } catch {}
    }
  }
  // Always also try common path guesses
  const guesses = [
    '/scorecard', '/score-card', '/scorekarte',
    '/course', '/the-course', '/our-course', '/courses',
    '/course-info', '/course-details', '/course-layout', '/course-guide', '/course-tour',
    '/bahnen', '/spielbahnen', '/platz', '/platzinfo', '/platzbeschreibung',
    '/loecher', '/löcher', '/18-loecher', '/18-löcher',
    '/holes', '/18-holes', '/hole-by-hole',
    '/el-campo', '/campo', '/recorrido', '/hoyos',
    '/percorso', '/buche',
  ];
  for (const p of guesses) {
    try { out.add(new URL(p, baseUrl).toString()); } catch {}
  }
  return [...out].slice(0, 12);
}

async function askOllama(name, city, text) {
  const prompt = `Extract the 18-hole scorecard from the golf course web page text below.

A scorecard typically lists, per hole (1-18):
- "Par" / "PAR" / "Par-Wert" (each 3, 4 or 5)
- "Handicap" / "HCP" / "Hcp" / "Vorgabe" / "Stroke Index" / "SI" (1..18, each used exactly once)

RESPONSE FORMAT — JSON only, nothing else.
On success: {"found":true,"pars":[18 ints 3-5],"hcps":[18 ints 1-18 each unique],"total_par":int,"evidence":"short quote ~120 chars"}
On failure (no scorecard or incomplete): {"found":false,"reason":"short reason"}

Be permissive: if both par-series and handicap-series are present for all 18 holes (in any layout: table, list, two halves of 9), return them. Numbers in the page are hard evidence — extract them, don't invent. If only pars are present without HCPs, still return {"found":false,...}.

Golf course: ${name}${city ? ` (${city})` : ''}

Page text:
"""${text.slice(0, 16000)}"""`;
  const body = {
    model: MODEL,
    prompt,
    format: 'json',
    stream: false,
    options: { temperature: 0, num_ctx: 8192 },
  };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 90_000);
  try {
    const r = await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) return { found: false, reason: `ollama-http-${r.status}` };
    const j = await r.json();
    try { return JSON.parse(j.response); }
    catch { return { found: false, reason: 'json-parse-fail', raw: j.response?.slice(0, 200) }; }
  } catch (e) { return { found: false, reason: `ollama-exception-${e.name}` }; }
  finally { clearTimeout(t); }
}

function validate(p) {
  if (!p || !p.found) return { ok: false, reason: p?.reason || 'not-found' };
  const { pars, hcps } = p;
  if (!Array.isArray(pars) || pars.length !== 18) return { ok: false, reason: 'pars-not-18' };
  if (!Array.isArray(hcps) || hcps.length !== 18) return { ok: false, reason: 'hcps-not-18' };
  if (!pars.every(n => Number.isInteger(n) && n >= 3 && n <= 5)) return { ok: false, reason: 'par-out-of-range' };
  if (!hcps.every(n => Number.isInteger(n) && n >= 1 && n <= 18)) return { ok: false, reason: 'hcp-out-of-range' };
  if (new Set(hcps).size !== 18) return { ok: false, reason: 'hcps-not-unique' };
  const sum = pars.reduce((a, b) => a + b, 0);
  if (sum < 64 || sum > 76) return { ok: false, reason: `total-par-${sum}-implausible` };
  return { ok: true, total_par: sum };
}

async function processCourse(c) {
  const log = { id: c.id, name: c.name, city: c.city, website: c.website };
  if (!c.website) { log.status = 'no-website'; logRow(log); return log; }

  let homeUrl = c.website;
  if (!/^https?:\/\//.test(homeUrl)) homeUrl = 'https://' + homeUrl;

  const home = await fetchWithTimeout(homeUrl);
  if (!home) { log.status = 'home-fetch-fail'; logRow(log); return log; }
  if (home.isBinary) { log.status = 'home-binary'; logRow(log); return log; }

  const candidates = findCandidateLinks(home.html, homeUrl);
  log.candidates = candidates.length;

  // Try candidates first, fallback to home. Cap to 6 fetches per course.
  const pagesToTry = [...candidates, homeUrl].slice(0, 6);
  let llmCalls = 0;
  for (const url of pagesToTry) {
    if (llmCalls >= 3) break; // hard cap on Ollama calls per course
    const page = url === homeUrl ? home : await fetchWithTimeout(url);
    if (!page || page.isBinary || !page.html) continue;
    const text = htmlToText(page.html);
    if (text.length < 400) continue;
    // Pre-filter: only call LLM if page mentions par AND handicap-like signal
    const lower = text.toLowerCase();
    const hasPar = /\bpar\b/.test(lower);
    const hasHcp = /\b(hcp|handicap|hdcp|stroke[\s-]?index|\bsi\b|vorgabe)\b/.test(lower);
    if (!hasPar || !hasHcp) continue;
    // And require at least 14 digit tokens in 1..18 range (rough proxy for scorecard table)
    const numTokens = (text.match(/\b(?:1[0-8]|[3-9])\b/g) || []).length;
    if (numTokens < 30) continue;
    llmCalls++;
    const parsed = await askOllama(c.name, c.city, text);
    const v = validate(parsed);
    if (!v.ok) { log.last_reason = v.reason; continue; }
    log.status = 'scraped';
    log.source_url = url;
    log.pars = parsed.pars;
    log.hcps = parsed.hcps;
    log.total_par = v.total_par;
    log.evidence = parsed.evidence?.slice(0, 160);
    if (!DRY) {
      const { error } = await sb.from('courses').update({
        hole_pars: parsed.pars,
        hole_handicaps: parsed.hcps,
        total_par: v.total_par,
        num_holes: 18,
        scorecard_source_url: url,
        scorecard_scraped_at: new Date().toISOString(),
        scorecard_scrape_status: 'ollama-scraped',
      }).eq('id', c.id);
      if (error) { log.status = 'update-fail'; log.error = error.message; }
    }
    logRow(log);
    return log;
  }
  log.status = 'no-scorecard-found';
  if (!DRY) {
    await sb.from('courses').update({
      scorecard_scraped_at: new Date().toISOString(),
      scorecard_scrape_status: `failed:${log.last_reason || 'no-candidate'}`,
    }).eq('id', c.id);
  }
  logRow(log);
  return log;
}

async function pool(items, n, worker) {
  const queue = items.slice();
  const results = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { results.push(await worker(item)); }
      catch (e) { results.push({ id: item.id, status: 'exception', error: String(e) }); }
    }
  }));
  return results;
}

async function main() {
  let q = sb.from('courses')
    .select('id, name, city, country, website, hole_pars')
    .not('website', 'is', null);
  if (ONLY_ID) q = q.eq('id', ONLY_ID);
  // No SQL filter — JS side filters out 18-par-complete rows. Keeps logic simple.
  q = q.limit(LIMIT || 5000);
  const { data: rows, error } = await q.order('name');
  if (error) throw error;

  // skip courses that already have valid pars
  const todo = rows.filter(r => !r.hole_pars || r.hole_pars.length !== 18);
  console.log(`Pool: ${todo.length} courses (concurrency=${CONCURRENCY}, dry=${DRY})`);
  console.log(`Log: ${RUN_LOG}`);

  const results = await pool(todo, CONCURRENCY, processCourse);

  const tally = {};
  for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
  console.log('Done.', tally);
}

main().catch(e => { console.error(e); process.exit(1); });
