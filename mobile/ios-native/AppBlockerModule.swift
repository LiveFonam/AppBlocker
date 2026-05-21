import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

@objc(AppBlockerModule)
class AppBlockerModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  private let store = ManagedSettingsStore(named: .init("default"))
  private let suite = UserDefaults(suiteName: "group.nova.appblocker") ?? .standard
  // NOTE: v1.0 ships without the DeviceActivityMonitorExtension target. The
  // ManagedSettings shield still persists across main-app force-kill (iOS
  // enforces it at the system level), but the auto-cleanup at session-end
  // is driven by a local UNUserNotification + JS-side check on next launch,
  // not by DeviceActivity. See SCHEDULED_BLOCKING_UPGRADE.md for v1.1.

  // MARK: - Authorization

  @objc func requestAuthorization(_ resolve: @escaping (Any?) -> Void,
                                   reject: @escaping (String?, String?, Error?) -> Void) {
    if #available(iOS 16.0, *) {
      Task { @MainActor in
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          resolve(true)
        } catch {
          reject("AUTH_DENIED", error.localizedDescription, error)
        }
      }
    } else {
      reject("UNSUPPORTED", "FamilyControls requires iOS 16+", nil)
    }
  }

  // MARK: - App Picker

  @objc func showAppPicker() {
    guard #available(iOS 16.0, *) else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      let selection = self.loadSelection() ?? FamilyActivitySelection()
      let picker = AppPickerHost(initial: selection) { [weak self] newSelection in
        self?.saveSelection(newSelection)
      }
      let hostingController = UIHostingController(rootView: picker)
      hostingController.modalPresentationStyle = .pageSheet

      if let root = self.topViewController() {
        root.present(hostingController, animated: true)
      }
    }
  }

  private func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
      ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    let window = scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
    var vc = window?.rootViewController
    while let presented = vc?.presentedViewController { vc = presented }
    return vc
  }

  // MARK: - Blocking

  /// Start blocking. `startMinutes`/`endMinutes` are interpreted as a duration:
  /// the block runs from "now" for `max(1, endMinutes - startMinutes)` minutes.
  /// (For absolute-time scheduling we'd need a different bridge signature; v1.1 polish.)
  @objc func startBlocking(_ startMinutes: Double, endMinutes: Double) {
    guard #available(iOS 16.0, *) else { return }
    guard let selection = loadSelection() else { return }

    // Apply shield immediately so blocking is in effect even before the extension fires.
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens

    // Persist end time so isBlocking() can auto-cleanup on next call.
    let durationMinutes = max(1, Int(endMinutes - startMinutes))
    let endDate = Date().addingTimeInterval(TimeInterval(durationMinutes * 60))
    suite.set(true, forKey: "isBlocking")
    suite.set(endDate.timeIntervalSince1970, forKey: "blockingEndAt")
  }

  @objc func stopBlocking() {
    guard #available(iOS 16.0, *) else { return }

    store.shield.applications        = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains          = nil

    suite.set(false, forKey: "isBlocking")
    suite.removeObject(forKey: "blockingEndAt")
  }

  @objc func isBlocking(_ resolve: @escaping (Any?) -> Void,
                          reject: @escaping (String?, String?, Error?) -> Void) {
    let flag = suite.bool(forKey: "isBlocking")
    if flag {
      let endAt = suite.double(forKey: "blockingEndAt")
      if endAt > 0 && Date().timeIntervalSince1970 > endAt {
        stopBlocking()
        resolve(false)
        return
      }
    }
    resolve(flag)
  }

  @objc func getSelectedCount(_ resolve: @escaping (Any?) -> Void,
                               reject: @escaping (String?, String?, Error?) -> Void) {
    guard #available(iOS 16.0, *) else { resolve(0); return }
    let selection = loadSelection() ?? FamilyActivitySelection()
    let count = selection.applicationTokens.count
              + selection.categoryTokens.count
              + selection.webDomainTokens.count
    resolve(count)
  }

  // MARK: - Persistence

  @available(iOS 16.0, *)
  private func loadSelection() -> FamilyActivitySelection? {
    guard let data = suite.data(forKey: "familySelection") else { return nil }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  @available(iOS 16.0, *)
  private func saveSelection(_ selection: FamilyActivitySelection) {
    if let data = try? JSONEncoder().encode(selection) {
      suite.set(data, forKey: "familySelection")
    }
  }
}

// MARK: - Picker SwiftUI Host

@available(iOS 16.0, *)
private struct AppPickerHost: View {
  @State var selection: FamilyActivitySelection
  let onChange: (FamilyActivitySelection) -> Void
  @Environment(\.dismiss) private var dismiss

  init(initial: FamilyActivitySelection,
       onChange: @escaping (FamilyActivitySelection) -> Void) {
    _selection = State(initialValue: initial)
    self.onChange = onChange
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Choose apps to block")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .navigationBarLeading) {
            Button("Cancel") { dismiss() }
          }
          ToolbarItem(placement: .navigationBarTrailing) {
            Button("Done") {
              onChange(selection)
              dismiss()
            }
            .fontWeight(.semibold)
          }
        }
    }
  }
}
