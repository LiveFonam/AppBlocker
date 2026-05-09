// Add this file as a new Target → Device Activity Monitor Extension in Xcode.
// Bundle ID: com.yourteam.novafocus.monitor
// App Group: group.nova.appblocker (must match main app)

import DeviceActivity
import ManagedSettings
import Foundation

private let suite = UserDefaults(suiteName: "group.nova.appblocker") ?? .standard

class DeviceActivityMonitorExtension: DeviceActivityMonitor {

  private let store = ManagedSettingsStore()

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    applyShield()
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    store.shield.applications = nil
    store.shield.applicationCategories = nil
  }

  private func applyShield() {
    guard let data = suite.data(forKey: "familySelection"),
          let sel  = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return }
    store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
    store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
  }
}
