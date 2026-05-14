import { Alert, Linking, Platform } from 'react-native'

/** Opens this app’s page in Settings (notifications, background, etc.). */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings()
  } catch {
    Alert.alert('Could not open Settings')
  }
}

/**
 * Tries to jump near Screen Time / restrictions. Apple often blocks deep links;
 * we fall back to the Settings root and show short instructions.
 */
export async function openScreenTimeSettings(): Promise<void> {
  if (Platform.OS !== 'ios') {
    await openAppSettings()
    return
  }

  const candidates = [
    'App-Prefs:root=SCREEN_TIME',
    'prefs:root=SCREEN_TIME',
  ]

  for (const url of candidates) {
    try {
      const ok = await Linking.canOpenURL(url)
      if (ok) {
        await Linking.openURL(url)
        return
      }
    } catch {
      /* try next */
    }
  }

  try {
    await Linking.openURL('App-prefs:')
  } catch {
    await openAppSettings()
  }

  Alert.alert(
    'Screen Time',
    'If Settings did not open to Screen Time: open the Settings app, tap Screen Time, then App Limits or Downtime to block apps. Apple only allows blocking from there or Focus modes—third-party apps cannot read your Screen Time data.',
  )
}

export async function openFocusModesHelp(): Promise<void> {
  const url = 'https://support.apple.com/guide/iphone/use-focus-iphb401c2582/ios'
  try {
    await Linking.openURL(url)
  } catch {
    Alert.alert('Open this link in Safari for Focus setup.', url)
  }
}
