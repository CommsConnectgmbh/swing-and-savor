import Foundation
import WatchConnectivity
import Combine

final class MatchStore: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = MatchStore()

    @Published var match: WatchMatch?
    @Published var isReachable: Bool = false
    @Published var lastSyncAt: Date?

    private let session = WCSession.default

    override init() {
        super.init()
        if WCSession.isSupported() {
            session.delegate = self
            session.activate()
        }
        // Restore last cached match so the watch is usable when launched cold.
        if let cached = Self.loadCache() {
            self.match = cached
        }
    }

    // MARK: - Outgoing

    func sendScore(holeNumber: Int, strokesA: Int, strokesB: Int) {
        guard let m = match else { return }
        // Optimistic local update so the UI stays responsive on the watch.
        if let idx = m.holes.firstIndex(where: { $0.holeNumber == holeNumber }) {
            var newHoles = m.holes
            newHoles[idx].strokesA = strokesA
            newHoles[idx].strokesB = strokesB
            let updated = WatchMatch(
                matchId: m.matchId, teamAName: m.teamAName, teamBName: m.teamBName,
                playersA: m.playersA, playersB: m.playersB, typeLabel: m.typeLabel,
                format: m.format, status: m.status, holes: newHoles,
                cupName: m.cupName, courseName: m.courseName
            )
            self.match = updated
            Self.saveCache(updated)
        }
        let payload: [String: Any] = [
            "kind": "score",
            "matchId": m.matchId,
            "holeNumber": holeNumber,
            "strokesA": strokesA,
            "strokesB": strokesB,
            "_ts": Date().timeIntervalSince1970,
        ]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { [weak self] _ in
                self?.queueAsUserInfo(payload)
            }
        } else {
            queueAsUserInfo(payload)
        }
    }

    func requestRefresh() {
        let payload: [String: Any] = ["kind": "request-refresh", "_ts": Date().timeIntervalSince1970]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { _ in }
        } else {
            queueAsUserInfo(payload)
        }
    }

    private func queueAsUserInfo(_ payload: [String: Any]) {
        // transferUserInfo persists across launches and delivers when the iPhone wakes.
        session.transferUserInfo(payload)
    }

    // MARK: - Incoming

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { [weak self] in
            self?.isReachable = session.isReachable
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            self?.isReachable = session.isReachable
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handle(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handle(message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handle(applicationContext)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handle(userInfo)
    }

    private func handle(_ payload: [String: Any]) {
        let body: [String: Any]
        if let inner = payload["payload"] as? [String: Any] {
            body = inner
        } else {
            body = payload
        }
        let kind = (payload["kind"] as? String) ?? (body["kind"] as? String) ?? "match"
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if kind == "clear" {
                self.match = nil
                Self.clearCache()
            } else if let parsed = WatchMatch.from(payload: body) {
                self.match = parsed
                Self.saveCache(parsed)
            }
            self.lastSyncAt = Date()
        }
    }

    // MARK: - Cache

    private static let cacheURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("swingsavor-last-match.json")
    }()

    private static func saveCache(_ m: WatchMatch) {
        guard let data = try? JSONEncoder().encode(m) else { return }
        try? data.write(to: cacheURL, options: .atomic)
    }

    private static func loadCache() -> WatchMatch? {
        guard let data = try? Data(contentsOf: cacheURL) else { return nil }
        return try? JSONDecoder().decode(WatchMatch.self, from: data)
    }

    private static func clearCache() {
        try? FileManager.default.removeItem(at: cacheURL)
    }
}
