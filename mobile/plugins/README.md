# plugins/ — Expo Config Plugin

## `withAppBlocker.js`

An Expo Config Plugin that automatically wires the native modules into the Xcode and Android projects during `expo prebuild` (which EAS Build runs on the cloud server before compiling).

**You never run this manually** — it fires automatically as part of `eas build`.

---

## What it does

### iOS
1. Copies `ios-native/AppBlockerModule.swift` and `AppBlockerModule.m` into the generated Xcode project directory
2. Adds both files to `project.pbxproj` so Xcode compiles them

### Android
1. Creates `android/app/src/main/java/com/nova/appblocker/` and copies the three Kotlin files there
2. Copies `accessibility_service_config.xml` into `android/app/src/main/res/xml/`
3. Registers `AppBlockerPackage` in `MainApplication.kt`
4. Adds the `BlockerAccessibilityService` declaration to `AndroidManifest.xml` with the correct intent filter and meta-data

---

## How it's wired up

In `app.json`:
```json
{
  "expo": {
    "plugins": ["./plugins/withAppBlocker"]
  }
}
```

Expo loads this plugin when running `expo prebuild` or `eas build`.

---

## API used

The plugin uses `@expo/config-plugins` (bundled with Expo — no extra install needed):

| Modifier | Used for |
|---|---|
| `withXcodeProject` | Copy Swift files + add to `project.pbxproj` |
| `withDangerousMod` | Copy Kotlin files to the Android source directory |
| `withAndroidManifest` | Add Accessibility Service declaration |
| `withMainApplication` | Register `AppBlockerPackage` in the React Native package list |
