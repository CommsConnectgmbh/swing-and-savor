// Bridges the React app to the iOS LaunchMonitorBridge Capacitor plugin, which
// presents the embedded QuickLaunch (GolfLaunchMonitor) AR launch-monitor as a
// Pro feature. No-ops cleanly on web and Android — the engine requires a
// LiDAR-equipped iPhone (iPhone 12 Pro or later) and only exists on iOS.

const W = typeof window !== 'undefined' ? window : null
const Capacitor = W?.Capacitor
const isNativeIOS = !!Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === 'ios'

function plugin() {
  if (!isNativeIOS) return null
  return Capacitor.Plugins?.LaunchMonitorBridge || null
}

// True only inside the iOS native shell. Web/Android always false.
export function launchMonitorPlatformSupported() {
  return !!plugin()
}

// Ask the native layer whether THIS device can run the launch monitor
// (LiDAR / ARKit scene depth). Returns { supported, reason }.
//   reason: 'ok' | 'requires-lidar' | 'not-ios' | 'probe-failed'
export async function probeLaunchMonitor() {
  const p = plugin()
  if (!p) return { supported: false, reason: 'not-ios' }
  try {
    return await p.isSupported()
  } catch (e) {
    return { supported: false, reason: e?.message || 'probe-failed' }
  }
}

// Present the full-screen SwiftUI capture UI. `isPro` is the resolved entitlement
// from the web layer (see proAccess.js); the native plugin re-checks it.
// Rejects with: 'not-available' | 'not_entitled' | 'unsupported_device'
export async function openLaunchMonitor({ isPro } = {}) {
  const p = plugin()
  if (!p) throw new Error('not-available')
  return p.present({ isPro: !!isPro })
}
