# Launch checklist — manual steps only YOU can do

Everything in this file requires your Apple/GitHub/Supabase logins, your physical iPhone, or human judgment. Things I (Claude) handle from code (Swift module, build, push) are NOT in this list.

Order is roughly chronological, but A1–A5 can all run in parallel today.

---

## Phase A — Do these RIGHT NOW (parallel)

### [ ] A1 — Apply for FamilyControls entitlement (most critical, 1–2 week wait)

This is the single thing that gates everything else. Start it today.

1. Go to **https://developer.apple.com/contact/request/family-controls-distribution**
2. Sign in with the Apple ID that owns team `DFYFWYGNJR`
3. Fill the form. Paste this in the justification field (edit if you want):

```
Student Focus is a free productivity app designed for students. It helps users
manage their own usage of distracting apps (Instagram, TikTok, YouTube, etc.)
by letting them set time limits on apps they choose. When a limit is reached,
the app blocks access via ManagedSettings. Users can override their own block
through either a 10-second hold + 4-minute waiting period (Self Control) or
by entering a rotating code from an accountability friend (Friend Control).
All blocking is opt-in and applies only to the user's own device. We are not
building a parental control product, nor will we sell, share, or aggregate
any data about app usage.

Why FamilyControls: ManagedSettings is the only Apple-sanctioned API that
allows an app to shield other apps from the user. Without it, the only
alternative is the user manually configuring Screen Time, which defeats the
purpose of an app that automates focus enforcement.
```

4. Submit. Apple emails back in 1–2 weeks (sometimes faster).
5. **When approved, message me** and I'll un-stub the Swift module + rebuild.

---

### [ ] A2 — Host the privacy policy on GitHub Pages (5 min)

1. Go to **https://github.com/LiveFonam/AppBlocker/settings/pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` | **Folder**: `/docs`
4. Click **Save**
5. Wait ~1 minute, then test these URLs on your phone:
   - https://livefonam.github.io/AppBlocker/privacy.html
   - https://livefonam.github.io/AppBlocker/terms.html
6. Both should load. If they don't, ping me — likely a docs-folder structure issue.

> You can swap to `studentfocusapp.com` later. The privacy URL field in App Store Connect is editable any time, no re-review needed.

---

### [ ] A3 — Draft App Store metadata (text only, ~30 min)

You'll paste these into App Store Connect later. Start drafts now so you're not under pressure when the entitlement clears.

**Required (with Apple char limits):**

- **App name** (30 chars): `Student Focus`
- **Subtitle** (30 chars): `Block distractions, study more`
- **Promotional text** (170 chars):
  ```
  The free app blocker built for students. Set limits on the apps that steal your time. Override only with a 4-minute wait or a friend's permission.
  ```
- **Description** (4000 chars): write a long version covering: what it does, how it works (per-app limits, override gate, friend control), who it's for. **Do NOT say "blocks any app" or "unblockable" — say "block apps you choose during focus sessions, using Apple's Screen Time API"** (avoids review rejection for over-claiming).
- **Keywords** (100 chars, comma-separated):
  ```
  focus,study,app blocker,screen time,students,accountability,distraction,productivity
  ```
- **Support URL**: `https://livefonam.github.io/AppBlocker/` (or studentfocusapp.com when live)
- **Privacy policy URL**: `https://livefonam.github.io/AppBlocker/privacy.html`
- **Marketing URL**: optional, can skip
- **Category** — primary: **Productivity** | secondary (optional): **Health & Fitness**

---

### [ ] A4 — Create the Apple reviewer demo account (5 min)

Apple reviewers can't get past your email-OTP sign-in without a working account.

1. Pick an email you control (e.g. `apple-reviewer@gmail.com`, or `+reviewer` alias on your own email like `lucas+reviewer@gmail.com`)
2. Verify you can receive mail there
3. Save the email + a strong password somewhere (1Password / Notes app)
4. **Test it** — open TestFlight build 23 on your phone, sign in with this email, complete the OTP flow. If the OTP arrives and login works, you're set.
5. Hold onto these credentials for the Review Notes field in App Store Connect later.

---

### [ ] A5 — Take iPhone screenshots from TestFlight build 23 (30 min)

Apple requires 2–8 phone screenshots. Suggested set:

1. **Home / dashboard**
2. **Block tab** → Manage my list (showing app limits)
3. **Override gate** with the 10s hold UI mid-press
4. **Friend Control panel** → Inbox section with at least one row
5. **Stats** or focus session running
6. **Onboarding slide 1** (the iOS glass permission sheet) — shows polish

How to take:
- iPhone: Side button + Volume Up at the same time → check Photos app
- AirDrop them to your computer, or upload directly to ASC from your phone later

Required sizes (Apple resizes some automatically):
- **6.7" / 6.9"** (iPhone 15 Pro Max, iPhone 16 Pro Max) — mandatory
- **6.5"** (iPhone 11 Pro Max) — usually mandatory
- **5.5"** (iPhone 8 Plus) — often still required for legacy

If you only have one phone, take screenshots at the biggest size you have; Apple's "App Preview" tool can downscale for the smaller required sizes.

---

## Phase B — When Apple approves the FamilyControls entitlement

### [ ] B1 — Tell me

