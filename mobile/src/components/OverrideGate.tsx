import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { cardRadius, colors, fonts, space } from '../theme'
import { getOutgoingSecret, verifyFriendCode } from '../utils/friendControl'

let Haptics: any = null
try { Haptics = require('expo-haptics') } catch (_) {}

// AdMob: fully removed for the v1.0 launch (ships without ads).
// The `react-native-google-mobile-ads` package is NOT installed: keeping it as a
// dependency while the config plugin is absent makes the native SDK crash at
// launch (missing GADApplicationIdentifier in Info.plist). All the ad-loading
// machinery below stays intact but no-ops while AdMob is null. To re-enable ads,
// reinstall the package, re-add its config plugin to app.json, and restore the
// `require(...)` below, see ADMOB_SETUP_LATER.md.
const ADS_ENABLED = false

let AdMob: any = null
// if (ADS_ENABLED) {
//   try { AdMob = require('react-native-google-mobile-ads') } catch (_) {}
// }

const REWARDED_AD_UNIT_ID = AdMob?.TestIds?.REWARDED || 'ca-app-pub-3940256099942544/1712485313'

const HOLD_SECONDS = 10
const ADS_SECONDS = 4 * 60
const GRACE_WINDOW_MS = 45 * 60 * 1000
export const OVERRIDE_GRACE_KEY = '@nova_override_grace_until'

// Friend-code brute-force protection (M3). After FRIEND_MAX_ATTEMPTS consecutive
// failures we lock submission behind an exponential backoff window. The failed
// counter + lockout-until timestamp are persisted so the lockout survives a
// modal close / app restart and can't be reset by retrying.
const FRIEND_FAIL_COUNT_KEY = '@nova_friend_fail_count'
const FRIEND_LOCKOUT_UNTIL_KEY = '@nova_friend_lockout_until'
const FRIEND_MAX_ATTEMPTS = 5
const FRIEND_LOCKOUT_BASE_MS = 30 * 1000
const FRIEND_LOCKOUT_MAX_MS = 30 * 60 * 1000

export async function grantOverrideGrace(): Promise<void> {
  try {
    await AsyncStorage.setItem(OVERRIDE_GRACE_KEY, String(Date.now() + GRACE_WINDOW_MS))
  } catch (_) {}
}

export async function isInOverrideGrace(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_GRACE_KEY)
    if (!raw) return false
    const until = Number(raw)
    return Number.isFinite(until) && Date.now() < until
  } catch (_) {
    return false
  }
}

type Props = {
  visible: boolean
  onSuccess: () => void
  onCancel: () => void
}

type Stage = 'hold' | 'ads' | 'friend'

