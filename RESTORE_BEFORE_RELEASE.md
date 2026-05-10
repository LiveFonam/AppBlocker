# Restore Before App Store Release

## FamilyControls entitlement — REMOVED for TestFlight testing

The `com.apple.developer.family-controls` entitlement was temporarily removed from
`mobile/app.json` because Apple's ad-hoc provisioning profiles don't support it
without explicit Apple approval, blocking the TestFlight build.

### What was removed

In `mobile/app.json` under `expo.ios.entitlements`, this line was deleted:

```json
"com.apple.developer.family-controls": true
```

### What breaks without it

Real app blocking does NOT work in this TestFlight build. The UI, onboarding,
auth, and all other screens work fine. Blocking is the only missing piece.

`mobile/ios-native/AppBlockerModule.swift` was also replaced with a stub (no-op)
because the real implementation imports FamilyControls/ManagedSettings/DeviceActivity
which require the entitlement. The stub returns false/0 for all calls.

`./plugins/withAppBlocker` was also removed from `mobile/app.json` plugins list
to prevent native module bridging issues in the preview build. Add it back alongside
the entitlement when building for production.

### What to do before App Store submission

1. Add the entitlement back to `mobile/app.json`:
   ```json
   "entitlements": {
     "com.apple.developer.family-controls": true,
     "com.apple.security.application-groups": ["group.nova.appblocker"]
   }
   ```
2. Apply for the FamilyControls entitlement via Apple:
   - Go to developer.apple.com → Contact Us → request Additional Capabilities
   - Justification: "Self-control app that blocks distracting apps for students using Apple's Screen Time API"
3. Once Apple approves, rebuild with `eas build --platform ios --profile production`
