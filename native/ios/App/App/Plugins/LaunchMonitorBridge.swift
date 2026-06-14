import Foundation
import Capacitor
import SwiftUI
import ARKit
import QuickLaunchKit

// Bridges the React app to the embedded QuickLaunch (GolfLaunchMonitor) engine,
// which ships as the `QuickLaunchKit` Swift Package (separate repo, added as an
// SPM dependency to this App target — see INTEGRATION_LAUNCH_MONITOR.md).
//
// Two methods:
//   - isSupported(): can this device run the launch monitor at all? (LiDAR/ARKit)
//   - present({ isPro }): present the full-screen SwiftUI capture UI, gated on the
//     caller's Pro entitlement (defense-in-depth — the JS layer also gates).
//
// Registration mirrors WatchBridge: this Swift class + the CAP_PLUGIN macro in
// LaunchMonitorBridge.m. No Capacitor config changes are required.
@objc(LaunchMonitorBridgePlugin)
public class LaunchMonitorBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LaunchMonitorBridgePlugin"
    public let jsName = "LaunchMonitorBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        let supported = QuickLaunchCapability.isSupported
        call.resolve([
            "supported": supported,
            "reason": supported ? "ok" : "requires-lidar",
        ])
    }

    @objc func present(_ call: CAPPluginCall) {
        // Entitlement gate. The JS bridge passes the resolved Pro state; we refuse
        // to present without it so the native surface can't be reached by bypassing
        // the web paywall. NOTE: this trusts the client-resolved flag — see the
        // "Hardening" section of INTEGRATION_LAUNCH_MONITOR.md for server-verified
        // entitlement (signed token) as a follow-up.
        let isPro = call.getBool("isPro") ?? false
        guard isPro else {
            call.reject("not_entitled")
            return
        }
        guard QuickLaunchCapability.isSupported else {
            call.reject("unsupported_device")
            return
        }

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("no_view_controller")
                return
            }
            let host = UIHostingController(rootView: QuickLaunchView())
            host.modalPresentationStyle = .fullScreen
            presenter.present(host, animated: true) {
                call.resolve(["ok": true])
            }
        }
    }
}
