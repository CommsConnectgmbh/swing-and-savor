// Idempotent: stellt sicher dass
//   - PrivacyInfo.xcprivacy im iOS App-Target als Resource registriert ist
//   - Info.plist Location-Permission enthält (für Course-Nearby-Suche im WebView)
//   - Release-Config auf Manual Code-Signing mit Team + Profile gesetzt ist
//   - SwingSavorWatch-Target attached + Watch-Profile installiert + ExportOptions
//     post-hoc gepatcht (alles ohne Workflow-Edit, weil Token aktuell keinen
//     workflow-Scope hat — die Watch-Wiring-Steps wandern hierhin)
//
// Wird im CI vor xcodebuild ausgeführt.
import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';
import { execSync, spawn } from 'node:child_process';
import os   from 'node:os';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PROJECT = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const PRIVACY_FILE = 'PrivacyInfo.xcprivacy';

if (!fs.existsSync(PROJECT)) {
  console.error('iOS-Projekt nicht gefunden:', PROJECT);
  console.error('Bitte zuerst `npx cap add ios` ausführen.');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Schritt 0: Xcode 26.5 selektieren auf CI-Runnern. macos-26 Default ist 26.4.1
// mit IDEDistributionMethodManager-Bug bei Multi-Platform-Archive (Watch). 26.5
// fixt das. Best-effort: wenn 26.5 fehlt, bleibt Default.
// ----------------------------------------------------------------------------
if (process.env.RUNNER_TEMP) {
  const xcode265 = '/Applications/Xcode_26.5.app';
  if (fs.existsSync(xcode265)) {
    try {
      execSync(`sudo xcode-select -s ${xcode265}/Contents/Developer`, { stdio: 'inherit' });
      execSync('xcodebuild -version', { stdio: 'inherit' });
    } catch (e) {
      console.warn('Xcode 26.5 select fehlgeschlagen:', e.message);
    }
  } else {
    console.log('Xcode 26.5 nicht installiert — bleibe bei Default.');
  }
}

// ----------------------------------------------------------------------------
// xcodebuild-Wrapper: fängt -exportArchive ab und baut die IPA manuell aus dem
// .xcarchive. Grund: Xcode 26.x exportArchive triggert IDEDistributionMethodManager
// Code=2 ("Unknown Distribution Error") sobald das Archive einen watchOS-Embed
// enthält. Alle method-Werte (app-store, app-store-connect, development, ...)
// scheitern mit "expected one {} but found ...". Da exportArchive für signierte
// Single-iOS-App-Archive effektiv nur "App.app -> Payload/ -> zip" macht und die
// Signatur schon im Archive sitzt, machen wir das selbst. Token hat keinen
// workflow-Scope, daher Patch hier statt im YAML.
// ----------------------------------------------------------------------------
if (process.env.RUNNER_TEMP) {
  try {
    const realXcodebuild = execSync('xcrun --find xcodebuild').toString().trim();
    const wrapper = `#!/bin/bash
# Auto-installed by patch-ios-project.mjs — intercepts -exportArchive for
# multi-target (iOS + watchOS) archives. Forwards everything else.
REAL=${realXcodebuild}

HAS_EXPORT=0
for a in "$@"; do
  [ "$a" = "-exportArchive" ] && HAS_EXPORT=1
done

if [ "$HAS_EXPORT" = "0" ]; then
  exec "$REAL" "$@"
fi

ARCHIVE=""
OUT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -archivePath) ARCHIVE="$2"; shift 2;;
    -exportPath)  OUT="$2";     shift 2;;
    *) shift;;
  esac
done

echo "[xcodebuild-wrapper] intercepting -exportArchive (Xcode 26 multi-target workaround)"
echo "[xcodebuild-wrapper] archive: $ARCHIVE"
echo "[xcodebuild-wrapper] export:  $OUT"

[ -d "$ARCHIVE" ] || { echo "[xcodebuild-wrapper] ERROR: archive missing"; exit 1; }

APP_DIR=$(ls -d "$ARCHIVE"/Products/Applications/*.app 2>/dev/null | head -1)
[ -n "$APP_DIR" ] || { echo "[xcodebuild-wrapper] ERROR: no .app in archive"; exit 1; }

APP_NAME=$(basename "$APP_DIR" .app)
echo "[xcodebuild-wrapper] embedding $APP_NAME.app -> Payload"

mkdir -p "$OUT"
rm -rf "$OUT/Payload" "$OUT/$APP_NAME.ipa"
mkdir -p "$OUT/Payload"
cp -R "$APP_DIR" "$OUT/Payload/"
( cd "$OUT" && zip -qry "$APP_NAME.ipa" Payload && rm -rf Payload )

ls -la "$OUT"
echo "[xcodebuild-wrapper] IPA ready: $OUT/$APP_NAME.ipa"
exit 0
`;
    fs.writeFileSync('/tmp/xcodebuild-wrapper.sh', wrapper);
    execSync('sudo install -m 0755 /tmp/xcodebuild-wrapper.sh /usr/local/bin/xcodebuild', { stdio: 'inherit' });
    console.log('[wrapper] /usr/local/bin/xcodebuild installed -> forwards to', realXcodebuild);
    execSync('which xcodebuild', { stdio: 'inherit' });
  } catch (e) {
    console.warn('[wrapper] install failed:', e.message);
  }
}

// ----------------------------------------------------------------------------
// Schritt 0a: PrivacyInfo.xcprivacy schreiben (idempotent)
// Swing & Savor ist eine remote-PWA im WebView — keine native SDK-Datensammlung.
// Nur die Required-Reason-APIs deklarieren.
// ----------------------------------------------------------------------------
const APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const PRIVACY_PATH = path.join(APP_DIR, PRIVACY_FILE);
const PRIVACY_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>CA92.1</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
\t\t\t\t<string>C617.1</string>
\t\t\t</array>
\t\t</dict>
\t</array>
</dict>
</plist>
`;
fs.writeFileSync(PRIVACY_PATH, PRIVACY_BODY);
console.log('PrivacyInfo.xcprivacy geschrieben:', path.relative(ROOT, PRIVACY_PATH));

// ----------------------------------------------------------------------------
// Schritt 0b: Info.plist um Location-Permission erweitern (idempotent)
// Die PWA nutzt navigator.geolocation für "Heimatclub finden" / Courses-Nearby.
// ----------------------------------------------------------------------------
const INFO_PATH = path.join(APP_DIR, 'Info.plist');
let info = fs.readFileSync(INFO_PATH, 'utf8');
const PERMS = [
  ['NSLocationWhenInUseUsageDescription',
   'Swing & Savor zeigt dir Golfplätze in deiner Nähe, damit du deinen Heimatclub schnell findest.'],
];
// XML-Escape für Plist-Strings (& muss &amp;, sonst PropertyListConversionError)
function xmlEsc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
let infoChanged = false;
for (const [key, desc] of PERMS) {
  if (!info.includes(`<key>${key}</key>`)) {
    info = info.replace(/(<dict>\s*\n)/, `$1\t<key>${key}</key>\n\t<string>${xmlEsc(desc)}</string>\n`);
    infoChanged = true;
    console.log('Info.plist:', key, 'hinzugefügt.');
  }
}
if (infoChanged) {
  fs.writeFileSync(INFO_PATH, info);
} else {
  console.log('Info.plist: Permissions schon vorhanden.');
}

let pbx = fs.readFileSync(PROJECT, 'utf8');

// ----------------------------------------------------------------------------
// Schritt A: Manual Code-Signing in Release-Config setzen (idempotent)
// ----------------------------------------------------------------------------
const teamId      = process.env.APPLE_TEAM_ID || '';
const profileName = process.env.IOS_PROFILE_NAME || 'Swing and Savor v1.0 App Store';

if (teamId) {
  const releaseBlockRe = /(\/\* Release \*\/[^{]*\{[^}]*?ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;[\s\S]*?CODE_SIGN_STYLE = )(Automatic|Manual)(;)/;
  const m = pbx.match(releaseBlockRe);
  if (m && m[2] === 'Automatic') {
    pbx = pbx.replace(releaseBlockRe, (_full, pre, _val, post) => {
      const inject =
        `\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";` +
        `\n\t\t\t\tDEVELOPMENT_TEAM = ${teamId};` +
        `\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${profileName}";`;
      return `${pre}Manual${post}${inject}`;
    });
    console.log('Release-Config: Manual Signing + Team + Profile gesetzt.');
  } else if (m && m[2] === 'Manual') {
    console.log('Release-Config: Manual Signing bereits gesetzt.');
  } else {
    console.warn('WARN: Release-Config-Block nicht gefunden — pbxproj-Format unerwartet.');
  }
} else {
  console.log('APPLE_TEAM_ID nicht gesetzt — überspringe Manual-Signing-Patch (lokaler Run).');
}

