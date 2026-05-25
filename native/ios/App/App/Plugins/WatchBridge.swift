import Foundation
import Capacitor
import WatchConnectivity

@objc(WatchBridgePlugin)
public class WatchBridgePlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "WatchBridgePlugin"
    public let jsName = "WatchBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "publishMatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearMatch", returnType: CAPPluginReturnPromise),
    ]

    private var session: WCSession?

    override public func load() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        session = s
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        guard WCSession.isSupported(), let s = session else {
            call.resolve(["available": false, "reason": "unsupported"])
            return
        }
        call.resolve([
            "available": s.activationState == .activated && s.isPaired && s.isWatchAppInstalled,
            "paired": s.isPaired,
            "installed": s.isWatchAppInstalled,
            "reachable": s.isReachable,
        ])
    }

    @objc func publishMatch(_ call: CAPPluginCall) {
        guard let s = session, s.activationState == .activated else {
            call.reject("session not active")
            return
        }
        guard let payload = call.options as? [String: Any] else {
            call.reject("invalid payload")
            return
        }
        let context = sanitizeForWC(payload)
        do {
            try s.updateApplicationContext(context)
            if s.isReachable {
                s.sendMessage(["kind": "match", "payload": context], replyHandler: nil) { _ in }
            }
            call.resolve(["ok": true])
        } catch {
            call.reject("updateApplicationContext failed: \(error.localizedDescription)")
        }
    }

    @objc func clearMatch(_ call: CAPPluginCall) {
        guard let s = session, s.activationState == .activated else {
            call.resolve(["ok": false])
            return
        }
        do {
            try s.updateApplicationContext(["kind": "clear"])
            if s.isReachable {
                s.sendMessage(["kind": "clear"], replyHandler: nil) { _ in }
            }
            call.resolve(["ok": true])
        } catch {
            call.reject("clear failed: \(error.localizedDescription)")
        }
    }

    private func sanitizeForWC(_ raw: [String: Any]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in raw {
            if v is NSNull { continue }
            out[k] = v
        }
        out["_ts"] = Date().timeIntervalSince1970
        return out
    }

    // MARK: - WCSessionDelegate

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let e = error {
            CAPLog.print("[WatchBridge] activation error: \(e.localizedDescription)")
        }
    }

    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleIncoming(message)
        replyHandler(["ok": true])
    }

    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleIncoming(applicationContext)
    }

    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleIncoming(userInfo)
    }

    private func handleIncoming(_ message: [String: Any]) {
        guard let kind = message["kind"] as? String else { return }
        if kind == "score" {
            notifyListeners("watchScoreEntered", data: message)
        } else if kind == "request-refresh" {
            notifyListeners("watchRequestedRefresh", data: [:])
        }
    }
}
