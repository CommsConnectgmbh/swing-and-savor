import SwiftUI

private let teamAColor = Color(red: 0.61, green: 0.71, blue: 0.79)
private let teamBColor = Color(red: 0.85, green: 0.64, blue: 0.56)
private let accentGold = Color(red: 0.85, green: 0.79, blue: 0.66)

struct ScoreEntryView: View {
    let hole: WatchHole
    let teamALabel: String
    let teamBLabel: String

    @EnvironmentObject var store: MatchStore
    @Environment(\.dismiss) private var dismiss

    @State private var strokesA: Int
    @State private var strokesB: Int
    @State private var focus: Side = .a

    enum Side { case a, b }

    init(hole: WatchHole, teamALabel: String, teamBLabel: String) {
        self.hole = hole
        self.teamALabel = teamALabel
        self.teamBLabel = teamBLabel
        _strokesA = State(initialValue: hole.strokesA ?? hole.par)
        _strokesB = State(initialValue: hole.strokesB ?? hole.par)
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text("Loch \(hole.holeNumber)").font(.system(size: 13, weight: .bold))
                Spacer()
                Text("Par \(hole.par)").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 4)

            HStack(spacing: 6) {
                stepper(label: teamALabel, value: $strokesA, color: teamAColor, active: focus == .a)
                    .onTapGesture { focus = .a }
                stepper(label: teamBLabel, value: $strokesB, color: teamBColor, active: focus == .b)
                    .onTapGesture { focus = .b }
            }

            quickButtons

            Button {
                store.sendScore(holeNumber: hole.holeNumber, strokesA: strokesA, strokesB: strokesB)
                WKHaptic.success()
                dismiss()
            } label: {
                Text("Speichern").font(.system(size: 13, weight: .semibold)).frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(accentGold)
            .disabled(strokesA < 1 || strokesB < 1)
        }
        .focusable(true)
        .digitalCrownRotation(
            focus == .a
                ? Binding(get: { Double(strokesA) }, set: { strokesA = max(1, min(20, Int($0.rounded()))) })
                : Binding(get: { Double(strokesB) }, set: { strokesB = max(1, min(20, Int($0.rounded()))) }),
            from: 1, through: 20, by: 1, sensitivity: .medium,
            isContinuous: false, isHapticFeedbackEnabled: true
        )
        .padding(.horizontal, 2)
        .padding(.bottom, 4)
    }

    private func stepper(label: String, value: Binding<Int>, color: Color, active: Bool) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(color)
                .tracking(0.6)
                .lineLimit(1)
            Text("\(value.wrappedValue)")
                .font(.system(size: 30, weight: .black, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(active ? color : .primary)
            HStack(spacing: 6) {
                Button {
                    value.wrappedValue = max(1, value.wrappedValue - 1)
                    WKHaptic.click()
                } label: { Image(systemName: "minus") }
                    .controlSize(.mini)
                Button {
                    value.wrappedValue = min(20, value.wrappedValue + 1)
                    WKHaptic.click()
                } label: { Image(systemName: "plus") }
                    .controlSize(.mini)
            }
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .stroke(active ? color : .clear, lineWidth: 1.5)
                .background(RoundedRectangle(cornerRadius: 8).fill(.thinMaterial))
        )
    }

    private var quickButtons: some View {
        HStack(spacing: 4) {
            quickBtn("Birdie", -1)
            quickBtn("Par", 0)
            quickBtn("Bogey", 1)
            quickBtn("+2", 2)
        }
    }

    private func quickBtn(_ label: String, _ delta: Int) -> some View {
        Button {
            let target = max(1, hole.par + delta)
            if focus == .a { strokesA = target } else { strokesB = target }
            WKHaptic.click()
        } label: {
            Text(label).font(.system(size: 10, weight: .semibold)).frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.mini)
    }
}

import WatchKit
enum WKHaptic {
    static func click() { WKInterfaceDevice.current().play(.click) }
    static func success() { WKInterfaceDevice.current().play(.success) }
}