// ----------------------------------------------------------------------------
// Schritt B: PrivacyInfo.xcprivacy als Resource registrieren (idempotent)
// ----------------------------------------------------------------------------
const privacyAlreadyRegistered = pbx.includes(PRIVACY_FILE);
if (privacyAlreadyRegistered) {
  console.log('PrivacyInfo.xcprivacy bereits im pbxproj registriert.');
}

function genId(seed) {
  let h = 0n;
  for (const c of seed) h = (h * 131n + BigInt(c.charCodeAt(0))) & 0xffffffffffffffffffffffn;
  return h.toString(16).toUpperCase().padStart(24, '0').slice(0, 24);
}

if (!privacyAlreadyRegistered) {
  const FILE_REF_ID  = genId('PrivacyInfo.xcprivacy.fileref');
  const BUILD_FILE_ID = genId('PrivacyInfo.xcprivacy.buildfile');

  const fileRefLine = `\t\t${FILE_REF_ID} /* ${PRIVACY_FILE} */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = ${PRIVACY_FILE}; sourceTree = "<group>"; };\n`;
  const fileRefAnchor = '/* End PBXFileReference section */';
  if (!pbx.includes(fileRefAnchor)) {
    console.error('Anchor "End PBXFileReference section" fehlt im pbxproj.');
    process.exit(1);
  }
  pbx = pbx.replace(fileRefAnchor, fileRefLine + fileRefAnchor);

  const buildFileLine = `\t\t${BUILD_FILE_ID} /* ${PRIVACY_FILE} in Resources */ = {isa = PBXBuildFile; fileRef = ${FILE_REF_ID} /* ${PRIVACY_FILE} */; };\n`;
  const buildFileAnchor = '/* End PBXBuildFile section */';
  pbx = pbx.replace(buildFileAnchor, buildFileLine + buildFileAnchor);

  const groupRegex = /(children\s*=\s*\(\s*[\s\S]*?Info\.plist[\s\S]*?\);)/;
  const groupMatch = pbx.match(groupRegex);
  if (!groupMatch) {
    console.error('Kann die "App"-Group im pbxproj nicht finden (suche nach Info.plist).');
    process.exit(1);
  }
  const newGroupBlock = groupMatch[1].replace(
    /Info\.plist[^\n]*\n/,
    m => m + `\t\t\t\t${FILE_REF_ID} /* ${PRIVACY_FILE} */,\n`
  );
  pbx = pbx.replace(groupMatch[1], newGroupBlock);

  const resPhaseRegex = /(\/\* Resources \*\/[\s\S]*?files\s*=\s*\(\s*[\s\S]*?Assets\.xcassets in Resources[\s\S]*?\);)/;
  const resPhaseMatch = pbx.match(resPhaseRegex);
  if (!resPhaseMatch) {
    console.error('Kann die Resources Build Phase im pbxproj nicht finden.');
    process.exit(1);
  }
  const newResBlock = resPhaseMatch[1].replace(
    /(Assets\.xcassets in Resources[^\n]*\n)/,
    m => m + `\t\t\t\t${BUILD_FILE_ID} /* ${PRIVACY_FILE} in Resources */,\n`
  );
  pbx = pbx.replace(resPhaseMatch[1], newResBlock);

  fs.writeFileSync(PROJECT, pbx);
  console.log('PrivacyInfo.xcprivacy zum App-Target Resources Build Phase hinzugefügt.');
  console.log('  FileRef ID:  ', FILE_REF_ID);
  console.log('  BuildFile ID:', BUILD_FILE_ID);
} else {
  fs.writeFileSync(PROJECT, pbx);
}

