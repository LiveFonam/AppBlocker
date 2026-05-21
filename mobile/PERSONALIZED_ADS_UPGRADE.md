# Upgrading from non-personalized to personalized ads

v1.0 ships with **non-personalized AdMob rewarded ads** — no IDFA, no ATT prompt, no UMP SDK. Ad revenue is ~50% of what personalized ads earn but Apple-review risk is much lower and setup is simpler.

When you want to upgrade (typically post-launch once you have real users), here's the full delta you need to apply. Estimated work: ~1 day of code + a new App Store version with updated metadata.

## Code changes

### 1. `mobile/app.json` — add ATT usage description

```jsonc
"ios": {
  "infoPlist": {
    // ...existing keys...
    "NSUserTrackingUsageDescription":
      "Student Focus uses an advertising identifier to show relevant ads during the override gate, which keeps the app free for students."
  }
}
```

The string is what Apple shows in the App Tracking Transparency prompt. Apple rejects vague or generic text; the wording above is concrete about both the use (advertising) and the benefit (keeps the app free).

### 2. Install + integrate Google's UMP SDK (GDPR consent)

```bash
cd mobile
npx expo install expo-tracking-transparency
```

Then in `mobile/App.js` (or wherever onboarding finishes), request ATT permission after the user signs in:

```ts
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads'

// After onboarding completes:
const { status } = await requestTrackingPermissionsAsync()
const trackingAllowed = status === 'granted'

// Then fetch GDPR consent info (required in EU regardless of ATT):
const consentInfo = await AdsConsent.requestInfoUpdate()
if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
  await AdsConsent.showForm()
}

// Initialize AdMob with the user's choice:
await mobileAds().initialize()
```

Pass `requestNonPersonalizedAdsOnly: !trackingAllowed` to every ad load to honor the user's ATT choice when tracking is denied.

### 3. `mobile/src/components/OverrideGate.tsx` — drop the hardcoded NPA flag

Find the rewarded ad request:
```ts
const ad = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,  // <-- v1.0 hardcoded
})
```

Change to:
```ts
const ad = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: !trackingAllowed,  // from ATT state
})
```

You'll need to thread the `trackingAllowed` boolean through context or read it from storage on each open.

## App Store Connect changes (in the next version submission)

### App Privacy questionnaire

Switch these from "No" to "Yes":

- **Identifiers → Device ID** — Collected, Linked to user, Used for **Third-Party Advertising**
- **Tracking** — "Yes, this app uses data to track users"

This will cause Apple to show "Data Used to Track You" on the App Store listing. That's normal for ad-supported apps.

### Capabilities questionnaire (rating section)

- **Advertising** — Yes (was No in v1.0; the in-app placeholder doesn't count, but real personalized ads do)

## Privacy policy + terms updates

In `docs/privacy.html`:

- Update the AdMob third-party section to mention IDFA collection
- Add a paragraph in Section 2 (data collected) listing the advertising identifier
- Mention the user's ATT choice and that denying tracking results in non-personalized ads
- Link to AdMob's privacy policy and the IAB Transparency & Consent Framework if you join it

In `docs/terms.html`:

- One paragraph in the override-gate section noting that the ads may be personalized if you allow tracking

## Why we didn't ship this in v1.0

- ATT prompts are a common Apple-review rejection reason for first-time submissions (Apple checks the wording is specific and the prompt fires at a reasonable time)
- UMP SDK adds complexity (GDPR consent flow, EU-specific UX)
- The revenue uplift only matters at scale (~1000+ DAU); at indie-launch volume the difference is pennies/day
- App Privacy declaration changes require a new app version
