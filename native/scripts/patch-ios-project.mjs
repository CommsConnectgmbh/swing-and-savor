// Idempotent: stellt sicher dass
//   - PrivacyInfo.xcprivacy im iOS App-Target als Resource registriert ist
//   - Info.plist Location-Permission enthält (für Course-Nearby-Suche im WebView)
//   - Release-Config auf Manual Code-Signing mit Team + Profile gesetzt ist
//
// Wird im CI vor xcodebuild ausgeführt.
import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PROJECT = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const PRIVACY_FILE = 'PrivacyInfo.xcprivacy';

if (!fs.existsSync(PROJECT)) {
  console.error('iOS-Projekt nicht gefunden:', PROJECT);
  console.error('Bitte zuerst `npx cap add ios` ausführen.');
  process.exit(1);
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
if (pbx.includes(PRIVACY_FILE)) {
  console.log('PrivacyInfo.xcprivacy bereits im pbxproj registriert.');
  fs.writeFileSync(PROJECT, pbx);
  process.exit(0);
}

function genId(seed) {
  let h = 0n;
  for (const c of seed) h = (h * 131n + BigInt(c.charCodeAt(0))) & 0xffffffffffffffffffffffn;
  return h.toString(16).toUpperCase().padStart(24, '0').slice(0, 24);
}
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
