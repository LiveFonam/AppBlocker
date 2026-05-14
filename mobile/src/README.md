# src/ — JavaScript Source

## `useAppBlocker.js`

React hook that manages all app blocking state and cross-platform native calls.

### Usage

```javascript
import { useAppBlocker } from './src/useAppBlocker';

function App() {
  const blocker = useAppBlocker();
  // blocker.isBlocking     → boolean
  // blocker.selectedCount  → number
  // blocker.blockedPackages → string[] (Android package names)
  // blocker.installedApps  → { id, name, icon, color }[] (Android only)
  // blocker.openAppPicker(setShowAndroidPicker) → void
  // blocker.startBlocking(startMinutes, endMinutes) → Promise
  // blocker.stopBlocking() → Promise
  // blocker.togglePackage(packageName) → void (Android)
}
```

### Platform behaviour

| Function | iOS | Android |
|---|---|---|
| `openAppPicker()` | Opens system `FamilyActivityPicker` | Calls `setShowAndroidPicker(true)` — shows custom list in UI |
| `startBlocking()` | Calls `AppBlocker.startBlocking(start, end)` — applies `ManagedSettings` shield | Calls `AppBlocker.startBlocking(packages)` — Accessibility Service monitors those packages |
| `stopBlocking()` | Removes `ManagedSettings` shield | Sets `isBlocking = false` in SharedPreferences — service stops redirecting |
| `installedApps` | Not used (iOS uses system picker) | Populated from `AppBlocker.getInstalledApps()` |

### Expo Go fallback

When `NativeModules.AppBlocker` is `null` (i.e. running in Expo Go during development), the hook:
- Still persists state via `AsyncStorage`
- Shows an `Alert` explaining that a native build is needed
- Does not crash

This means you can develop and test all UI in Expo Go, then build with EAS for real blocking.

### State persistence

All state is persisted across app restarts via `AsyncStorage` (`@nova_*` keys) and on the native side via `SharedPreferences` / `UserDefaults`.
