import SwiftUI

private let teamAColor = Color(red: 0.61, green: 0.71, blue: 0.79)   // #9BB5C9
private let teamBColor = Color(red: 0.85, green: 0.64, blue: 0.56)   // #D9A38E
private let accentGold = Color(red: 0.85, green: 0.79, blue: 0.66)   // #D9C9A8

struct HoleRoute: Hashable, Identifiable {
    let number: Int
    var id: Int { number }
}

struct MatchSummaryView: View {
    let match: WatchMatch
    @State private var pushedHole: HoleRoute?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                header
                scoreBar
                actionRow
                holesGrid
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
        }
        .navigationDestination(item: $pushedHole) { route in
            if let hole = match.holes.first(where: { $0.holeNumber == route.number }) {
                ScoreEntryView(hole: hole, teamALabel: match.teamAName, teamBLabel: match.teamBName)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let cup = match.cupName { Text(cup.uppercased()).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).tracking(1) }
            Text(match.typeLabel).font(.system(size: 11, weight: .semibold)).foregroundStyle(.tertiary).tracking(0.5)
        }
    }

    private var scoreBar: some View {
        let (a, b): (Int, Int) = match.format == "match_play" ? match.matchPlayWins : match.totalsAB
        return HStack(spacing: 0) {
            teamColumn(name: match.teamAName, players: match.playersA, score: a, isLeading: a >= b, color: teamAColor)
            Rectangle().fill(.tertiary).frame(width: 1)
            teamColumn(name: match.teamBName, players: match.playersB, score: b, isLeading: b > a, color: teamBColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 10).fill(.thinMaterial))
    }

    private func teamColumn(name: String, players: String, score: Int, isLeading: Bool, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(name.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(color).tracking(0.8).lineLimit(1)
            Text("\(score)")
                .font(.system(size: 28, weight: .black, design: .rounded))
                .foregroundStyle(isLeading ? accentGold : .secondary)
                .monospacedDigit()
            if !players.isEmpty {
                Text(players).font(.system(size: 9)).foregroundStyle(.tertiary).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var actionRow: some View {
        Button {
            pushedHole = HoleRoute(number: match.nextHoleNumber)
        } label: {
            HStack {
                Image(systemName: "plus.circle.fill")
                Text("Loch \(match.nextHoleNumber) eintragen")
                    .font(.system(size: 13, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(accentGold)
        .disabled(match.status == "finished")
    }

    private var holesGrid: some View {
        VStack(spacing: 2) {
            ForEach(stride(from: 0, to: match.holes.count, by: 3).map { $0 }, id: \.self) { rowStart in
                HStack(spacing: 4) {
                    ForEach(rowStart..<min(rowStart + 3, match.holes.count), id: \.self) { idx in
                        holeCell(match.holes[idx])
                    }
                }
            }
        }
    }

    private func holeCell(_ h: WatchHole) -> some View {
        let played = (h.strokesA ?? 0) > 0 && (h.strokesB ?? 0) > 0
        let winner: String? = {
            guard let sa = h.strokesA, let sb = h.strokesB, sa > 0, sb > 0 else { return nil }
            if sa < sb { return "A" }
            if sb < sa { return "B" }
            return "halved"
        }()
        let bg: Color = {
            switch winner {
            case "A": return teamAColor.opacity(0.25)
            case "B": return teamBColor.opacity(0.25)
            case "halved": return .yellow.opacity(0.25)
            default: return Color.gray.opacity(0.12)
            }
        }()
        return Button {
            pushedHole = HoleRoute(number: h.holeNumber)
        } label: {
            VStack(spacing: 1) {
                Text("\(h.holeNumber)").font(.system(size: 9, weight: .semibold)).foregroundStyle(.tertiary)
                if played {
                    Text("\(h.strokesA ?? 0)–\(h.strokesB ?? 0)")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .monospacedDigit()
                } else {
                    Text("P\(h.par)").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(RoundedRectangle(cornerRadius: 6).fill(bg))
        }
        .buttonStyle(.plain)
    }
}