export function OverrideGate({ visible, onSuccess, onCancel }: Props) {
  const [method, setMethod] = useState<'self' | 'friend' | null>(null)
  const [stage, setStage] = useState<Stage>('hold')
  const [holdProgress, setHoldProgress] = useState(0)
  const [adsRemaining, setAdsRemaining] = useState(ADS_SECONDS)
  const [friendCode, setFriendCode] = useState('')
  const [friendErr, setFriendErr] = useState('')
  const holdTimerRef = useRef<any>(null)
  const adsTimerRef = useRef<any>(null)
  const holdingRef = useRef(false)
  const adsHapticMinuteRef = useRef(0)
  const iosVibIntervalRef = useRef<any>(null)
  const lastHapticAtRef = useRef<number>(0)
  // Ads
  const rewardedRef = useRef<any>(null)
  const adUnsubsRef = useRef<Array<() => void>>([])
  const adTimeoutsRef = useRef<Array<any>>([])
  const isShowingAdRef = useRef(false)
  const adLoadedRef = useRef(false)
  const [adStatus, setAdStatus] = useState<'idle' | 'loading' | 'ready' | 'playing' | 'failed'>('idle')

  // Tracks whether the gate is mounted + visible so async callbacks (grace
  // grant, lockout ticks) don't fire onSuccess / setState after teardown.
  const mountedRef = useRef(true)

  // Friend-code brute-force protection (M3). Persisted per gate in AsyncStorage.
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const lockoutTimerRef = useRef<any>(null)

  useEffect(() => {
    if (!visible) return
    ;(async () => {
      const m = await AsyncStorage.getItem('@nova_override_method')
      let resolved: 'self' | 'friend' = m === 'friend' ? 'friend' : 'self'
      // If the user picked Friend Control during onboarding but never finished
      // setting it up (no outgoing secret = never tapped Generate/Share), fall
      // back to Self Control so they can still override their own blocks.
      if (resolved === 'friend') {
        const secret = await getOutgoingSecret()
        if (!secret) resolved = 'self'
      }
      setMethod(resolved)
      setStage(resolved === 'friend' ? 'friend' : 'hold')
      setHoldProgress(0)
      setAdsRemaining(ADS_SECONDS)
      setFriendCode('')
      setFriendErr('')
      // Re-sync any persisted friend-code lockout so a reopened modal still
      // shows the countdown instead of an immediately-submittable form (M3).
      await syncLockout()
    })()
  }, [visible])

  const teardownAd = () => {
    adUnsubsRef.current.forEach((u) => { try { u() } catch (_) {} })
    adUnsubsRef.current = []
    // Clear any pending ad-lifecycle timers (CLOSED/ERROR follow-ups) so they
    // don't fire after teardown or leak across an ad re-enable (N2).
    adTimeoutsRef.current.forEach((id) => { try { clearTimeout(id) } catch (_) {} })
    adTimeoutsRef.current = []
    rewardedRef.current = null
    adLoadedRef.current = false
    isShowingAdRef.current = false
  }

  const loadNextAd = () => {
    if (!AdMob || !AdMob.RewardedAd) { setAdStatus('failed'); return }
    teardownAd()
    setAdStatus('loading')
    const ad = AdMob.RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    })
    rewardedRef.current = ad
    const unsubLoaded = ad.addAdEventListener(AdMob.RewardedAdEventType.LOADED, () => {
      adLoadedRef.current = true
      setAdStatus('ready')
      // Auto-show if we're still in the ads stage and not already showing
      if (adsTimerRef.current && !isShowingAdRef.current) {
        try {
          isShowingAdRef.current = true
          setAdStatus('playing')
          ad.show()
        } catch (_) {
          isShowingAdRef.current = false
          setAdStatus('failed')
        }
      }
    })
    const unsubClosed = ad.addAdEventListener(AdMob.AdEventType.CLOSED, () => {
      // Hold the "isShowingAdRef" true a brief moment to absorb the AppState
      // 'inactive'/'background' events AdMob fires when dismissing its UI.
      adTimeoutsRef.current.push(setTimeout(() => { isShowingAdRef.current = false }, 1200))
      // Queue next ad if timer still running
      if (adsTimerRef.current) {
        adTimeoutsRef.current.push(setTimeout(() => { if (adsTimerRef.current) loadNextAd() }, 250))
      }
    })
    const unsubError = ad.addAdEventListener(AdMob.AdEventType.ERROR, () => {
      isShowingAdRef.current = false
      setAdStatus('failed')
      // Retry after 5s as long as the timer is still running
      adTimeoutsRef.current.push(setTimeout(() => { if (adsTimerRef.current) loadNextAd() }, 5000))
    })
    adUnsubsRef.current = [unsubLoaded, unsubClosed, unsubError]
    try {
      ad.load()
    } catch (_) {
      setAdStatus('failed')
    }
  }

  const cancelAll = () => {
    holdingRef.current = false
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (adsTimerRef.current) {
      clearInterval(adsTimerRef.current)
      adsTimerRef.current = null
    }
    teardownAd()
    setAdStatus('idle')
    if (iosVibIntervalRef.current) {
      clearInterval(iosVibIntervalRef.current)
      iosVibIntervalRef.current = null
    }
    Vibration.cancel()
    setHoldProgress(0)
    setAdsRemaining(ADS_SECONDS)
  }

  useEffect(() => {
    if (!visible) return
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        // Don't cancel if we're inside a fullscreen rewarded ad. AdMob fires
        // 'inactive'/'background' on the host app while showing its UI.
        if (isShowingAdRef.current) return
        cancelAll()
        if (stage === 'ads' || stage === 'hold') {
          setStage(method === 'friend' ? 'friend' : 'hold')
        }
      }
    })
    return () => sub.remove()
  }, [visible, stage, method])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current)
        lockoutTimerRef.current = null
      }
      cancelAll()
    }
  }, [])

  const startHold = () => {
    if (stage !== 'hold') return
    holdingRef.current = true
    lastHapticAtRef.current = 0

    // Continuous baseline buzz for the full hold. iOS vibration is fixed ~400ms
    // per call, so re-trigger it on a 400ms interval to keep it going.
    if (Platform.OS === 'android') {
      Vibration.vibrate(HOLD_SECONDS * 1000)
    } else {
      Vibration.vibrate()
      iosVibIntervalRef.current = setInterval(() => {
        if (!holdingRef.current) return
        Vibration.vibrate()
      }, 400)
    }

    if (holdTimerRef.current) clearInterval(holdTimerRef.current)
    const startedAt = Date.now()
    holdTimerRef.current = setInterval(() => {
      if (!holdingRef.current) return
      const elapsed = (Date.now() - startedAt) / 1000
      const p = Math.min(1, elapsed / HOLD_SECONDS)
      setHoldProgress(p)

      // Layer haptic punches at increasing frequency over the baseline buzz.
      // Smoothly interpolated 800ms -> 80ms across the hold for a "rising" feel.
      const targetIntervalMs = 800 - p * 720
      const nowMs = Date.now()
      if (nowMs - lastHapticAtRef.current >= targetIntervalMs) {
        lastHapticAtRef.current = nowMs
        try {
          if (Haptics && Haptics.impactAsync && Haptics.ImpactFeedbackStyle) {
            const style = p < 0.4
              ? Haptics.ImpactFeedbackStyle.Light
              : p < 0.75
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Heavy
            Haptics.impactAsync(style)
          }
        } catch (_) {}
      }

      if (p >= 1) {
        clearInterval(holdTimerRef.current)
        holdTimerRef.current = null
        holdingRef.current = false
        if (iosVibIntervalRef.current) {
          clearInterval(iosVibIntervalRef.current)
          iosVibIntervalRef.current = null
        }
        Vibration.cancel()
        try {
          if (Haptics && Haptics.notificationAsync && Haptics.NotificationFeedbackType) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        } catch (_) {}
        beginAds()
      }
    }, 50)
  }

  const stopHold = () => {
    holdingRef.current = false
    Vibration.cancel()
    if (iosVibIntervalRef.current) {
      clearInterval(iosVibIntervalRef.current)
      iosVibIntervalRef.current = null
    }
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHoldProgress(0)
  }

  const beginAds = () => {
    setStage('ads')
    setAdsRemaining(ADS_SECONDS)
    adsHapticMinuteRef.current = 0
    if (adsTimerRef.current) clearInterval(adsTimerRef.current)
    const startedAt = Date.now()
    adsTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const remaining = Math.max(0, ADS_SECONDS - elapsed)
      setAdsRemaining(remaining)
      const minute = Math.floor(elapsed / 60)
      if (minute > adsHapticMinuteRef.current) {
        adsHapticMinuteRef.current = minute
        try { Haptics && Haptics.impactAsync && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) } catch (_) {}
      }
      if (remaining <= 0) {
        clearInterval(adsTimerRef.current)
        adsTimerRef.current = null
        teardownAd()
        // Grace is always granted (the timer completed), but only call back
        // into the parent if we're still mounted/visible so we don't trigger a
        // navigation/setState on an unmounted gate (L10).
        grantOverrideGrace().finally(() => { if (mountedRef.current) onSuccess() })
      }
    }, 250)
    // Kick off the first rewarded ad. Subsequent ads chain via the CLOSED handler.
    loadNextAd()
  }

  // Reads the persisted lockout-until and starts/keeps a 1s countdown ticking so
  // the Submit button stays disabled with a live "try again in Xs" message.
  const syncLockout = async () => {
    let until = 0
    try {
      const raw = await AsyncStorage.getItem(FRIEND_LOCKOUT_UNTIL_KEY)
      until = raw ? Number(raw) : 0
    } catch (_) {}
    if (!Number.isFinite(until)) until = 0

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      if (mountedRef.current) setLockoutRemaining(remaining)
      if (remaining <= 0 && lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current)
        lockoutTimerRef.current = null
      }
    }

    if (lockoutTimerRef.current) {
      clearInterval(lockoutTimerRef.current)
      lockoutTimerRef.current = null
    }
    tick()
    if (until > Date.now()) {
      lockoutTimerRef.current = setInterval(tick, 1000)
    }
  }

  // Records a failed attempt and, once the threshold is crossed, sets an
  // exponentially backed-off lockout window (capped). Returns the seconds the
  // caller is now locked out for (0 if still under the threshold).
  const registerFriendFailure = async (): Promise<number> => {
    let count = 0
    try {
      const raw = await AsyncStorage.getItem(FRIEND_FAIL_COUNT_KEY)
      count = raw ? Number(raw) : 0
    } catch (_) {}
    if (!Number.isFinite(count) || count < 0) count = 0
    count += 1

    let lockoutSecs = 0
    try {
      await AsyncStorage.setItem(FRIEND_FAIL_COUNT_KEY, String(count))
      if (count >= FRIEND_MAX_ATTEMPTS) {
        const over = count - FRIEND_MAX_ATTEMPTS
        const windowMs = Math.min(FRIEND_LOCKOUT_MAX_MS, FRIEND_LOCKOUT_BASE_MS * Math.pow(2, over))
        const until = Date.now() + windowMs
        await AsyncStorage.setItem(FRIEND_LOCKOUT_UNTIL_KEY, String(until))
        lockoutSecs = Math.ceil(windowMs / 1000)
      }
    } catch (_) {}
    return lockoutSecs
  }

  const clearFriendFailures = async () => {
    try {
      await AsyncStorage.multiRemove([FRIEND_FAIL_COUNT_KEY, FRIEND_LOCKOUT_UNTIL_KEY])
    } catch (_) {}
  }

  const submitFriendCode = async () => {
    // Hard-stop while locked out (M3): re-check the persisted timestamp in case
    // the in-memory countdown is stale, and refresh the visible counter.
    if (lockoutRemaining > 0) {
      await syncLockout()
      return
    }

    const cleaned = friendCode.replace(/\D/g, '')
    if (cleaned.length !== 6) {
      setFriendErr('Enter the 6-digit code from your friend.')
      return
    }
    const secret = await getOutgoingSecret()
    if (!secret) {
      setFriendErr('Set up Friend Control in Settings first.')
      return
    }
    if (verifyFriendCode(secret, cleaned)) {
      await clearFriendFailures()
      if (mountedRef.current) setLockoutRemaining(0)
      await grantOverrideGrace()
      if (mountedRef.current) onSuccess()
    } else {
      const lockoutSecs = await registerFriendFailure()
      if (lockoutSecs > 0) {
        await syncLockout()
        setFriendErr(`Too many wrong codes. Try again in ${lockoutSecs}s.`)
      } else {
        setFriendErr('Code does not match. Ask your friend for the current one.')
      }
    }
  }

  const minutes = Math.floor(adsRemaining / 60)
  const secs = adsRemaining % 60

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.card}>
          {stage === 'hold' && (
            <>
              <Text style={styles.title}>Prove you mean it.</Text>
              <Text style={styles.sub}>
                Hold the button below for {HOLD_SECONDS} seconds, then sit through {Math.round(ADS_SECONDS / 60)} minutes of ads.
                Leaving the app cancels the whole thing.
              </Text>
              <Pressable
                onPressIn={startHold}
                onPressOut={stopHold}
                style={styles.holdBtn}
              >
                <View style={[styles.holdFill, { width: `${Math.round(holdProgress * 100)}%` }]} />
                <Text style={styles.holdLabel}>
                  {holdProgress >= 1 ? 'Starting ads...' : 'Hold to override'}
                </Text>
              </Pressable>
              <Pressable onPress={() => { cancelAll(); onCancel() }} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </>
          )}

          {stage === 'ads' && (
            <>
              <Text style={styles.title}>Watching ads</Text>
              <Text style={styles.sub}>If you leave the app the timer resets and you start over.</Text>
              <View style={styles.adPanel}>
                <Text style={styles.adPlaceholder}>AD</Text>
                <Text style={styles.adPlaceholderHint}>
                  {adStatus === 'loading' ? 'Loading…' :
                   adStatus === 'ready'   ? 'Ad ready' :
                   adStatus === 'playing' ? 'Ad playing' :
                   adStatus === 'failed'  ? 'No ad available, keep waiting' :
                   'Preparing…'}
                </Text>
              </View>
              <Text style={styles.timer}>{String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}</Text>
              <Pressable onPress={() => { cancelAll(); onCancel() }} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </>
          )}

          {stage === 'friend' && (
            <>
              <Text style={styles.title}>Enter the code from your friend.</Text>
              <Text style={styles.sub}>Your friend's code rotates every hour. Ask them for the current one.</Text>
              <TextInput
                value={friendCode}
                onChangeText={v => { setFriendCode(v.replace(/\D/g, '').slice(0, 6)); setFriendErr('') }}
                style={[styles.codeInput, friendErr ? { borderColor: '#ff453a' } : null]}
                placeholder="------"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {!!friendErr && <Text style={styles.err}>{friendErr}</Text>}
              {lockoutRemaining > 0 && (
                <Text style={styles.err}>Too many wrong codes. Try again in {lockoutRemaining}s.</Text>
              )}
              <Pressable
                onPress={submitFriendCode}
                style={[styles.primaryBtn, (friendCode.length < 6 || lockoutRemaining > 0) && { opacity: 0.4 }]}
                disabled={friendCode.length < 6 || lockoutRemaining > 0}
              >
                <Text style={styles.primaryLabel}>{lockoutRemaining > 0 ? `Wait ${lockoutRemaining}s` : 'Submit'}</Text>
              </Pressable>
              <Pressable onPress={() => { cancelAll(); onCancel() }} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  scrollInner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.container, paddingTop: 60, paddingBottom: 24 },
  card: { backgroundColor: '#0a0a0a', borderRadius: cardRadius, borderWidth: 1, borderColor: colors.outline, padding: 24 },
  title: { color: colors.text, fontSize: 22, ...fonts.semibold, marginBottom: 8 },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  holdBtn: {
    height: 72,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  holdFill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,69,58,0.4)',
  },
  holdLabel: { color: colors.text, fontSize: 16, ...fonts.semibold, zIndex: 1 },
  adPanel: {
    height: 220,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  adPlaceholder: { color: 'rgba(255,255,255,0.3)', fontSize: 56, ...fonts.bold },
  adPlaceholderHint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 },
  timer: { color: colors.text, fontSize: 48, ...fonts.bold, textAlign: 'center', marginBottom: 16 },
  codeInput: {
    color: colors.text,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  err: { color: '#ff453a', fontSize: 13, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: colors.text,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryLabel: { color: '#000', ...fonts.semibold, fontSize: 16 },
  cancelBtn: { alignSelf: 'center', paddingVertical: 8 },
  cancelLabel: { color: colors.muted, fontSize: 14 },
})
