#!/usr/bin/env node
// Backfill courses.website from Overpass for OSM-sourced courses.
// Usage: node scripts/osm-backfill-websites.mjs [--limit N] [--dry]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envPath = new URL('../.env.local', import.meta.url);
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_SWINGSAVOR;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY_SWINGSAVOR');

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const UA = 'swing-savor-scorecard-bot/1.0 (mailto:rainer.roloff@comms-connect.de)';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const args = new Set(process.argv.slice(2));
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? parseInt(process.argv[limitIdx + 1], 10) : null;
const DRY = args.has('--dry');

function parseOsm(sourceId) {
  // osm-way-12345, osm-node-12345, osm-relation-12345
  const m = sourceId?.match(/^osm-(way|node|relation)-(\d+)$/);
  if (!m) return null;
  return { type: m[1], id: m[2] };
}

async function overpassFetch(query) {
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.elements) return j.elements;
    } catch {}
  }
  return null;
}

async function main() {
  let q = sb.from('courses').select('id, source_id').eq('source', 'osm').is('website', null);
  if (LIMIT) q = q.limit(LIMIT);
  const { data: rows, error } = await q;
  if (error) throw error;
  console.log(`Found ${rows.length} OSM courses without website`);

  // batch by type, 200 IDs per query
  const groups = { node: [], way: [], relation: [] };
  const idMap = new Map(); // osm-type-id -> course.id
  for (const c of rows) {
    const o = parseOsm(c.source_id);
    if (!o) continue;
    groups[o.type].push(o.id);
    idMap.set(`${o.type}-${o.id}`, c.id);
  }

  let updated = 0, skipped = 0, errors = 0;
  for (const [type, ids] of Object.entries(groups)) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const idList = chunk.join(',');
      const q = `[out:json][timeout:60];${type}(id:${idList});out tags;`;
      console.log(`  Querying ${type}: batch ${i}-${i + chunk.length} of ${ids.length}`);
      const elems = await overpassFetch(q);
      if (!elems) { errors += chunk.length; continue; }
      for (const e of elems) {
        const courseId = idMap.get(`${e.type}-${e.id}`);
        if (!courseId) continue;
        const tags = e.tags || {};
        const website = tags.website || tags['contact:website'] || tags.url || null;
        const phone = tags.phone || tags['contact:phone'] || null;
        const description = tags.description || null;
        if (!website) { skipped++; continue; }
        if (DRY) { console.log('  DRY', courseId, '→', website); updated++; continue; }
        const { error: upErr } = await sb.from('courses').update({
          website,
          notes: description ? (phone ? `${description} | Tel ${phone}` : description) : (phone ? `Tel ${phone}` : null),
        }).eq('id', courseId);
        if (upErr) { console.error('  UPDATE error', courseId, upErr.message); errors++; }
        else updated++;
      }
      await new Promise(r => setTimeout(r, 1500)); // be polite
    }
  }
  console.log(`Done. updated=${updated} skipped=${skipped} errors=${errors}`);
}
main().catch(e => { console.error(e); process.exit(1); });
