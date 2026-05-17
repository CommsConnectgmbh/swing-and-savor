// Uploads 7 GitHub-Actions-Secrets in CommsConnectgmbh/swing-and-savor.
// STRIKTE APP-ISOLATION (feedback_app_isolation.md):
// ASC-Vars müssen Swing-&-Savor-spezifisch sein, kein Fallback.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = process.env.REPO || 'CommsConnectgmbh/swing-and-savor';
const SECRETS_DIR = path.join(__dirname, 'secrets');

function loadSharedEnv() {
  const candidates = [
    '/Volumes/Code/ClaudeCode/.env.shared',
    'C:/Claude Code/.env.shared',
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
const pickEnv = (...keys) => {
  for (const k of keys) {
    const v = process.env[k] ?? sharedEnv[k];
    if (v && v.trim()) return v.trim();
  }
  return null;
};

const ASC_KEY_ID = pickEnv('ASC_KEY_ID_SWINGSAVOR');
const ASC_ISSUER_ID = pickEnv('ASC_ISSUER_ID_SWINGSAVOR');
const ASC_KEY_PATH = pickEnv('ASC_API_KEY_PATH_SWINGSAVOR');

const missing = [];
if (!ASC_KEY_ID) missing.push('ASC_KEY_ID_SWINGSAVOR');
if (!ASC_ISSUER_ID) missing.push('ASC_ISSUER_ID_SWINGSAVOR');
if (!ASC_KEY_PATH) missing.push('ASC_API_KEY_PATH_SWINGSAVOR');
if (missing.length > 0) {
  console.error('');
  console.error('✗ Swing-&-Savor-ASC-Vars fehlen: ' + missing.join(', '));
  console.error('');
  console.error('Setup-Anleitung: .apple-bootstrap/README.md');
  console.error('');
  process.exit(1);
}
if (!fs.existsSync(ASC_KEY_PATH)) {
  console.error('✗ ASC_API_KEY_PATH_SWINGSAVOR zeigt ins Leere:');
  console.error('  ' + ASC_KEY_PATH);
  process.exit(1);
}

const ids = JSON.parse(fs.readFileSync(path.join(SECRETS_DIR, 'apple-ids.json'), 'utf8'));

function setSecret(name, value) {
  console.log('  ->', name);
  execSync(`gh secret set ${name} --repo ${REPO}`, {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, GH_TOKEN: process.env.GITHUB_DEALBUDDY_PAT || process.env.GH_TOKEN },
  });
}

function setSecretFromFile(name, filePath) {
  const data = fs.readFileSync(filePath);
  setSecret(name, data.toString('base64'));
}

console.log('Uploading 7 secrets to', REPO);
console.log('  Swing & Savor ASC Key ID: ' + ASC_KEY_ID);
console.log('');
setSecretFromFile('IOS_DIST_CERT_P12_BASE64',
  path.join(SECRETS_DIR, 'swingsavor-distribution.p12'));
setSecret('IOS_DIST_CERT_PASSWORD', ids.p12Password);
setSecretFromFile('IOS_PROVISIONING_PROFILE_BASE64',
  path.join(SECRETS_DIR, 'SwingSavor_AppStore.mobileprovision'));
setSecret('APPLE_TEAM_ID', ids.appleTeamId);
setSecret('ASC_API_KEY_ID', ASC_KEY_ID);
setSecret('ASC_API_ISSUER_ID', ASC_ISSUER_ID);
setSecretFromFile('ASC_API_KEY_P8_BASE64', ASC_KEY_PATH);

console.log('');
console.log('Done. Verify:  gh secret list --repo ' + REPO);