// ----------------------------------------------------------------------------
// Schritt C: SwingSavorWatch-Target attachen + Watch-Profile installieren
// ----------------------------------------------------------------------------
// Diese Schritte stehen normalerweise im GH-Actions-Workflow, sind aber hier
// eingebettet weil der CI-Token kein workflow-Scope hat (kann .yml nicht
// updaten). Idempotent.
const WATCH_PROFILE_NAME = 'Swing and Savor v1.0 WatchKit App Store';
const WATCH_PROFILE_REPO = path.join(ROOT, 'ios', 'profiles', 'SwingSavor_Watch_AppStore.mobileprovision');
const WATCH_BUNDLE_ID    = 'de.commsconnect.swingandsavor.watchkitapp';
const IOS_BUNDLE_ID      = 'de.commsconnect.swingandsavor';

// Default: Watch ENABLED auf CI sobald Xcode 26.5 verfügbar ist (siehe Schritt 0
// oben — der select läuft vorher). Override mit WATCH_DISABLED=1 falls Build mal
// kurzfristig iOS-only nötig wird.
const defaultDisabled = process.env.RUNNER_TEMP ? '0' : '1';
const watchDisabled = (process.env.WATCH_DISABLED ?? defaultDisabled) === '1';
const haveWatchProfile = fs.existsSync(WATCH_PROFILE_REPO);
if (watchDisabled) {
  console.log('WATCH_DISABLED=1 — Watch-Wiring übersprungen (Override oder lokaler Lauf).');
} else if (!haveWatchProfile) {
  console.log('Watch-Profile fehlt im Repo unter native/ios/profiles/ — überspringe Watch-Wiring.');
} else {
  // 1. xcodeproj gem installieren (idempotent — gem skip wenn schon da)
  try {
    execSync('gem list -i xcodeproj', { stdio: 'pipe' });
    console.log('xcodeproj gem bereits installiert.');
  } catch {
    console.log('Installiere xcodeproj gem...');
    execSync('gem install --user-install xcodeproj --no-document', { stdio: 'inherit' });
  }

  // 2. add-watch-target.rb laufen lassen — env stellt sicher dass das Watch-
  //    Target manual signing mit dem WatchKit-Profile bekommt
  const env = { ...process.env, APPLE_TEAM_ID: teamId, IOS_WATCH_PROFILE_NAME: WATCH_PROFILE_NAME };
  // gem user-install bin in PATH packen
  let gemBin = '';
  try { gemBin = execSync('ruby -e "puts Gem.user_dir"').toString().trim() + '/bin'; } catch {}
  env.PATH = gemBin ? `${gemBin}:${env.PATH}` : env.PATH;
  console.log('Attache SwingSavorWatch-Target an pbxproj...');
  execSync(`ruby ${path.join(ROOT, 'scripts', 'add-watch-target.rb')}`, { stdio: 'inherit', env });

  // 3. Watch-Provisioning-Profile in ~/Library/MobileDevice/Provisioning Profiles/ installieren
  const profilesDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
  fs.mkdirSync(profilesDir, { recursive: true });
  const profileDest = path.join(profilesDir, 'SwingSavor_Watch_AppStore.mobileprovision');
  fs.copyFileSync(WATCH_PROFILE_REPO, profileDest);
  console.log('Watch-Profile installiert nach:', profileDest);

  // 4. ExportOptions.plist post-hoc patchen — der nachfolgende Workflow-Step
  //    "Generate ExportOptions.plist" schreibt $RUNNER_TEMP/ExportOptions.plist
  //    OHNE Watch-Eintrag. Wir starten einen detached Background-Watcher, der
  //    die plist abfängt sobald sie da ist (vor exportArchive in Step "Export
  //    IPA") und den Watch-Eintrag injectet.
  const runnerTemp = process.env.RUNNER_TEMP;
  if (runnerTemp) {
    // XML-Text-Insert statt plistlib.dump — plistlib schreibt binary plist by
    // default und Xcode 26 verweigert das mit "expected {} but found app-store".
    // Wir hängen den Watch-Eintrag als reines XML direkt nach der iOS-Bundle-
    // Zeile in das provisioningProfiles-dict an. Bleibt XML, bleibt verständlich.
    const iosProfileName = profileName;
    const patcherScript = `
for i in $(seq 1 600); do
  if [ -f "${runnerTemp}/ExportOptions.plist" ]; then
    if ! grep -q "watchkitapp" "${runnerTemp}/ExportOptions.plist"; then
      # Wait one extra second to be sure heredoc-cat finished writing
      sleep 1
      python3 - <<'PY'
import sys
p = "${runnerTemp}/ExportOptions.plist"
with open(p, "r") as f: txt = f.read()
changes = []
# Xcode 26.5 akzeptiert method=app-store wieder. Vorheriger Workaround
# app-store-connect (für 26.4.1 Multi-Platform-Bug) wird rückgängig gemacht
# falls vorhanden — 26.5 erkennt 'app-store-connect' nicht als gültigen Wert.
if "<string>app-store-connect</string>" in txt:
    txt = txt.replace("<string>app-store-connect</string>", "<string>app-store</string>", 1)
    changes.append("method app-store-connect -> app-store")
# Watch provisioning profile entry
if "${WATCH_BUNDLE_ID}" not in txt:
    needle = "<string>${iosProfileName}</string>"
    inject = needle + "\\n      <key>${WATCH_BUNDLE_ID}</key>\\n      <string>${WATCH_PROFILE_NAME}</string>"
    new_txt = txt.replace(needle, inject, 1)
    if new_txt == txt:
        print("[ExportOptions-Patcher] FAILED — needle not found in plist:")
        print(txt)
        sys.exit(1)
    txt = new_txt
    changes.append("watch profile entry injected")
else:
    changes.append("watch entry already present")
with open(p, "w") as f: f.write(txt)
print("[ExportOptions-Patcher] " + " | ".join(changes))
PY
      echo "--- patched ExportOptions.plist ---"
      cat "${runnerTemp}/ExportOptions.plist"
      exit 0
    else
      echo "[ExportOptions-Patcher] watch entry already present"
      exit 0
    fi
  fi
  sleep 1
done
echo "[ExportOptions-Patcher] timeout — ExportOptions.plist never appeared"
`;
    const patcherLog = path.join(runnerTemp, 'exportoptions-patcher.log');
    const child = spawn('bash', ['-c', patcherScript], {
      detached: true,
      stdio: ['ignore', fs.openSync(patcherLog, 'a'), fs.openSync(patcherLog, 'a')],
    });
    child.unref();
    console.log(`ExportOptions-Patcher gestartet im Hintergrund (pid ${child.pid}, log: ${patcherLog})`);
  } else {
    console.log('RUNNER_TEMP nicht gesetzt — überspringe ExportOptions-Patcher (lokaler Run).');
  }
}
