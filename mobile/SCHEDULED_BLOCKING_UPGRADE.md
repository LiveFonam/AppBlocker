# Upgrading to true scheduled background blocking (v1.1)

v1.0 ships with **shield-persists-across-force-kill** blocking, but **not** true scheduled background enforcement. This doc explains what's in place, why we chose this for v1.0, and exactly what to add in v1.1.

## What works in v1.0 right now

- Apply shield via `ManagedSettingsStore.shield.applications = selection.applicationTokens` when the user starts a focus session.
- The shield is **system-enforced by iOS**, so it persists even if the user force-quits Student Focus.
- Session end time is stored in shared `UserDefaults(suiteName: "group.nova.appblocker")` under key `blockingEndAt`.
- Local UNUserNotification fires at session end (scheduled JS-side via `expo-notifications`) — reminds the user to open the app.
- When the user opens the app, the native `isBlocking()` check sees `Date.now() > blockingEndAt` and auto-clears the shield.

**Trade-off:** if the user never reopens the app after a session technically ends, the shield stays applied indefinitely. They'd need to either open the app (which clears it) or revoke FamilyControls permission in iOS Settings → Screen Time → Apps that Can Access Screen Time → Student Focus.

For a self-control app this is mostly fine — the user opens it regularly. But it's not the spec-compliant Apple-recommended approach.

## What v1.1 should add

A **DeviceActivityMonitorExtension** target. This is a separate iOS app extension that iOS keeps alive (lightweight, runs independently of the main app) and can apply/clear shields on a schedule even when the host app is closed.

The Swift code for the extension already exists at `mobile/ios-native/DeviceActivityMonitorExtension.swift`. What's missing is the **Xcode project plumbing** — the extension target.

### Why we deferred this

Expo's prebuild doesn't natively support iOS App Extension targets. Adding one requires writing a custom Expo config plugin that uses the `xcode` library to:

1. Create a new `PBXNativeTarget` of type `com.apple.product-type.app-extension`
2. Add a `PBXSourcesBuildPhase` linking the `.swift` file
3. Add a `PBXFrameworksBuildPhase` linking FamilyControls, ManagedSettings, DeviceActivity
4. Generate the extension's `Info.plist` with the `NSExtensionPointIdentifier = com.apple.deviceactivity.monitor-extension`
5. Generate the extension's `.entitlements` (FamilyControls + App Group)
6. Embed the extension in the main app via `PBXCopyFilesBuildPhase` (subtype `app_extension`)
7. Set per-target build settings (deployment target = iOS 16.0, bundle ID = `com.nova.novafocus.DeviceActivityMonitor`, signing config, etc.)

Without a Mac to verify the resulting Xcode project, this is high-risk — a single off-by-one in the project file structure can cascade into hours of cryptic Xcode/EAS errors. We chose the pragmatic v1.0 path so the launch isn't gated on plugin debugging.

### How to add it in v1.1

The community has done this for other Apple extension types (Widgets, App Clips, Notification Service Extensions). A reasonable path:

1. **Use a known-good template.** Look at packages like `@bacons/expo-apple-targets` or community write-ups for ScreenTime/FamilyControls Expo plugins. Several developers have shipped this; copying their plugin and adapting paths/identifiers is much safer than writing from scratch.

2. **Re-enable the DeviceActivity scheduling in `AppBlockerModule.swift`**. The Swift currently has the DeviceActivityCenter calls stripped — add back:

   ```swift
   import DeviceActivity

   private let center = DeviceActivityCenter()
   private static let activityName = DeviceActivityName("FocusSession")

   // Inside startBlocking():
   let schedule = DeviceActivitySchedule(
     intervalStart: cal.dateComponents([.hour, .minute, .second], from: now),
     intervalEnd:   cal.dateComponents([.hour, .minute, .second], from: endDate),
     repeats:       false
   )
   center.stopMonitoring([Self.activityName])
   try center.startMonitoring(Self.activityName, during: schedule)

   // Inside stopBlocking():
   center.stopMonitoring([Self.activityName])
   ```

3. **Register the plugin in `mobile/app.json` `plugins` array** — `"./plugins/withDeviceActivityExtension"`.

4. **Build + test on a physical iPhone** (TestFlight). Verify: start a 10-min session → force-kill the app → wait for the session to end → confirm shield drops automatically without reopening.

5. **Drop the local-notification hack** — once the extension handles `intervalDidEnd()` and clears the shield, the local notification is no longer the cleanup mechanism (still useful as a UX reminder, but optional).

### Notes for the plugin writer

- The `xcode` library is finicky about target ordering and group hierarchy. Trial-and-error each step against `eas build --local` if available, or test the prebuild output with `cd ios && pod install && xcodebuild`.
- The extension's bundle ID must be `<mainBundleId>.<ExtensionName>` per Apple convention.
- The extension MUST be signed with the same Apple Team and have FamilyControls entitlement enabled on its own App ID identifier in developer.apple.com.
- If EAS can't auto-provision the new App ID, you'll need to manually create it once in the developer portal.

## TL;DR

- v1.0 = shield persists across force-kill ✓; auto-cleanup at session end relies on user reopening the app
- v1.1 = add the proper DeviceActivityMonitorExtension target via a custom Expo plugin so auto-cleanup happens server-side from iOS itself
- Swift file is already written; only the Xcode target injection plugin is missing
