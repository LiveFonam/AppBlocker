import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

// Shared UserDefaults between app and DeviceActivityMonitor extension
private let suite = UserDefaults(suiteName: "group.nova.appblocker") ?? .standard

@objc(AppBlockerModule)
class AppBlockerModule: NSObject {

  private let store  = ManagedSettingsStore()
  private let center = DeviceActivityCenter()

  @objc static func requiresMainQueueSetup() -> Bool { true }

  // MARK: - Authorization

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                                   reject:   @escaping RCTPromiseRejectBlock) {
    Task { @MainActor in
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        resolve(nil)
      } catch {
        reject("AUTH_ERROR", error.localizedDescription, error)
      }
    }
  }

  // MARK: - App Picker (iOS system UI)

  @objc func showAppPicker() {
    Task { @MainActor in
      guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
            let root = windowScene.windows.first?.rootViewController else { return }

      let current = Self.loadSelection() ?? FamilyActivitySelection()
      let vc = AppPickerHostingController(selection: current) { newSelection in
        Self.save(selection: newSelection)
      }
      root.present(vc, animated: true)
    }
  }

  // MARK: - Blocking

  @objc func startBlocking(_ startMinutes: Double, endMinutes: Double) {
    Task { @MainActor in
      guard let sel = Self.loadSelection() else { return }
      applyShield(sel)
      schedule(start: Int(startMinutes), end: Int(endMinutes))
      suite.set(true, forKey: "isBlocking")
    }
  }

  @objc func stopBlocking() {
    Task { @MainActor in
      store.shield.applications = nil
      store.shield.applicationCategories = nil
      center.stopMonitoring()
      suite.set(false, forKey: "isBlocking")
    }
  }

  @objc func isBlocking(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject:  @escaping RCTPromiseRejectBlock) {
    resolve(suite.bool(forKey: "isBlocking"))
  }

  @objc func getSelectedCount(_ resolve: @escaping RCTPromiseResolveBlock,
                               reject:   @escaping RCTPromiseRejectBlock) {
    let sel = Self.loadSelection()
    resolve((sel?.applicationTokens.count ?? 0) + (sel?.categoryTokens.count ?? 0))
  }

  // MARK: - Private

  private func applyShield(_ sel: FamilyActivitySelection) {
    store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
    store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
  }

  private func schedule(start: Int, end: Int) {
    guard start < end else { return }
    let sched = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: start / 60, minute: start % 60),
      intervalEnd:   DateComponents(hour: end   / 60, minute: end   % 60),
      repeats: true
    )
    try? center.startMonitoring(.blockSchedule, during: sched)
  }

  static func save(selection: FamilyActivitySelection) {
    if let data = try? JSONEncoder().encode(selection) {
      suite.set(data, forKey: "familySelection")
    }
  }

  static func loadSelection() -> FamilyActivitySelection? {
    guard let data = suite.data(forKey: "familySelection") else { return nil }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }
}

extension DeviceActivityName {
  static let blockSchedule = Self("blockSchedule")
}

// MARK: - SwiftUI picker wrapper

private class AppPickerHostingController: UIHostingController<_PickerView> {
  init(selection: FamilyActivitySelection, onComplete: @escaping (FamilyActivitySelection) -> Void) {
    super.init(rootView: _PickerView(selection: selection, onComplete: onComplete))
  }
  @objc required dynamic init?(coder: NSCoder) { fatalError() }
}

private struct _PickerView: View {
  @StateObject private var holder: _SelectionHolder
  let onComplete: (FamilyActivitySelection) -> Void
  @Environment(\.dismiss) var dismiss

  init(selection: FamilyActivitySelection, onComplete: @escaping (FamilyActivitySelection) -> Void) {
    _holder = StateObject(wrappedValue: _SelectionHolder(selection))
    self.onComplete = onComplete
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $holder.selection)
        .navigationTitle("Choose Apps to Block")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") {
              onComplete(holder.selection)
              dismiss()
            }
          }
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
          }
        }
    }
  }
}

private class _SelectionHolder: ObservableObject {
  @Published var selection: FamilyActivitySelection
  init(_ s: FamilyActivitySelection) { selection = s }
}
