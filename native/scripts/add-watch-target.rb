#!/usr/bin/env ruby
# frozen_string_literal: true

# Idempotently attach the SwingSavorWatch single-target watchOS app to
# native/ios/App/App.xcodeproj, link sources & assets, and embed the watch
# product into the iOS App target.
#
# Run once after fresh `cap add ios` or when the watch target was removed:
#   ruby native/scripts/add-watch-target.rb
#
# Requires the xcodeproj gem: `gem install --user-install xcodeproj`

require 'xcodeproj'
require 'fileutils'
require 'pathname'

REPO = Pathname.new(__dir__).join('..').realpath
PROJECT_PATH = REPO.join('ios', 'App', 'App.xcodeproj')
WATCH_SRC_DIR = REPO.join('ios', 'SwingSavorWatch')
WATCH_TARGET_NAME = 'SwingSavorWatch'
WATCH_PRODUCT_BUNDLE_ID = 'de.commsconnect.swingandsavor.watchkitapp'
IOS_APP_TARGET_NAME = 'App'
IOS_APP_BUNDLE_ID = 'de.commsconnect.swingandsavor'

DETACH_MODE = ARGV.include?('--detach')

unless PROJECT_PATH.exist?
  warn "Xcode project not found: #{PROJECT_PATH}"
  exit 1
end

project = Xcodeproj::Project.open(PROJECT_PATH.to_s)
ios_target = project.targets.find { |t| t.name == IOS_APP_TARGET_NAME } or abort "iOS target #{IOS_APP_TARGET_NAME} missing"

if DETACH_MODE
  existing = project.targets.find { |t| t.name == WATCH_TARGET_NAME }
  if existing.nil?
    puts "[=] No #{WATCH_TARGET_NAME} target to detach — nothing to do."
    exit 0
  end
  # Remove the embed phase entries pointing at the watch product
  ios_target.copy_files_build_phases.each do |ph|
    next unless ph.name == 'Embed Watch Content'
    ph.files.dup.each { |bf| ph.remove_build_file(bf) if bf.file_ref == existing.product_reference }
    ph.remove_from_project if ph.files.empty?
  end
  # Remove dependency
  ios_target.dependencies.dup.each do |dep|
    dep.remove_from_project if dep.target == existing
  end
  existing.remove_from_project
  project.save
  puts "[OK] Detached #{WATCH_TARGET_NAME} target from #{PROJECT_PATH.basename} (iOS-only build will be produced)."
  exit 0
end
team_id = ios_target.build_configurations.first.build_settings['DEVELOPMENT_TEAM']
marketing_version = ios_target.build_configurations.first.build_settings['MARKETING_VERSION'] || '1.0.0'
project_version = ios_target.build_configurations.first.build_settings['CURRENT_PROJECT_VERSION'] || '1'

# --- 1. Target ---
watch_target = project.targets.find { |t| t.name == WATCH_TARGET_NAME }
if watch_target.nil?
  puts "[+] Creating watchOS target #{WATCH_TARGET_NAME}"
  watch_target = project.new_target(:application, WATCH_TARGET_NAME, :watchos, '10.0', project.products_group, :swift)
end

# --- 2. Build settings ---
# Env vars (set in CI) override Xcode defaults so codesigning works without manual GUI fiddling.
ci_team_id      = ENV['APPLE_TEAM_ID'] || team_id
ci_watch_profile = ENV['IOS_WATCH_PROFILE_NAME'] # e.g. "Swing and Savor v1.0 WatchKit App Store"

watch_target.build_configurations.each do |cfg|
  s = cfg.build_settings
  s['PRODUCT_NAME']                       = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER']          = WATCH_PRODUCT_BUNDLE_ID
  s['INFOPLIST_FILE']                     = '../SwingSavorWatch/Info.plist'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['WATCHOS_DEPLOYMENT_TARGET']          = '10.0'
  s['TARGETED_DEVICE_FAMILY']             = '4'
  s['SDKROOT']                            = 'watchos'
  s['SUPPORTED_PLATFORMS']                = 'watchsimulator watchos'
  s['SWIFT_VERSION']                      = '5.0'
  s['MARKETING_VERSION']                  = marketing_version
  s['CURRENT_PROJECT_VERSION']            = project_version
  s['DEVELOPMENT_TEAM']                   = ci_team_id if ci_team_id
  s['CODE_SIGN_STYLE']                    = 'Manual'
  s['GENERATE_INFOPLIST_FILE']            = 'NO'
  s['ENABLE_PREVIEWS']                    = 'YES'
  s['SKIP_INSTALL']                       = 'NO'
  s['IPHONEOS_DEPLOYMENT_TARGET']         = nil  # watchOS target should not carry iOS deployment target
  s['LD_RUNPATH_SEARCH_PATHS']            = '$(inherited) @executable_path/Frameworks'
  if cfg.name == 'Release' && ci_watch_profile
    s['CODE_SIGN_IDENTITY']               = 'Apple Distribution'
    s['PROVISIONING_PROFILE_SPECIFIER']   = ci_watch_profile
  end
