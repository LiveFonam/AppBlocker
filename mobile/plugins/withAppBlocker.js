/**
 * Expo Config Plugin — automatically wires up the AppBlocker native modules
 * during `expo prebuild` (run by EAS Build on the cloud Mac/Linux server).
 *
 * What it does:
 *  iOS  → copies Swift + ObjC bridge into the Xcode project, adds them to
 *          project.pbxproj so Xcode compiles them.
 *  Android → copies Kotlin files, registers AppBlockerPackage, adds the
 *            Accessibility Service to AndroidManifest.xml.
 */

const {
  withXcodeProject,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ── iOS ────────────────────────────────────────────────────────────────────────

function withIosModule(config) {
  return withXcodeProject(config, (modConfig) => {
    const project     = modConfig.modResults;
    const projName    = modConfig.modRequest.projectName;
    const projRoot    = modConfig.modRequest.platformProjectRoot;
    const sourceDir   = path.join(modConfig.modRequest.projectRoot, 'ios-native');
    const destDir     = projRoot;

    const files = ['AppBlockerModule.swift', 'AppBlockerModule.m'];

    for (const file of files) {
      const src  = path.join(sourceDir, file);
      const dest = path.join(destDir, file);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }

    // Add files to Xcode project so they get compiled
    const groupKey = project.findPBXGroupKey({ name: projName });
    const target   = project.getFirstTarget();

    for (const file of files) {
      if (!project.hasFile(`${projName}/${file}`)) {
        project.addSourceFile(file, { target: target.uuid }, groupKey);
      }
    }

    return modConfig;
  });
}

// ── Android ────────────────────────────────────────────────────────────────────

function withAndroidKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projRoot = modConfig.modRequest.platformProjectRoot;
      const srcDir   = path.join(modConfig.modRequest.projectRoot, 'android-native');

      const javaDir = path.join(projRoot, 'app/src/main/java/com/nova/appblocker');
      const xmlDir  = path.join(projRoot, 'app/src/main/res/xml');
      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir,  { recursive: true });

      for (const file of ['AppBlockerModule.kt', 'AppBlockerPackage.kt', 'BlockerAccessibilityService.kt']) {
        const src = path.join(srcDir, file);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(javaDir, file));
      }

      const xmlSrc = path.join(srcDir, 'accessibility_service_config.xml');
      if (fs.existsSync(xmlSrc)) {
        fs.copyFileSync(xmlSrc, path.join(xmlDir, 'accessibility_service_config.xml'));
      }

      return modConfig;
    },
  ]);
}

function withAndroidManifestChanges(config) {
  return withAndroidManifest(config, (modConfig) => {
    const app = modConfig.modResults.manifest.application[0];
    if (!app.service) app.service = [];

    const exists = app.service.some(
      (s) => s.$['android:name'] === 'com.nova.appblocker.BlockerAccessibilityService'
    );

    if (!exists) {
      app.service.push({
        $: {
          'android:name':       'com.nova.appblocker.BlockerAccessibilityService',
          'android:exported':   'true',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
        },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }] },
        ],
        'meta-data': [
          {
            $: {
              'android:name':     'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
    }

    return modConfig;
  });
}

function withAndroidPackageRegistration(config) {
  return withMainApplication(config, (modConfig) => {
    const src = modConfig.modResults.contents;

    if (src.includes('AppBlockerPackage')) return modConfig; // already added

    // Insert package registration before the closing of getPackages()
    modConfig.modResults.contents = src.replace(
      /return packages\s*\n/,
      `packages.add(com.nova.appblocker.AppBlockerPackage())\n      return packages\n`
    );

    return modConfig;
  });
}

// ── Export ─────────────────────────────────────────────────────────────────────

module.exports = (config) => {
  config = withIosModule(config);
  config = withAndroidKotlinFiles(config);
  config = withAndroidManifestChanges(config);
  config = withAndroidPackageRegistration(config);
  return config;
};