Send me the email or screenshot from Apple. I'll then:
- Un-stub `AppBlockerModule.swift` (the real FamilyControls implementation, drafted ahead of time)
- Restore the entitlement in `app.json`
- Add `NSLocalNetworkUsageDescription` to infoPlist
- Remove the iOS short-circuit in `plugins/withAppBlocker.js`
- Build the production version + auto-submit to TestFlight

### [ ] B2 — Run the account-deletion SQL on Supabase

Apple guideline 5.1.1(v) **requires** in-app account deletion for any app with login. I'll write the Supabase RPC + the in-app UI before submission. When ready, you'll:

1. Open Supabase dashboard → SQL Editor
2. Paste the SQL block I'll send (creates a `delete_my_account()` RPC)
3. Run it
4. The in-app "Delete my account" button will then work

### [ ] B3 — Test the real-blocking build on your physical iPhone

When I push the entitlement-enabled build to TestFlight, install it and verify:
1. Onboarding completes; Screen Time permission prompt appears + you accept
2. Add Instagram (or some installed app) to the block list, start a focus session, try to open Instagram → expect the system Screen Time shield
3. Friend Control + override gate still work
4. Account deletion: Settings → "Delete account" → confirm → app signs out + data is gone from Supabase

Screenshot anything broken and send it.

---

## Phase C — App Store submission (after B passes)

### [ ] C1 — App Store Connect metadata

Go to **https://appstoreconnect.apple.com → My Apps → Student Focus → App Store tab → Version 1.0**

Fill in every section (paste from A3 + A5):
- **App Information**: name, subtitle, category, primary language
- **Privacy Policy URL** (paste from A2)
- **Support URL**
- **Promotional text + Description + Keywords**
- **Screenshots** (drag/upload from A5)
- **Pricing & Availability**: Free, all countries (or pick yours)
- **App Privacy** — questionnaire (see C2)

Each section must be green-checked.

---

### [ ] C2 — App Privacy questionnaire

In ASC under your version page → **App Privacy** → "Get Started"

Declare honestly:

**Data Collected:**
- **Email Address** — Used for: App Functionality (authentication). Linked to user identity. Not used for tracking.
- **User ID** — Supabase auth UID. Used for: App Functionality. Linked to user identity. Not used for tracking.
- **Other data — friend pairing codes** — accountability code data. Used for: App Functionality. Linked to user identity. Not used for tracking.

**Data NOT Collected / "No, we do not collect data from this app":**
- Location, Photos, Contacts, Health, Financial info, etc.

**Tracking:** "We do not track users"

> If you later add analytics (Sentry, PostHog, Crashlytics), come back and update this. Apple takes inaccurate App Privacy declarations seriously.

---

### [ ] C3 — Review Notes + demo account

Same version page → **App Review Information** section. Paste:

```
Hi Apple Review Team,

Student Focus is a self-control app for students. To test:

DEMO ACCOUNT:
Email: <paste demo email from A4>
Note: Sign-in is email + 6-digit OTP. Please check the demo inbox for the
verification code when you sign in.

WALKTHROUGH:
1. Complete onboarding with the demo account above.
2. Go to "Block" tab → "Manage my list" → tap an app → set a daily limit.
3. To test the override gate: try to RAISE a limit. The app prompts a 10-second
   hold + 4-minute "anti-impulse" wait before allowing the change.
4. Friend Control flow is in Settings → Friend Control (optional to test).

The app uses Apple's Screen Time API (FamilyControls / ManagedSettings) to
enforce focus sessions. Users opt in during onboarding via the system Screen
Time permission prompt. All blocking is self-imposed and only applies to the
user's own device.

Privacy policy: https://livefonam.github.io/AppBlocker/privacy.html

Thanks for reviewing!
```

Set **Contact Information** to your real email/phone (Apple may call/email if they have questions).

---

### [ ] C4 — Select build + submit

Same page → **Build** section → "+" → pick the latest entitlement-enabled production build (the one we made in B1).

Then at the top of the page → **Add for Review** → confirm → **Submit to App Review**.

---

### [ ] C5 — Wait for review

Status will progress: `Waiting for Review` → `In Review` → `Pending Developer Release` (or `Rejected`).

Typical timeline: **1–3 business days.**

If rejected: read the feedback in Resolution Center, fix what they cite, resubmit. Don't argue back unless their interpretation is clearly wrong.

---

### [ ] C6 — Manual release

When you set up Version 1.0, **choose "Manually release this version"** (not auto). Then when Apple approves:

- Status shows `Pending Developer Release`
- Click **Release This Version**
- Live on App Store within ~24 hours

---

## Things I'm doing on my side (you don't need to do these)

- A6 — drafting the real `AppBlockerModule.swift` (FamilyControls implementation)
- Building account-deletion UI in Settings (the SQL above is what you run)
- Polishing/auditing the App Store description copy after you draft A3
- Any further builds, commits, pushes

---

## Cost / time summary

| Item | $ | Time |
|---|---|---|
| Apple Developer Program | $99/yr (already paid) | — |
| FamilyControls entitlement application | Free | 10 min form + 1–2 wk wait |
| GitHub Pages | Free | 5 min |
| Privacy/terms hosting | Free (covered by GH Pages) | 0 |
| App Store review | Free | 1–3 days |
| **Total cash** | **$0 incremental** | **~3–6 weeks calendar** |
