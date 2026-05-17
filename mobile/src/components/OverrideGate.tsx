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

const HOLD_SECONDS = 10
const ADS_SECONDS = 4 * 60
const GRACE_WINDOW_MS = 45 * 60 * 1000
export const OVERRIDE_GRACE_KEY = '@nova_override_grace_until'

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

  useEffect(() => {
    if (!visible) return
    AsyncStorage.getItem('@nova_override_method').then((m) => {
      const resolved = m === 'friend' ? 'friend' : 'self'
      setMethod(resolved)
      setStage(resolved === 'friend' ? 'friend' : 'hold')
      setHoldProgress(0)
      setAdsRemaining(ADS_SECONDS)
      setFriendCode('')
      setFriendErr('')
    })
  }, [visible])

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
        cancelAll()
        if (stage === 'ads' || stage === 'hold') {
          setStage(method === 'friend' ? 'friend' : 'hold')
        }
      }
    })
    return () => sub.remove()
  }, [visible, stage, method])

  useEffect(() => {
    return () => {
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
        grantOverrideGrace().finally(() => onSuccess())
      }
    }, 250)
  }

  const submitFriendCode = async () => {
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
      await grantOverrideGrace()
      onSuccess()
    } else {
      setFriendErr('Code does not match. Ask your friend for the current one.')
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
                <Text style={styles.adPlaceholderHint}>(real ads come in a future build)</Text>
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
              <Pressable onPress={submitFriendCode} style={[styles.primaryBtn, friendCode.length < 6 && { opacity: 0.4 }]} disabled={friendCode.length < 6}>
                <Text style={styles.primaryLabel}>Submit</Text>
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
