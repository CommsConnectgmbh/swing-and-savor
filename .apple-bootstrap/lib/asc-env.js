// Swing-&-Savor-spezifische ASC-Env-Resolution für alle .apple-bootstrap-Scripts.
//
// STRIKTE APP-ISOLATION (siehe feedback_app_isolation.md):
// kein Fallback auf DealBuddy/Obacht/Belegify-Keys.
// Wenn Swing-&-Savor-Vars fehlen → process.exit(1) mit Anleitung.
//
// Lookup-Reihenfolge pro Var:
//   1. process.env
//   2. /Volumes/Code/ClaudeCode/.env.shared (oder relative Heuristik)

const fs = require('fs');
const path = require('path');

function loadSharedEnv() {
  const candidates = [
    '/Volumes/Code/ClaudeCode/.env.shared',
    'C:/Claude Code/.env.shared',
    path.resolve(__dirname, '../../../.env.shared'),
    path.resolve(__dirname, '../../.env.shared'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const out = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2];
    }
    return out;
  }
  return {};
}

const sharedEnv = loadSharedEnv();

function pickEnv(...keys) {
  for (const k of keys) {
    const v = process.env[k] ?? sharedEnv[k];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function resolveSwingSavorAsc() {
  const keyId = pickEnv('ASC_KEY_ID_SWINGSAVOR');
  const issuerId = pickEnv('ASC_ISSUER_ID_SWINGSAVOR');
  const keyPath = pickEnv('ASC_API_KEY_PATH_SWINGSAVOR');

  const missing = [];
  if (!keyId) missing.push('ASC_KEY_ID_SWINGSAVOR');
  if (!issuerId) missing.push('ASC_ISSUER_ID_SWINGSAVOR');
  if (!keyPath) missing.push('ASC_API_KEY_PATH_SWINGSAVOR');

  if (missing.length > 0) {
    console.error('');
    console.error('✗ Swing-&-Savor-ASC-Vars fehlen: ' + missing.join(', '));
    console.error('');
    console.error('Setup-Anleitung: .apple-bootstrap/README.md');
    console.error('Kein Fallback auf andere Apps — strikte App-Isolation.');
    console.error('');
    process.exit(1);
  }
  if (!fs.existsSync(keyPath)) {
    console.error('');
    console.error('✗ ASC_API_KEY_PATH_SWINGSAVOR zeigt ins Leere:');
    console.error('  ' + keyPath);
    console.error('');
    process.exit(1);
  }

  return { keyId, issuerId, keyPath };
}

module.exports = { resolveSwingSavorAsc, pickEnv };
