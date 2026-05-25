import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: MatchStore

    var body: some View {
        NavigationStack {
            Group {
                if let m = store.match {
                    MatchSummaryView(match: m)
                } else {
                    EmptyStateView()
                }
            }
            .navigationTitle("Swing & Savor")
        }
    }
}

private struct EmptyStateView: View {
    @EnvironmentObject var store: MatchStore
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "figure.golf")
                .font(.system(size: 32))
                .foregroundStyle(.tertiary)
            Text("Öffne ein Match\nauf deinem iPhone")
                .multilineTextAlignment(.center)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button {
                store.requestRefresh()
            } label: {
                Label("Sync", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .padding(.top, 4)
        }
        .padding()
    }
}
