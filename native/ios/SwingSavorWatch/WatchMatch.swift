import Foundation

struct WatchHole: Identifiable, Codable, Equatable {
    var id: Int { holeNumber }
    let holeNumber: Int
    let par: Int
    var strokesA: Int?
    var strokesB: Int?
}

struct WatchMatch: Codable, Equatable {
    let matchId: String
    let teamAName: String
    let teamBName: String
    let playersA: String
    let playersB: String
    let typeLabel: String
    let format: String          // "match_play" | "stableford"
    let status: String          // "pending" | "active" | "finished"
    var holes: [WatchHole]
    let cupName: String?
    let courseName: String?

    static func from(payload: [String: Any]) -> WatchMatch? {
        guard
            let matchId = payload["matchId"] as? String,
            let holesRaw = payload["holes"] as? [[String: Any]]
        else { return nil }

        let holes: [WatchHole] = holesRaw.compactMap { dict in
            guard
                let n = dict["holeNumber"] as? Int,
                let par = dict["par"] as? Int
            else { return nil }
            return WatchHole(
                holeNumber: n,
                par: par,
                strokesA: dict["strokesA"] as? Int,
                strokesB: dict["strokesB"] as? Int
            )
        }.sorted { $0.holeNumber < $1.holeNumber }

        return WatchMatch(
            matchId: matchId,
            teamAName: (payload["teamAName"] as? String) ?? "Team A",
            teamBName: (payload["teamBName"] as? String) ?? "Team B",
            playersA: (payload["playersA"] as? String) ?? "",
            playersB: (payload["playersB"] as? String) ?? "",
            typeLabel: (payload["typeLabel"] as? String) ?? "Match",
            format: (payload["format"] as? String) ?? "match_play",
            status: (payload["status"] as? String) ?? "active",
            holes: holes.isEmpty ? Self.fallbackHoles() : holes,
            cupName: payload["cupName"] as? String,
            courseName: payload["courseName"] as? String
        )
    }

    static func fallbackHoles() -> [WatchHole] {
        (1...18).map { WatchHole(holeNumber: $0, par: 4, strokesA: nil, strokesB: nil) }
    }

    var nextHoleNumber: Int {
        if let next = holes.first(where: { $0.strokesA == nil || $0.strokesB == nil }) {
            return next.holeNumber
        }
        return holes.last?.holeNumber ?? 1
    }

    var playedHoles: Int {
        holes.filter { ($0.strokesA ?? 0) > 0 && ($0.strokesB ?? 0) > 0 }.count
    }

    var totalsAB: (Int, Int) {
        let a = holes.compactMap { $0.strokesA }.reduce(0, +)
        let b = holes.compactMap { $0.strokesB }.reduce(0, +)
        return (a, b)
    }

    var matchPlayWins: (Int, Int) {
        var a = 0; var b = 0
        for h in holes {
            guard let sa = h.strokesA, let sb = h.strokesB, sa > 0, sb > 0 else { continue }
            if sa < sb { a += 1 } else if sb < sa { b += 1 }
        }
        return (a, b)
    }
}
