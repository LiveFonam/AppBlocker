# Nova Focus — Build & Setup Guide

Cross-platform app blocker. React Native UI on both platforms, with Swift (iOS) and Kotlin (Android) native modules for real system-level blocking.

---

## Architecture

```
mobile/
├── App.js                        ← Main UI (all 5 tabs + block editor)
├── src/useAppBlocker.js          ← Hook that calls native blocking APIs
├── plugins/withAppBlocker.js     ← Expo config plugin (wires native code during build)
├── app.json                      ← Expo config (bundle ID, entitlements, permissions)
├── eas.json                      ← EAS Build profiles
├── ios-native/                   ← Swift files (see ios-native/README.md)
└── android-native/               ← Kotlin files (see android-native/README.md)
```

**How blocking works:**

| Platform | Blocking mechanism |
|---|---|
| iOS | `FamilyControls` + `ManagedSettings` — system-level shield via Screen Time API |
| Android | `AccessibilityService` — detects when a blocked app opens and redirects to Nova Focus |

The native modules are added to the Xcode/Android projects automatically by `plugins/withAppBlocker.js` during the EAS Build process. You never have to touch Xcode or Android Studio.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Apple Developer Account | $99/year — needed for iOS |
| Expo account (free) | [expo.dev](https://expo.dev) |
| Git + GitHub repo | EAS pulls your code from here |

---

## One-Time Apple Developer Portal Setup

Do this in your browser before your first iOS build.

1. Go to **[developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles → Identifiers**
2. Click **+** → **App IDs** → **App** → Continue
3. Set **Bundle ID** to: `com.nova.novafocus`
4. Scroll down and check these capabilities:
   - **Family Controls** ← required for blocking apps on iOS
   - **App Groups** → add group: `group.nova.appblocker`
5. Click **Continue** → **Register**

---

## One-Time EAS Setup (run once on your machine)

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in with your Expo account
eas login

# Inside the mobile/ folder — links this project to your Expo account
cd mobile
eas build:configure
```

---

## Building the App

### iOS (cloud build — no Mac needed)

EAS builds on their Mac servers. Takes ~15–20 minutes.

```bash
cd mobile
eas build --platform ios --profile production
```

When prompted:
- **Manage credentials?** → Yes (EAS handles provisioning profiles automatically)
- **Apple ID** → enter your developer account email

When the build finishes, EAS gives you a download link. To distribute via TestFlight:

```bash
eas submit --platform ios
```

### Android

```bash
cd mobile
eas build --platform android --profile production
```

The output is a `.aab` file ready for Google Play, or use `--profile preview` to get an `.apk` you can sideload directly.

---

## How the Native Modules Get Added (automated)

You don't run `expo prebuild` manually. EAS Build does it on the server:

1. EAS pulls your code from GitHub
2. Runs `npx expo prebuild --clean` (generates `ios/` and `android/` projects)
3. `plugins/withAppBlocker.js` fires during prebuild and:
   - Copies `ios-native/AppBlockerModule.swift` + `.m` into the Xcode project
   - Copies `android-native/*.kt` into the Android project
   - Registers the Kotlin package in `MainApplication.kt`
   - Adds the Accessibility Service to `AndroidManifest.xml`
4. Xcode / Gradle compiles everything
5. `.ipa` / `.aab` is ready to download

---

## Development Workflow

For UI development, you can use Expo Go (no native build needed). Blocking won't work, but all the screens and navigation will.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

> **Note:** The `useAppBlocker` hook detects when the native module is missing and skips the native calls gracefully — you'll see a toast instead.

---

## First Run on Device (iOS)

After installing from TestFlight:

1. Open the app → it immediately asks for **Screen Time permission** — tap **Allow**
2. Go to **Sessions** tab → tap **Set Up Block**
3. In the block editor, tap **Choose Apps to Block** — the iOS system picker opens
4. Select apps and tap **Done**
5. Set a schedule and tap **Start Blocking** — those apps are now shielded system-wide

## First Run on Device (Android)

1. Open the app → it will prompt you to enable the **Accessibility Service**
2. Go to **Settings → Accessibility → Nova Focus → Enable**
3. Come back, select apps to block, tap **Start Blocking**
4. Now whenever you open a blocked app, Nova Focus opens instead

---

## Deletion Warning

The **Profile** tab has a "Before Deleting This App" card that shows when blocking is active. It gives three options:

- **Stop All Blocks** — removes all blocks immediately (safe to then delete)
- **Pause for 1 Hour** — stops blocking temporarily
- **Keep Blocking** — cancels

> Deleting the app without stopping blocks removes all shields on iOS immediately (system behaviour — cannot be prevented). Always stop blocks first if you want them to persist.

---

## Troubleshooting

**EAS build fails on `FamilyControls` entitlement**
→ Make sure you enabled Family Controls on the App ID in the Apple Developer portal (see setup above) before building.

**Android: blocking not working after install**
→ The Accessibility Service needs to be manually enabled by the user in Android Settings. This is an Android security requirement and cannot be bypassed.

**`NativeModules.AppBlocker` is `null` in dev**
→ You're running in Expo Go. Native blocking requires a proper build via `eas build`. UI still works fine for development.

**EAS can't find provisioning profile**
→ Run `eas credentials` and let EAS regenerate them. Make sure your Apple Developer account is active and the Bundle ID `com.nova.novafocus` exists in the portal.
