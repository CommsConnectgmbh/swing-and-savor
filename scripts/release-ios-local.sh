#!/usr/bin/env bash
#
# release-ios-local.sh — build + sign + upload the Swing & Savor iOS app to
# TestFlight from a local Mac, replacing the GitHub Actions release workflow.
#
# Why local instead of CI: the always-on Mac mini has everything the Action had
# (Xcode, the distribution cert in the keychain, the ASC API key, and — unlike CI —
# working SSH access to the private QuickLaunchKit package). CI would additionally
# need a `workflow`-scope token (blocked by the org's OAuth-app restriction) and a
# CI deploy key, for no real benefit.
#
# Requirements on this machine (all already present, see .apple-bootstrap/secrets):
#   - Xcode + "iPhone Distribution: Comms Connect GmbH" identity in the login keychain
#   - SSH deploy key for olihoffmann/GolfLaunchMonitor (ssh alias glm.github.com +
#     git insteadOf rewrite) so SPM can resolve QuickLaunchKit
#   - ASC API env vars (ASC_KEY_ID/ISSUER_ID/API_KEY_PATH _SWINGSAVOR)
#
# Usage:
#   scripts/release-ios-local.sh <marketing_version> <build_number> [--no-upload]
#   e.g. scripts/release-ios-local.sh 1.2.1 19
#
# Notes:
#   - iOS-only (the Watch target is not embedded in the committed project, which
#     also sidesteps the Xcode 26 multi-target -exportArchive bug).
#   - Signing settings are injected only for this build and NOT committed.
#   - -exportArchive is bypassed: Xcode 26 fails it ("Copy failed" /
#     IDEDistributionMethodManager). The archived .app is already distribution-signed,
#     so we package Payload/App.ipa by hand — same trick as patch-ios-project.mjs.
set -euo pipefail

VERSION="${1:?marketing version required, e.g. 1.2.1}"
BUILD="${2:?build number required, e.g. 19}"
UPLOAD=1
[ "${3:-}" = "--no-upload" ] && UPLOAD=0

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROJ="$REPO/native/ios/App"
BOOT="$REPO/.apple-bootstrap"
WORK="$(mktemp -d)"
TEAM_ID="U7CT3BQ7HY"
BUNDLE_ID="de.commsconnect.swingandsavor"
PROFILE_NAME="Swing and Savor v1.0 App Store"
SIGN_ID="iPhone Distribution: Comms Connect GmbH (U7CT3BQ7HY)"
export GIT_SSH_COMMAND="ssh -o ControlMaster=no -o ControlPath=none -o StrictHostKeyChecking=accept-new"

echo "▸ Fetching current provisioning profile from ASC…"
PROFILE="$WORK/SwingSavor_AppStore.mobileprovision"
( cd "$BOOT" && node fetch-profile.js "" "$PROFILE" )   # resolves the active profile by name/ID
UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' /dev/stdin <<< "$(security cms -D -i "$PROFILE")")"
cp "$PROFILE" "$HOME/Library/MobileDevice/Provisioning Profiles/$UUID.mobileprovision"
echo "  installed profile $UUID"

echo "▸ Injecting signing + version onto the App target (local only)…"
ruby -e "
require 'xcodeproj'
p = Xcodeproj::Project.open('$APP_PROJ/App.xcodeproj')
app = p.targets.find { |t| t.name == 'App' }
app.build_configurations.each do |c|
  c.build_settings['MARKETING_VERSION'] = '$VERSION'
  c.build_settings['CURRENT_PROJECT_VERSION'] = '$BUILD'
  next unless c.name == 'Release'
  c.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  c.build_settings['DEVELOPMENT_TEAM'] = '$TEAM_ID'
  c.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = '$PROFILE_NAME'
  c.build_settings['CODE_SIGN_IDENTITY'] = '$SIGN_ID'
end
p.save
"
# always restore the committed project on exit (signing/version stay uncommitted)
trap 'git -C "$REPO" checkout -- native/ios/App/App.xcodeproj/project.pbxproj 2>/dev/null; rm -rf "$WORK"' EXIT

echo "▸ Archiving (Release, generic/iOS, iOS-only)…"
xcodebuild -workspace "$APP_PROJ/App.xcworkspace" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$WORK/SwingSavor.xcarchive" archive

APP="$WORK/SwingSavor.xcarchive/Products/Applications/App.app"
codesign --verify --deep --strict "$APP"
echo "  signed: $(codesign -dvvv "$APP" 2>&1 | grep '^Authority=' | head -1)"

echo "▸ Packaging IPA by hand (Xcode 26 exportArchive workaround)…"
mkdir -p "$WORK/export/Payload"
cp -R "$APP" "$WORK/export/Payload/"
( cd "$WORK/export" && zip -qry SwingSavor.ipa Payload && rm -rf Payload )
IPA="$WORK/export/SwingSavor.ipa"
echo "  IPA: $IPA ($(du -h "$IPA" | cut -f1))"

if [ "$UPLOAD" = "1" ]; then
  echo "▸ Uploading to App Store Connect / TestFlight…"
  ISSUER="$(cd "$BOOT" && node -e "console.log(require('./lib/asc-env.js').resolveSwingSavorAsc().issuerId)")"
  KEY_ID="$(cd "$BOOT" && node -e "console.log(require('./lib/asc-env.js').resolveSwingSavorAsc().keyId)")"
  xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
  echo "✅ Uploaded $VERSION ($BUILD). Processing on Apple's side (~5–15 min) → TestFlight."
else
  echo "✅ Built + signed $VERSION ($BUILD), no upload (--no-upload). IPA at: $IPA"
  cp "$IPA" "$REPO/SwingSavor-$VERSION-$BUILD.ipa" && echo "   copied to $REPO/SwingSavor-$VERSION-$BUILD.ipa"
fi
