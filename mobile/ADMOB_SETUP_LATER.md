# Adding AdMob rewarded ads (post-launch)

v1.0 ships **without** real ads. The override gate's 4-minute wait shows the original "AD" placeholder text (no real ad SDK calls). When you're ready to monetize, this doc is the full setup. ~30 minutes of work + a new build.

## Step 1 — Sign up for AdMob (free, 5 min)

1. Go to **https://admob.google.com**
2. Sign in with the Google account you want to receive payments to
3. Accept the terms; pick your country + timezone
4. AdMob may show you the "Payments" section. **You don't pay them.** Google pays YOU once your accumulated ad revenue reaches $100 CAD. Your earnings start at $0 and grow as users see ads.

Your publisher ID (e.g. `pub-1246476538646622`) shows in your AdMob account settings.

## Step 2 — Create the app on AdMob (5 min)

1. AdMob sidebar → **Apps** → **Add app**
2. **Have you published your app on Google Play or the App Store?** → If yes, link it via App Store. If no, pick **No**.
3. Platform → **iOS**
4. App name → `Student Focus`
5. Click **Add**
6. The new app's page shows the **App ID** at the top: `ca-app-pub-1246476538646622~XXXXXXXXXX` (the `~` matters)
7. **Copy that App ID** — you'll paste it into `mobile/app.json`

## Step 3 — Create the rewarded ad unit (3 min)

1. Inside your Student Focus app on AdMob → **Ad units** (left sidebar) → **Add ad unit**
2. Pick **Rewarded** (icon with a coin / video)
3. Ad unit name → `Override Gate Rewarded`
4. Defaults are fine (reward amount, frequency cap can be tuned later)
5. Click **Create ad unit**
6. AdMob shows the **Ad Unit ID**: `ca-app-pub-1246476538646622/YYYYYYYYYY` (the `/` matters)
7. **Copy that Ad Unit ID**

## Step 4 — Code changes (paste these IDs into 2 files)

### 4a. `mobile/app.json` — re-add the plugin block

Find the `plugins` array. Currently it's:
```jsonc
"plugins": [
  "expo-secure-store",
  "expo-notifications",
  "./plugins/withAppBlocker"
]
```

Add the AdMob plugin entry with YOUR App ID:
```jsonc
"plugins": [
  "expo-secure-store",
  "expo-notifications",
  "./plugins/withAppBlocker",
  [
    "react-native-google-mobile-ads",
    {
      "iosAppId": "ca-app-pub-1246476538646622~XXXXXXXXXX",
      "androidAppId": "ca-app-pub-1246476538646622~XXXXXXXXXX",
      "userTrackingUsageDescription": ""
    }
  ]
]
```

(Use the same App ID for Android until you create a separate Android app on AdMob.)

### 4b. `mobile/src/components/OverrideGate.tsx` — flip the flag + paste Ad Unit ID

Find these lines near the top of the file:
```ts
const ADS_ENABLED = false

let AdMob: any = null
if (ADS_ENABLED) {
  try { AdMob = require('react-native-google-mobile-ads') } catch (_) {}
}

const REWARDED_AD_UNIT_ID = AdMob?.TestIds?.REWARDED || 'ca-app-pub-3940256099942544/1712485313'
```

Change to:
```ts
const ADS_ENABLED = true

let AdMob: any = null
if (ADS_ENABLED) {
  try { AdMob = require('react-native-google-mobile-ads') } catch (_) {}
}

const REWARDED_AD_UNIT_ID = 'ca-app-pub-1246476538646622/YYYYYYYYYY'
```

That's it. No other code changes — the OverrideGate already has the full ad-loading machinery; the flag just gated it off.

## Step 5 — Update App Store Connect

When you submit the next version with ads enabled:

- **Capabilities questionnaire (age-rating section)**: change **Advertising** from NO to **YES**
- **App Privacy questionnaire**: add a new declaration that data is collected for "Third-Party Advertising" — for non-personalized ads, declare anonymized impression counts only. Do NOT mark "Tracking" as Yes unless you also upgrade to personalized ads (see `PERSONALIZED_ADS_UPGRADE.md`).
- **Privacy policy**: the existing `docs/privacy.html` already has the AdMob section (we wrote it in v1.0). It's accurate for non-personalized ads — no changes needed.

## Step 6 — Build + ship

```
cd mobile
eas build --platform ios --profile production --auto-submit
```

Test on TestFlight first: trigger the override gate, expect a real ~30-second rewarded video to play during the wait. If a real ad loads, you're done.

## Notes

- **Non-personalized ads only** (no IDFA, no ATT prompt) — the OverrideGate code passes `requestNonPersonalizedAdsOnly: true` to AdMob. Switching to personalized (higher revenue) is a separate workstream documented in `PERSONALIZED_ADS_UPGRADE.md`.
- **Revenue scale**: at indie launch volume (~50–500 DAU), expect $0.10–$0.50/day. Don't quit your day job.
- **Apple review caveat**: a build with `ADS_ENABLED = false` but the AdMob plugin still referenced in `app.json` would ship SKAdNetwork entries and `GADApplicationIdentifier` to Info.plist without actually showing ads. Apple might flag this. That's why v1.0 also removes the plugin from `app.json` entirely.
