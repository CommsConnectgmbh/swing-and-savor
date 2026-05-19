// resubmit.mjs — nach erfolgreichem CI-Upload Build 2:
//   1. Warten bis neuester Build processingState=VALID ist
//   2. Den neuen Build der Version 1.0 zuordnen (PATCH appStoreVersions/{vid}.relationships.build)
//   3. Bestehende UNRESOLVED_ISSUES-ReviewSubmission canceln
//   4. Neue ReviewSubmission anlegen + Item für unsere Version + SUBMITTED
//
// Antwort an Apple Reviewer wird zusätzlich in der Konsole ausgegeben, damit
// Rainer sie noch im ASC-Reply-Tab manuell pasten kann (das gibt es nicht via
// API zu unserem Zeitpunkt).

import fs from "node:fs";
import crypto from "node:crypto";

const APP_ID = "6770264388";
const SHARED = "/Volumes/Code/ClaudeCode/.env.shared";

const env = {};
for (const l of fs.readFileSync(SHARED, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2];
}
const KEY_ID = env.ASC_KEY_ID_SWINGSAVOR;
const ISSUER = env.ASC_ISSUER_ID_SWINGSAVOR;
const KEY_PATH = env.ASC_API_KEY_PATH_SWINGSAVOR;
const PRIVATE_KEY = fs.readFileSync(KEY_PATH);

const b64u = (b) =>
  Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
function jwt() {
  const n = Math.floor(Date.now() / 1000);
  const d = `${b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }))}.${b64u(
    JSON.stringify({ iss: ISSUER, iat: n, exp: n + 1200, aud: "appstoreconnect-v1" }),
  )}`;
  const s = crypto.sign(null, Buffer.from(d), { key: PRIVATE_KEY, dsaEncoding: "ieee-p1363" });
  return `${d}.${b64u(s)}`;
}
async function asc(m, p, body) {
  const r = await fetch("https://api.appstoreconnect.apple.com" + p, {
    method: m,
    headers: { Authorization: "Bearer " + jwt(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch {}
  if (!r.ok) throw new Error(`ASC ${m} ${r.status} ${p}\n${t.slice(0, 800)}`);
  return j;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForValidBuild(targetVersion = "2", timeoutMin = 30) {
  const deadline = Date.now() + timeoutMin * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await asc("GET", `/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`);
    const b = (r.data ?? []).find((x) => x.attributes.version === targetVersion);
    if (b) {
      console.log(`  build ${targetVersion} processingState=${b.attributes.processingState}`);
      if (b.attributes.processingState === "VALID") return b;
    } else {
      console.log(`  build ${targetVersion} noch nicht in ASC`);
    }
    await sleep(60_000);
  }
  throw new Error(`Build ${targetVersion} hat in ${timeoutMin}min nicht VALID erreicht`);
}

async function main() {
  console.log("[1] Warte auf Build 2 (VALID) …");
  const build = await waitForValidBuild("2", 45);
  console.log("  ✓ Build VALID:", build.id);

  console.log("\n[2] Hole offene Version");
  const versions = await asc("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const v = versions.data.find((x) =>
    ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"]
      .includes(x.attributes.appStoreState));
  if (!v) throw new Error("Keine offene Version gefunden");
  console.log(`  Version ${v.attributes.versionString} (${v.id}) state=${v.attributes.appStoreState}`);

  console.log("\n[3] Build der Version zuordnen");
  await asc("PATCH", `/v1/appStoreVersions/${v.id}/relationships/build`, {
    data: { type: "builds", id: build.id },
  });
  console.log("  ✓ Build verknüpft");

  console.log("\n[4] Vorhandene ReviewSubmissions prüfen");
  const rs = await asc("GET", `/v1/apps/${APP_ID}/reviewSubmissions?limit=10`);
  for (const x of rs.data ?? []) {
    console.log(`  ${x.attributes.state} → ${x.id}`);
  }
  const stale = (rs.data ?? []).find((x) =>
    ["UNRESOLVED_ISSUES", "IN_REVIEW", "WAITING_FOR_REVIEW", "READY_FOR_REVIEW"]
      .includes(x.attributes.state));
  if (stale) {
    console.log(`  ↺ cancel stale submission ${stale.id} (${stale.attributes.state})`);
    try {
      await asc("PATCH", `/v1/reviewSubmissions/${stale.id}`, {
        data: { type: "reviewSubmissions", id: stale.id, attributes: { canceled: true } },
      });
      console.log("    ✓ canceled");
    } catch (e) {
      console.log("    ✗ cancel failed:", e.message.split("\n")[0]);
    }
  }

  console.log("\n[5] Neue ReviewSubmission anlegen");
  const newRs = await asc("POST", `/v1/reviewSubmissions`, {
    data: {
      type: "reviewSubmissions",
      attributes: { platform: "IOS" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    },
  });
  console.log("  ✓", newRs.data.id);

  console.log("\n[6] Item (=Version) hinzufügen");
  const itm = await asc("POST", `/v1/reviewSubmissionItems`, {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: newRs.data.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
      },
    },
  });
  console.log("  ✓", itm.data.id);

  console.log("\n[7] Submit (state=SUBMITTED)");
  await asc("PATCH", `/v1/reviewSubmissions/${newRs.data.id}`, {
    data: {
      type: "reviewSubmissions",
      id: newRs.data.id,
      attributes: { submitted: true },
    },
  });
  console.log("  ✓ submitted");

  console.log("\n=== DONE ===");
  console.log("\nReply für Apple-Review-Tab (manuell pasten):\n");
  console.log(`Hello,

Thanks for the detailed review. Both issues have been addressed in build 1.0 (2).

— 2.1(a) Browser redirect after code confirmation
  The previous build used a Supabase action_link to verify the reviewer
  account, which navigated the WebView to a supabase.co URL and caused
  the system to open Safari. We replaced that flow: the verification
  endpoint now returns a token hash, and the app calls
  supabase.auth.verifyOtp({ token_hash }) directly. The session is
  created in place — no navigation, no external browser. Verified on
  iPad Air 11" simulator (iPadOS 26.5).

— 2.3.10 Non-iOS status bar in screenshots
  The previous screenshots included a mock status bar. All 6 iPhone /
  iPad screenshots have been re-rendered without any status bar
  imagery and re-uploaded.

Reviewer credentials are unchanged:
  Email: apple-review@swingandsavor.at
  Code:  87654321

Thank you for the time spent re-reviewing.
Best,
Rainer Roloff
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
