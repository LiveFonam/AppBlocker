# iOS Native Module — App Blocker

These files implement real app blocking on iOS using Apple's Screen Time API.

> **You never add these to Xcode manually.** `plugins/withAppBlocker.js` copies them into the generated Xcode project automatically during `eas build`.

---

## Files

| File | Purpose |
|---|---|
| `AppBlockerModule.swift` | Main module — authorization, FamilyActivityPicker, ManagedSettings shield |
| `AppBlockerModule.m` | Objective-C bridge — exposes the Swift module to React Native's JS bridge |
| `DeviceActivityMonitorExtension.swift` | Separate Xcode target — applies/removes blocks on a schedule even when the app is closed |

---

## How Blocking Works on iOS

Apple provides three frameworks for this:

- **`FamilyControls`** — permission system. The user must grant "Screen Time" access before anything can be blocked.
- **`ManagedSettings`** — applies the actual shield. When `store.shield.applications = [tokens]` is set, those apps show a block screen and cannot be opened.
- **`DeviceActivity`** — schedule-based monitoring. Tells the system when to start/stop blocking based on a time window.

The shield set via `ManagedSettingsStore` **persists even after the app is killed** — it's stored at the system level. The only way to remove it is to call `store.shield.applications = nil` from within the app.

---

## JS API (called from `src/useAppBlocker.js`)

```javascript
import { NativeModules } from 'react-native';
const AppBlocker = NativeModules.AppBlocker;

// Ask user for Screen Time permission (shows system dialog)
await AppBlocker.requestAuthorization();

// Open the iOS system app picker (FamilyActivityPicker)
AppBlocker.showAppPicker();

// Apply the shield + set a schedule
AppBlocker.startBlocking(startMinutes, endMinutes);

// Remove the shield
AppBlocker.stopBlocking();

// Check state
const isBlocking = await AppBlocker.isBlocking();    // boolean
const count      = await AppBlocker.getSelectedCount(); // number
```

---

## DeviceActivityMonitor Extension

`DeviceActivityMonitorExtension.swift` must be added as a **separate Xcode target** (File → New → Target → Device Activity Monitor Extension). This extension runs in the background and:

- Calls `intervalDidStart` → applies the shield when the scheduled block starts
- Calls `intervalDidEnd` → removes the shield when the scheduled block ends

This allows schedule-based blocking to work even if the user never opens the app.

**Shared data:** Both the main app and the extension read from the same App Group (`group.nova.appblocker`) to share the user's selected apps.

---

## Entitlements Required

Both the main app target and the extension target need these entitlements (configured in `app.json`):

```json
"com.apple.developer.family-controls": true,
"com.apple.security.application-groups": ["group.nova.appblocker"]
```

The `FamilyControls` entitlement must also be **enabled on the App ID** in the Apple Developer portal — see `SETUP.md`.

---

## Adding the Extension (one-time, requires Mac or cloud Mac)

The config plugin handles the main app's Swift files automatically. The DeviceActivity extension requires one manual step in Xcode:

1. Open the generated `ios/*.xcworkspace`
2. File → New → Target → **Device Activity Monitor Extension**
3. Name: `NovaFocusMonitor`, Bundle ID: `com.nova.novafocus.monitor`
4. Replace the generated file with `DeviceActivityMonitorExtension.swift`
5. In Signing & Capabilities for the extension target, add:
   - **Family Controls**
   - **App Groups** → `group.nova.appblocker`

Without this extension, blocking still works — it just won't automatically start/stop on a schedule when the app is closed.
