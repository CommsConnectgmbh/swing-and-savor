import SwiftUI

@main
struct SwingSavorWatchApp: App {
    @StateObject private var store = MatchStore.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
