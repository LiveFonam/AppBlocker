# Scheduled background blocking — RESOLVED in build 25

✅ **DONE.** Build 25 ships with a real `DeviceActivityMonitorExtension` iOS App Extension target. The shield auto-clears at session end even when Student Focus is force-killed.

## What was done

1. Installed `@bacons/apple-targets` (^4.0.7) — Expo config plugin by Evan Bacon that injects iOS App Extension targets into the prebuild output without requiring a local Mac.

2. Created `mobile/targets/DeviceActivityMonitor/` with:
   - `expo-target.config.json` — declares `type: "device-activity-monitor"`, deployment target 16.0, the three Family Controls frameworks, and the FamilyControls + App Group entitlements
   - `index.swift` — the extension class that reads the stored `FamilyActivitySelection` from the shared UserDefaults suite and applies / clears the shield on `intervalDidStart` / `intervalDidEnd`

3. Re-enabled `DeviceActivityCenter` in `mobile/ios-native/AppBlockerModule.swift`:
   - `startBlocking(start, end)` registers a non-repeating schedule from now to now+duration
   - `stopBlocking()` calls `center.stopMonitoring([activityName])` to cancel it

4. Set `ios.appleTeamId = "DFYFWYGNJR"` in `app.json` so the plugin can sign the extension target.

5. Deleted `mobile/ios-native/DeviceActivityMonitorExtension.swift` (moved into `targets/DeviceActivityMonitor/index.swift`).

## Reverting if it breaks

If the build fails or the extension misbehaves in production, revert is straightforward:

1. Remove `@bacons/apple-targets` from `app.json` plugins array
2. Delete the `mobile/targets/` directory
3. Restore `mobile/ios-native/DeviceActivityMonitorExtension.swift` from git history
4. In `mobile/ios-native/AppBlockerModule.swift`, comment out the `DeviceActivityCenter` calls again
5. Rebuild — back to the build-24 behavior (shield persists but doesn't auto-cleanup; local notification reminds user to reopen the app)

## How it works at runtime

```
User taps "Start focus session" in BlockView (25 min)
         ↓
Shell.tsx calls blocker.startBlocking(0, 25)
         ↓
AppBlockerModule.swift:
  - Reads familySelection from UserDefaults suite group.nova.appblocker
  - Applies shield via ManagedSettingsStore.shield.applications
  - DeviceActivityCenter.startMonitoring schedules intervalEnd at +25min
         ↓
User force-kills Student Focus
         ↓
Shield is still applied — iOS enforces it system-wide
         ↓
25 minutes later
         ↓
iOS wakes DeviceActivityMonitorExtension.intervalDidEnd()
         ↓
Extension clears the shield via store.shield.applications = nil
         ↓
Blocked apps are accessible again, no main-app interaction needed
```

## App Group bridge

Both targets (main app + extension) share data via `UserDefaults(suiteName: "group.nova.appblocker")`. Keys:

| Key | Type | Written by | Read by |
|---|---|---|---|
| `familySelection` | Data (encoded FamilyActivitySelection) | Main app's `showAppPicker` | Both — main app `loadSelection`, extension `applyShield` |
| `isBlocking` | Bool | Both | Main app `isBlocking()` |
| `blockingEndAt` | Double (Unix timestamp) | Main app `startBlocking` | Main app `isBlocking()` fallback auto-clear |
