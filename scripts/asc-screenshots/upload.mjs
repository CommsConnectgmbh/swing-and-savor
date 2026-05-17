// Lädt Screenshots aus output/ zur App-Store-Connect-Version hoch.
// 4-Step-Pattern pro Screenshot:
//   1. POST /v1/appScreenshotSets       (set anlegen, screenshotDisplayType)
//   2. POST /v1/appScreenshots          (asset reservieren → uploadOperations)
//   3. PUT  uploadOperations[*].url     (binary)
//   4. PATCH /v1/appScreenshots/{id}    (uploaded=true + sourceFileChecksum)
//
// Idempotent: existierende Sets werden reused (Screenshots darin gelöscht + neu).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "output");

const SHARED_CANDIDATES = [
  "/Volumes/Code/ClaudeCode/.env.shared",
  "C:/Claude Code/.env.shared",
];
const env = (() => {
  const o = {};
  for (const p of SHARED_CANDIDATES) {
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim());
      if (m) o[m[1]] = m[2];
    }
    break;
  }
  return o;
})();
const KEY_ID = env.ASC_KEY_ID_SWINGSAVOR;
const ISSUER = env.ASC_ISSUER_ID_SWINGSAVOR;
const KEY_PATH = env.ASC_API_KEY_PATH_SWINGSAVOR;
const APP_ID = "6770264388";

if (!KEY_ID || !ISSUER || !KEY_PATH) {
  console.error("Missing Swing & Savor ASC env vars");
  process.exit(1);
}

const b64u = (b) =>
  Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const PRIVATE_KEY = fs.readFileSync(KEY_PATH);
function jwtToken() {
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }))}.${b64u(
    JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }),
  )}`;
  const sig = crypto.sign(null, Buffer.from(data), { key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  return `${data}.${b64u(sig)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function asc(method, p, body) {
  const url = `https://api.appstoreconnect.apple.com${p}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${jwtToken()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch {}
    if (res.ok) return json;
    if ((res.status === 401 || res.status === 429 || res.status >= 500) && attempt < 3) {
      console.log(`     ! ${res.status} on ${method} ${p}, retry ${attempt}/2 in ${attempt * 2}s`);
      await sleep(attempt * 2000);
      continue;
    }
    const err = new Error(`ASC ${method} ${res.status} ${p}\n${txt.slice(0, 800)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
}

const DEVICE_TO_DISPLAY = {
  // Apple-API kennt noch keinen APP_IPHONE_69, akzeptiert 1290×2796 aber unter APP_IPHONE_67
  iphone69: "APP_IPHONE_67",
  ipadpro129: "APP_IPAD_PRO_3GEN_129",
};

const FILES = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
console.log(`Found ${FILES.length} screenshots in ${OUT}`);

const byDevice = {};
for (const f of FILES) {
  const m = /^(iphone69|ipadpro129)-(\d+)\.png$/.exec(f);
  if (!m) continue;
  (byDevice[m[1]] ??= []).push({ file: f, slide: parseInt(m[2], 10) });
}

console.log("\n[1] Finde de-DE appStoreVersionLocalization");
const versions = await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
const v = versions.data.find((x) =>
  ["PREPARE_FOR_SUBMISSION","DEVELOPER_REJECTED","REJECTED","METADATA_REJECTED"].includes(x.attributes.appStoreState));
if (!v) { console.error("  ✗ keine offene Version"); process.exit(1); }
console.log(`  Version ${v.attributes.versionString} (${v.id})`);
const locs = await asc("GET", `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=20`);
const loc = locs.data.find((l) => l.attributes.locale === "de-DE") ?? locs.data[0];
console.log(`  Locale ${loc.attributes.locale} (${loc.id})`);

for (const device of Object.keys(byDevice)) {
  const displayType = DEVICE_TO_DISPLAY[device];
  const items = byDevice[device].sort((a, b) => a.slide - b.slide);
  console.log(`\n[2.${device}] Set für ${displayType} (${items.length} screenshots)`);

  const existingSets = await asc("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=20`);
  let set = existingSets.data?.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (set) {
    console.log(`  ↺ Set existiert (${set.id}), lösche bestehende Screenshots`);
    const old = await asc("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    for (const o of old.data ?? []) {
      await asc("DELETE", `/v1/appScreenshots/${o.id}`);
    }
  } else {
    const created = await asc("POST", `/v1/appScreenshotSets`, {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: displayType },
        relationships: {
          appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } },
        },
      },
    });
    set = created.data;
    console.log(`  ✓ Set angelegt (${set.id})`);
  }

  for (const it of items) {
    const filePath = path.join(OUT, it.file);
    const buf = fs.readFileSync(filePath);
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    console.log(`  [${it.slide}] ${it.file} (${buf.length} bytes, md5 ${md5})`);

    const reserved = await asc("POST", `/v1/appScreenshots`, {
      data: {
        type: "appScreenshots",
        attributes: { fileName: it.file, fileSize: buf.length },
        relationships: {
          appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } },
        },
      },
    });
    const ssId = reserved.data.id;
    const ops = reserved.data.attributes.uploadOperations ?? [];
    console.log(`     reserved ${ssId}, ${ops.length} upload op(s)`);

    for (const op of ops) {
      const headers = {};
      for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
      const slice = buf.subarray(op.offset, op.offset + op.length);
      const r = await fetch(op.url, { method: op.method, headers, body: slice });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`upload chunk failed ${r.status}: ${t.slice(0, 200)}`);
      }
    }

    await asc("PATCH", `/v1/appScreenshots/${ssId}`, {
      data: {
        type: "appScreenshots",
        id: ssId,
        attributes: { uploaded: true, sourceFileChecksum: md5 },
      },
    });
    console.log(`     ✓ uploaded + finalized`);
  }
}

console.log("\n=== Fertig ===");