end

# --- 3. Source files ---
group = project.main_group.find_subpath('SwingSavorWatch', true)
group.set_source_tree('<group>')
group.set_path('../SwingSavorWatch')

# Wipe out the group's children we manage so the script stays idempotent.
managed_basenames = %w[
  SwingSavorWatchApp.swift WatchMatch.swift MatchStore.swift
  ContentView.swift MatchSummaryView.swift ScoreEntryView.swift
  Info.plist Assets.xcassets
]

# Remove existing references for managed files so we can re-add cleanly.
group.children.dup.each do |child|
  group.children.delete(child) if managed_basenames.include?(child.display_name) || managed_basenames.include?(child.name)
end

# Drop any orphaned build files referencing the watch sources.
watch_target.source_build_phase.files.dup.each { |bf| bf.remove_from_project if bf.file_ref.nil? || bf.file_ref.parent.nil? }
watch_target.resources_build_phase.files.dup.each { |bf| bf.remove_from_project if bf.file_ref.nil? || bf.file_ref.parent.nil? }

swift_sources = %w[
  SwingSavorWatchApp.swift WatchMatch.swift MatchStore.swift
  ContentView.swift MatchSummaryView.swift ScoreEntryView.swift
]
swift_sources.each do |fname|
  ref = group.new_reference(fname)
  watch_target.add_file_references([ref])
end

# Resources: Info.plist (not added to phase, just referenced), Assets.xcassets
info_ref = group.new_reference('Info.plist')
info_ref.last_known_file_type = 'text.plist.xml'

assets_ref = group.new_reference('Assets.xcassets')
assets_ref.last_known_file_type = 'folder.assetcatalog'
watch_target.resources_build_phase.add_file_reference(assets_ref, true)

# --- 4. Embed the watch product into the iOS app ---
embed_phase = ios_target.copy_files_build_phases.find { |ph| ph.name == 'Embed Watch Content' }
if embed_phase.nil?
  embed_phase = ios_target.new_copy_files_build_phase('Embed Watch Content')
  embed_phase.dst_subfolder_spec = '16' # WATCH_APPS in watchOS embed terms
  embed_phase.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
end

product_ref = watch_target.product_reference
already_embedded = embed_phase.files.any? { |bf| bf.file_ref == product_ref }
unless already_embedded
  bf = embed_phase.add_file_reference(product_ref, true)
  bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

# Make sure the iOS app target builds the watch first.
ios_deps = ios_target.dependencies.map { |d| d.target&.name }
unless ios_deps.include?(WATCH_TARGET_NAME)
  ios_target.add_dependency(watch_target)
end

# --- 5. Wire the WatchBridge Capacitor plugin into the iOS App target ---
# Files live at native/ios/App/App/Plugins/{WatchBridge.swift,WatchBridge.m}
ios_app_group = project.main_group.find_subpath('App', false)
plugins_group = ios_app_group&.find_subpath('Plugins', true) || project.main_group.find_subpath('App/Plugins', true)
plugins_group.set_source_tree('<group>')
plugins_group.set_path('Plugins') if plugins_group.path.nil?

%w[WatchBridge.swift WatchBridge.m].each do |fname|
  # Remove duplicate entries first
  plugins_group.children.dup.each do |c|
    plugins_group.children.delete(c) if c.display_name == fname
  end
  ref = plugins_group.new_reference(fname)

  # Drop existing build phase entries to avoid double-listing
  ios_target.source_build_phase.files.dup.each do |bf|
    next unless bf.file_ref && bf.file_ref.display_name == fname
    ios_target.source_build_phase.remove_build_file(bf)
  end
  ios_target.source_build_phase.add_file_reference(ref, true)
end

project.save
puts "[OK] #{WATCH_TARGET_NAME} attached to #{PROJECT_PATH.basename}"
puts "    bundle-id: #{WATCH_PRODUCT_BUNDLE_ID}"
puts "    sources:   #{swift_sources.size} swift files + Assets.xcassets"
puts "    embedded:  Yes — runs as a Watch app companion to #{IOS_APP_BUNDLE_ID}"
