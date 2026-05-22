import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

private let suite = UserDefaults(suiteName: "group.nova.appblocker") ?? .standard

class DeviceActivityMonitorExtension: DeviceActivityMonitor {

  private let store = ManagedSettingsStore(named: .init("default"))

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    applyShield()
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    clearShield()
  }

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name,
                                       activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
  }

  private func applyShield() {
    guard let data = suite.data(forKey: "familySelection"),
          let sel  = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else {
      return
    }
    store.shield.applications        = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
    store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
    store.shield.webDomains          = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
    suite.set(true, forKey: "isBlocking")
  }

  private func clearShield() {
    store.shield.applications          = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains            = nil
    suite.set(false, forKey: "isBlocking")
    suite.removeObject(forKey: "blockingEndAt")
  }
}
