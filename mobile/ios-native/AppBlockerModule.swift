import Foundation

// Stub implementation — FamilyControls entitlement removed for TestFlight UI testing.
// See RESTORE_BEFORE_RELEASE.md to restore real blocking before App Store submission.

@objc(AppBlockerModule)
class AppBlockerModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func requestAuthorization(_ resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(nil)
  }

  @objc func showAppPicker() {}

  @objc func startBlocking(_ startMinutes: Double, endMinutes: Double) {}

  @objc func stopBlocking() {}

  @objc func isBlocking(_ resolve: @escaping (Any?) -> Void,
                          reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(false)
  }

  @objc func getSelectedCount(_ resolve: @escaping (Any?) -> Void,
                               reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(0)
  }
}
