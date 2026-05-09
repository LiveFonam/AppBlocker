# Android Native Module — App Blocker

These files implement real app blocking on Android using an Accessibility Service.

> **You never add these manually.** `plugins/withAppBlocker.js` copies them into the generated Android project and registers them in `AndroidManifest.xml` automatically during `eas build`.

---

## Files

| File | Purpose |
|---|---|
| `AppBlockerModule.kt` | React Native native module — exposes blocking functions to JS |
| `AppBlockerPackage.kt` | Package registration — tells React Native the module exists |
| `BlockerAccessibilityService.kt` | Background service — detects blocked apps in foreground and redirects |
| `accessibility_service_config.xml` | Declares what events the Accessibility Service listens to |

---

## How Blocking Works on Android

Android has no equivalent to iOS's `ManagedSettings`. Instead, the common approach (used by BlockSite, StayFree, AppBlock, etc.) is:

1. An **Accessibility Service** runs in the background
2. When any app's window comes to foreground, the service receives a `TYPE_WINDOW_STATE_CHANGED` event
3. The service checks if that app's package name is in the blocked list
4. If it is, the service immediately launches Nova Focus — the user sees our app instead

This means blocking is enforced as a redirect, not a true system lock. The user can still go to Settings → Accessibility and disable the service. This is an Android platform limitation.

---

## JS API (called from `src/useAppBlocker.js`)

```javascript
import { NativeModules } from 'react-native';
const AppBlocker = NativeModules.AppBlocker;

// Returns array of { id, name, icon, color } for all installed launchable apps
const apps = await AppBlocker.getInstalledApps();

// Start blocking — pass array of package name strings
// e.g. ['com.google.android.youtube', 'com.instagram.android']
await AppBlocker.startBlocking(['com.google.android.youtube']);

// Stop blocking
await AppBlocker.stopBlocking();

// Check state
const isBlocking = await AppBlocker.isBlocking();    // boolean
const count      = await AppBlocker.getSelectedCount(); // number

// Open Android Accessibility Settings (user must enable service manually)
await AppBlocker.openAccessibilitySettings();
```

---

## User Setup (first run)

Android requires the user to manually grant Accessibility permission — this cannot be done programmatically. The first time they try to start blocking, the app should guide them:

1. Show a prompt explaining why Accessibility access is needed
2. Call `AppBlocker.openAccessibilitySettings()` to open the settings screen
3. User taps **Nova Focus** → toggles it **On** → confirms the permission dialog
4. User returns to the app — blocking is now enabled

---

## Permissions in `app.json`

```json
"android": {
  "permissions": [
    "android.permission.BIND_ACCESSIBILITY_SERVICE",
    "android.permission.PACKAGE_USAGE_STATS",
    "android.permission.QUERY_ALL_PACKAGES"
  ]
}
```

- `BIND_ACCESSIBILITY_SERVICE` — lets the service bind to Android's accessibility framework
- `PACKAGE_USAGE_STATS` — lets us read screen time data (requires user to grant in Special App Access)
- `QUERY_ALL_PACKAGES` — lets us list all installed apps (required on Android 11+)

---

## State Storage

Blocked package names and blocking state are stored in `SharedPreferences` (key: `nova_appblocker`). The Accessibility Service reads from the same preferences file, so no IPC is needed between the service and the main app.

---

## Limitations

| Limitation | Why |
|---|---|
| User can disable Accessibility Service from Settings | Android security policy — cannot be prevented |
| Uninstalling the app removes all blocking | Same as iOS |
| Some launchers may not fire window events reliably | Depends on Android manufacturer skin |
| Blocking works by redirect, not lock | True app locking requires device admin (much more complex to set up) |
