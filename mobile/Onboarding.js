import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, Platform, TextInput, Vibration,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, Linking, AppState,
} from 'react-native';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch (_) {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/supabase';
import { isUniversityDomain } from './src/universityDomains';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (_) {}

const { width: W, height: H } = Dimensions.get('window');
const TOTAL = 17;

const O = {
  bg:     '#000000',
  card:   '#111111',
  border: '#1c1c1c',
  white:  '#ffffff',
  red:    '#ff3b30',
  green:  '#30d158',
  muted:  'rgba(255,255,255,0.4)',
  dim:    'rgba(255,255,255,0.15)',
};

const GUESS_VALUES = Array.from({ length: 32 }, (_, i) => +((i + 1) * 0.5).toFixed(1));
const ITEM_W = Math.round(W / 4);
const SIDE_PAD = (W - ITEM_W) / 2;

function supportsScreenTime() {
  if (Platform.OS !== 'ios') return false;
  const parts = String(Platform.Version).split('.').map(Number);
  return parts[0] > 17 || (parts[0] === 17 && (parts[1] || 0) >= 4);
}

const IOS_APP_SCHEMES = [
  { id: 'tiktok',    name: 'TikTok',     scheme: 'snssdk1233://' },
  { id: 'instagram', name: 'Instagram',  scheme: 'instagram://' },
  { id: 'youtube',   name: 'YouTube',    scheme: 'youtube://' },
  { id: 'snapchat',  name: 'Snapchat',   scheme: 'snapchat://' },
  { id: 'twitter',   name: 'X / Twitter',scheme: 'twitter://' },
  { id: 'discord',   name: 'Discord',    scheme: 'discord://' },
  { id: 'reddit',    name: 'Reddit',     scheme: 'reddit://' },
  { id: 'facebook',  name: 'Facebook',   scheme: 'fb://' },
  { id: 'netflix',   name: 'Netflix',    scheme: 'nflx://' },
  { id: 'spotify',   name: 'Spotify',    scheme: 'spotify://' },
];

const ANDROID_BAD_PKGS = [
  'com.google.android.youtube',
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.reddit.frontpage',
  'com.twitter.android',
  'com.snapchat.android',
  'com.facebook.katana',
  'com.discord',
];

function tStr(mins) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeStr(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3];
  if (isNaN(h) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h > 23) return null;
  return h * 60 + min;
}

export default function Onboarding({ onComplete, requestAuth, getUsageStats }) {
  const outerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL)).current;

  const [step,         setStep]         = useState(0);
  const [guessIdx,     setGuessIdx]     = useState(15);
  const [selectedApps, setSelectedApps] = useState([]);
  const [blockName,    setBlockName]    = useState('');
  const [startMins,    setStartMins]    = useState(540);
  const [endMins,      setEndMins]      = useState(660);
  const [email,        setEmail]        = useState('');
  const [emailErr,     setEmailErr]     = useState('');
  const [otpCode,      setOtpCode]      = useState('');
  const [otpErr,       setOtpErr]       = useState('');
  const [otpSending,   setOtpSending]   = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef(null);
  const cooldownEndsAtRef = useRef(0);
  const lastHapticIdxRef = useRef(-1);
  const scrollX = useRef(new Animated.Value(15 * ITEM_W)).current;
  const rcAnim0 = useRef(new Animated.Value(0)).current;
  const rcAnim1 = useRef(new Animated.Value(0)).current;
  const [blockingMode, setBlockingMode] = useState('strict');
  const [suggestedApps,setSuggestedApps]= useState([]);
  const [appsScanned,  setAppsScanned]  = useState(false);
  const [enforcementTypes, setEnforcementTypes] = useState([]);
  const [sameForAll,   setSameForAll]   = useState(true);
  const [dailyLimitMins, setDailyLimitMins] = useState(60);
  const [overrideMethod, setOverrideMethod] = useState(null);
  const [startInput,   setStartInput]   = useState('');
  const [endInput,     setEndInput]     = useState('');
  const [perAppConfig, setPerAppConfig] = useState({});
  const [expandedAppId, setExpandedAppId] = useState(null);
  const [showAppsHint, setShowAppsHint] = useState(false);
  const appsScrollRef = useRef(null);
  const appsHintAnim = useRef(new Animated.Value(0)).current;
  const [limitInputVisible, setLimitInputVisible] = useState(false);
  const [limitInputValue, setLimitInputValue] = useState('');

  const guessHours = GUESS_VALUES[guessIdx];
  const actualHours = +(guessHours * 1.4).toFixed(1);
  const diff        = +(actualHours - guessHours).toFixed(1);
  const cut         = +Math.max(0.5, actualHours - 1.5).toFixed(1);
  const studyHours  = +(diff / 2).toFixed(1);
  const weekHrs     = (cut * 7).toFixed(1);
  const daysBack    = Math.round((cut * 365) / 24);
  const recommendedMins = Math.max(15, Math.min(240, Math.round(actualHours * 20)));

  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => next(), 2500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && cooldownEndsAtRef.current > 0) {
        const remaining = Math.max(0, Math.ceil((cooldownEndsAtRef.current - Date.now()) / 1000));
        setResendCooldown(remaining);
        if (remaining === 0 && resendTimerRef.current) {
          clearInterval(resendTimerRef.current); resendTimerRef.current = null;
        }
      }
    });
    return () => {
      sub.remove();
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (step !== 5) return;
    rcAnim0.setValue(0); rcAnim1.setValue(0);
    Animated.stagger(400, [
      Animated.timing(rcAnim0, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(rcAnim1, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step !== 7) return;
    requestNotifs();
  }, [step]);

  useEffect(() => {
    setSameForAll(selectedApps.length <= 1);
  }, [selectedApps.length]);

  useEffect(() => {
    setShowAppsHint(false);
    appsHintAnim.setValue(0);
    if (step !== 9) return;
    const t = setTimeout(() => {
      setShowAppsHint(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(appsHintAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(appsHintAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }, 2000);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== 9) return;
    if (Platform.OS === 'android' && getUsageStats) {
      getUsageStats().then(stats => {
        if (!stats || !stats.length) return;
        const filtered = stats
          .filter(s => ANDROID_BAD_PKGS.includes(s.packageName))
          .sort((a, b) => b.totalMinutes - a.totalMinutes)
          .slice(0, 5)
          .map(s => ({ id: s.packageName, name: s.name, totalMinutes: s.totalMinutes }));
        if (filtered.length > 0) setSuggestedApps(filtered);
      }).catch(() => {});
    } else if (Platform.OS === 'ios') {
      Promise.all(
        IOS_APP_SCHEMES.map(app =>
          Linking.canOpenURL(app.scheme)
            .then(can => can ? app : null)
            .catch(() => null)
        )
      ).then(results => {
        const installed = results.filter(Boolean);
        setSuggestedApps(installed);
        setAppsScanned(true);
      });
    }
  }, [step]);

  const goTo = (i, animated = true) => {
    const n = Math.max(0, Math.min(TOTAL - 1, i));
    setStep(n);
    outerRef.current?.scrollTo({ x: n * W, animated });
    Animated.spring(progressAnim, {
      toValue: (n + 1) / TOTAL,
      tension: 60, friction: 12, useNativeDriver: false,
    }).start();
  };
  const shouldSkip = (idx) => {
    if (idx === 11) return true;
    if (idx === 12 && (!enforcementTypes.includes('block') || selectedApps.length > 1)) return true;
    if (idx === 13 && (!enforcementTypes.includes('limit') || selectedApps.length > 1)) return true;
    if (idx === 14 && (selectedApps.length <= 1 || enforcementTypes.length === 0)) return true;
    if (idx === 15 && !enforcementTypes.includes('limit')) return true;
    return false;
  };
  const nextValid = (from) => {
    let n = from + 1;
    while (n < TOTAL && shouldSkip(n)) n++;
    return n;
  };
  const prevValid = (from) => {
    let n = from - 1;
    while (n > 0 && shouldSkip(n)) n--;
    return n;
  };
  const next = () => {
    const target = nextValid(step);
    goTo(target, target - step <= 1);
  };
  const prev = () => {
    const target = prevValid(step);
    goTo(target, step - target <= 1);
  };

  const startResendCooldown = () => {
    cooldownEndsAtRef.current = Date.now() + 60_000;
    setResendCooldown(60);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownEndsAtRef.current - Date.now()) / 1000));
      setResendCooldown(remaining);
      if (remaining === 0) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    }, 1000);
  };

  const validateEmail = async () => {
    const domain = (email.split('@')[1] || '').toLowerCase();
    if (!domain) { setEmailErr('Enter your school email address'); return; }
    setOtpSending(true);
    const valid = await isUniversityDomain(domain);
    if (!valid) {
      setOtpSending(false);
      setEmailErr('School email required (e.g. name@mcgill.ca or name@school.edu)');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email });
    setOtpSending(false);
    if (error) { setEmailErr(error.message); return; }
    setEmailErr('');
    startResendCooldown();
    next();
  };

  const resendOtp = async () => {
    if (resendCooldown > 0 || otpResending) return;
    setOtpResending(true);
    setOtpErr('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    setOtpResending(false);
    if (error) { setOtpErr(error.message); return; }
    startResendCooldown();
  };

  const verifyOtp = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email, token: otpCode, type: 'email',
    });
    if (error) { setOtpErr('Incorrect code. Try again.'); return; }
    setOtpErr('');
    next();
  };

  const requestNotifs = async () => {
    try { if (Notifications) await Notifications.requestPermissionsAsync(); } catch (_) {}
    next();
  };

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.multiSet([
        ['@nova_onboarding_done', 'true'],
        ['@nova_blocked_apps',    JSON.stringify(selectedApps)],
        ['@nova_blocking_mode',   blockingMode],
        ['@nova_enforcement',     JSON.stringify(enforcementTypes)],
        ['@nova_same_for_all',    sameForAll ? 'true' : 'false'],
        ['@nova_daily_limit',     String(dailyLimitMins)],
        ['@nova_override_method', overrideMethod || 'self'],
        ['@nova_per_app_config',  JSON.stringify(perAppConfig)],
      ]);
    } catch (_) {}

    // Sync to Supabase so the user can restore on another device.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          override_method: overrideMethod || 'self',
          blocking_mode: blockingMode,
          onboarding_completed_at: new Date().toISOString(),
        });
        if (selectedApps.length > 0) {
          const rows = selectedApps.map((app_id) => {
            const cfg = perAppConfig[app_id] || { startMins, endMins, dailyLimitMins };
            return {
              user_id: user.id,
              app_id,
              enabled: true,
              daily_limit_mins: cfg.dailyLimitMins ?? dailyLimitMins,
              time_block_start_mins: cfg.startMins ?? startMins,
              time_block_end_mins: cfg.endMins ?? endMins,
            };
          });
          await supabase.from('block_settings').upsert(rows);
        }
      }
    } catch (_) {}

    onComplete({
      blockName: blockName || 'Focus Block',
      selectedApps, startMins, endMins, blockingMode, email,
      enforcementTypes, sameForAll, dailyLimitMins, overrideMethod: overrideMethod || 'self',
      perAppConfig,
    });
  };

  // ── Slide data ─────────────────────────────────────────────────────────────
  const REALITY_DATA = [
    { label: 'You said', value: guessHours % 1 === 0 ? `${guessHours}h` : `${guessHours.toFixed(1)}h`, sub: 'per day',                                      color: O.white },
    { label: 'Reality',  value: actualHours % 1 === 0 ? `${actualHours}h` : `${actualHours.toFixed(1)}h`, sub: `+${diff.toFixed(1)}h you didn't account for`, color: O.red   },
  ];

  const BENEFIT_DATA = [
    { title: 'Study Time', stat: `+${studyHours.toFixed(1)}h`, sub: 'per day to study'                      },
    { title: 'Sleep',      stat: '+47 min',                    sub: 'nightly improvement reported'          },
    { title: 'Control',    stat: '83%',                        sub: 'feel more in control after 30 days'    },
  ];

  // Slides that handle their own CTA buttons (no bottom nav Next button)
  // 0=welcome, 1=permission, 2=email, 3=OTP, 7=notifs(auto), 8=screentime, 9=apps, 11=sameForAll, 12=time block, 14=per-app, 16=override
  const SELF_NAV = new Set([0, 1, 2, 3, 7, 8, 9, 11, 12, 14, 16]);

  // ── Slides ─────────────────────────────────────────────────────────────────
  const slides = [

    /* 0 - Welcome */
    <TouchableOpacity key="s0" activeOpacity={1} onPress={next} style={[st.slide, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={[st.badge, { alignSelf: 'center' }]}><Text style={st.badgeTxt}>STUDENT FOCUS</Text></View>
      <Text style={[st.bigTitle, { textAlign: 'center' }]}>Take back{'\n'}your time.</Text>
      <Text style={[st.sub, { textAlign: 'center' }]}>The free app blocker for students.</Text>
    </TouchableOpacity>,

    /* 1 - Permission */
    <View key="s1" style={[st.slide, { backgroundColor: '#050505' }]}>
      <Text style={[st.bigTitle, { fontSize: 24, lineHeight: 32 }]}>To block apps and show your real usage, we need access to your activity data.</Text>
      <View style={st.requiredPill}>
        <Text style={st.requiredPillTxt}>REQUIRED</Text>
      </View>
      <View style={st.sysSheet}>
        <Text style={st.sheetTitle}>
          This lets us show you exactly where your time is going and block the apps that pull you away from what matters.
        </Text>
        <View style={st.sheetBtns}>
          <TouchableOpacity style={st.denyBtn} onPress={next}>
            <Text style={st.denyTxt}>Ask Not to Track</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.allowBtn} onPress={async () => { await requestAuth?.(); next(); }}>
            <Text style={st.allowTxt}>Allow</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>,

    /* 2 - School email */
    <KeyboardAvoidingView key="s2" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: W }}>
      <ScrollView contentContainerStyle={[st.slide, { justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={st.badge}><Text style={st.badgeTxt}>STUDENTS ONLY - FREE</Text></View>
        <Text style={[st.bigTitle, { fontSize: 24, lineHeight: 30 }]}>Sign in with your{'\n'}school email.</Text>
        <TextInput
          style={[st.input, emailErr ? { borderColor: O.red } : null]}
          placeholder="you@mcgill.ca  or  you@school.edu"
          placeholderTextColor={O.muted}
          value={email}
          onChangeText={t => { setEmail(t); setEmailErr(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={validateEmail}
        />
        {!!emailErr && <Text style={st.errTxt}>{emailErr}</Text>}
        <TouchableOpacity
          style={[st.btn, { marginTop: 20, opacity: otpSending ? 0.6 : 1 }]}
          onPress={validateEmail}
          disabled={otpSending}
        >
          {otpSending
            ? <ActivityIndicator color="#fff" />
            : <Text style={st.btnTxt}>Continue</Text>}
        </TouchableOpacity>
        <Text style={st.mutedNote}>
          A 6-digit code will be sent to your inbox to verify you own this email address.
        </Text>
        <Text style={[st.mutedNote, { marginTop: 20 }]}>
          By continuing, you agree to our{' '}
          <Text
            style={{ color: O.white, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://livefonam.github.io/AppBlocker/terms')}
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text
            style={{ color: O.white, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://livefonam.github.io/AppBlocker/privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>,

    /* 3 - OTP verification */
    <KeyboardAvoidingView key="s-otp" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: W }}>
      <ScrollView contentContainerStyle={[st.slide, { justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={st.bigTitle}>Check your inbox.</Text>
        <Text style={[st.sub, { marginBottom: 8 }]}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: O.white, fontWeight: '600' }}>{email || 'your email'}</Text>
        </Text>
        <View style={st.infoBox}>
          <Text style={st.infoTxt}>
            Check your junk folder, your emails sometimes land there.
          </Text>
        </View>
        <TextInput
          style={[st.input, { letterSpacing: 10, fontSize: 28, textAlign: 'center', marginTop: 24 }, otpErr ? { borderColor: O.red } : null]}
          placeholder="------"
          placeholderTextColor={O.muted}
          value={otpCode}
          onChangeText={v => { setOtpCode(v.replace(/\D/g, '').slice(0, 6)); setOtpErr(''); }}
          keyboardType="number-pad"
          maxLength={6}
        />
        {!!otpErr && <Text style={st.errTxt}>{otpErr}</Text>}
        <TouchableOpacity
          style={[st.btn, { marginTop: 20, opacity: otpCode.length < 6 ? 0.4 : 1 }]}
          onPress={verifyOtp}
          disabled={otpCode.length < 6}
        >
          <Text style={st.btnTxt}>Verify</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.resendBtn, (resendCooldown > 0 || otpResending) && { opacity: 0.4 }]}
          onPress={resendOtp}
          disabled={resendCooldown > 0 || otpResending}
        >
          {otpResending
            ? <ActivityIndicator color={O.muted} size="small" />
            : <Text style={st.link}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setOtpCode(''); setOtpErr(''); goTo(2); }}
          style={{ alignSelf: 'center', marginTop: 8 }}
        >
          <Text style={st.link}>Wrong email? Go back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>,

    /* 4 - Daily guess (picker-wheel zoom) */
    <View key="s3" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center', fontSize: 22 }]}>How much time do you{'\n'}think you use daily?</Text>
      <Text style={[st.sub, { textAlign: 'center' }]}>Scroll to your guess</Text>
      <View style={{ height: 220, width: W, marginLeft: -28, marginTop: 16, justifyContent: 'center' }}>
        <Animated.FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={ITEM_W}
          snapToAlignment="start"
          data={GUESS_VALUES}
          keyExtractor={(_, i) => `g${i}`}
          initialScrollIndex={guessIdx}
          getItemLayout={(_, i) => ({ length: ITEM_W, offset: ITEM_W * i, index: i })}
          contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            {
              useNativeDriver: true,
              listener: e => {
                const i = Math.round(e.nativeEvent.contentOffset.x / ITEM_W);
                const clamped = Math.max(0, Math.min(GUESS_VALUES.length - 1, i));
                if (clamped !== lastHapticIdxRef.current) {
                  lastHapticIdxRef.current = clamped;
                  setGuessIdx(clamped);
                  try { Haptics && Haptics.selectionAsync(); } catch (_) {}
                }
              },
            }
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const inputRange = [(index - 2) * ITEM_W, (index - 1) * ITEM_W, index * ITEM_W, (index + 1) * ITEM_W, (index + 2) * ITEM_W];
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.55, 0.75, 1.1, 0.75, 0.55], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 0.55, 1, 0.55, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View style={{ width: ITEM_W, alignItems: 'center', justifyContent: 'center', transform: [{ scale }], opacity }}>
                <Text style={st.scrollerBig} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{item % 1 === 0 ? `${item}` : item.toFixed(1)}</Text>
              </Animated.View>
            );
          }}
        />
        <Text style={[st.scrollerUnit, { textAlign: 'center', marginTop: 8 }]}>hrs / day</Text>
      </View>
      {Platform.OS === 'ios' && !supportsScreenTime() && (
        <View style={[st.infoBox, { marginTop: 16 }]}>
          <Text style={st.infoTxt}>
            Real Screen Time data requires iOS 17.4+. You can connect it later in Settings after updating.
          </Text>
        </View>
      )}
    </View>,

    /* 4 - Reality check (vertical, fade in) */
    <View key="s4" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center' }]}>Here's your{'\n'}reality check.</Text>
      <View style={{ marginTop: 24 }}>
        {REALITY_DATA.map((item, i) => (
          <Animated.View
            key={i}
            style={[st.hCard, { borderColor: item.color + '55', marginBottom: 16, opacity: i === 0 ? rcAnim0 : rcAnim1,
              transform: [{ translateY: (i === 0 ? rcAnim0 : rcAnim1).interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }]}
          >
            <Text style={[st.hCardLabel, { color: item.color }]}>{item.label}</Text>
            <Text style={[st.hCardValue, { color: item.color }]}>{item.value}</Text>
            <Text style={st.hCardSub}>{item.sub}</Text>
          </Animated.View>
        ))}
      </View>
    </View>,

    /* 5 - Benefits (2-column grid) */
    <View key="s5" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center', fontSize: 22 }]}>What changing this{'\n'}actually looks like.</Text>
      <Text style={[st.sub, { textAlign: 'center', marginBottom: 20 }]}>Users report after 30 days</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {BENEFIT_DATA.map((item, i) => (
          <View key={i} style={[st.hCard, { width: '48%', marginBottom: 12, alignItems: 'center' }]}>
            <Text style={[st.hCardLabel, { marginBottom: 8, textAlign: 'center' }]}>{item.title}</Text>
            <Text style={[st.hCardValue, { color: O.white, fontSize: 28 }]}>{item.stat}</Text>
            <Text style={[st.hCardSub, { textAlign: 'center' }]}>{item.sub}</Text>
          </View>
        ))}
      </View>
    </View>,

    /* 6 - Notifications (auto-triggers real iOS popup via useEffect, no UI needed) */
    <View key="s6" style={st.slide} />,

    /* 8 - Screen Time auth */
    <View key="s_screentime" style={st.slide}>
      <Text style={st.bigTitle}>Read your{'\n'}screen time?</Text>
      <Text style={st.sub}>
        Granting access lets us show your real usage and suggest the apps you actually spend the most time on. We never upload this data anywhere.
      </Text>
      <TouchableOpacity
        style={[st.btn, { marginTop: 32 }]}
        onPress={async () => { try { await requestAuth?.(); } catch (_) {} next(); }}
      >
        <Text style={st.btnTxt}>Allow access</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={next} style={{ alignSelf: 'center', marginTop: 16 }}>
        <Text style={st.link}>Skip for now</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && !supportsScreenTime() && (
        <View style={[st.infoBox, { marginTop: 20 }]}>
          <Text style={st.infoTxt}>
            Real Screen Time data requires iOS 17.4+. You can connect it later in Settings after updating.
          </Text>
        </View>
      )}
    </View>,

    /* 9 - App suggestions */
    <View key="s_apps" style={{ width: W, flex: 1, backgroundColor: '#050505' }}>
    <ScrollView ref={appsScrollRef} style={{ width: W, backgroundColor: '#050505' }} contentContainerStyle={[st.slide, { justifyContent: 'flex-start', paddingTop: H * 0.08, paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
      <Text style={st.bigTitle}>Apps to take{'\n'}control of.</Text>
      <Text style={st.sub}>
        {Platform.OS === 'android'
          ? 'Based on your usage, we suggest reducing these.'
          : 'Select the apps you spend the most time on.'}
      </Text>
      {Platform.OS === 'ios' && appsScanned && suggestedApps.length === 0 && (
        <View style={[st.infoBox, { marginTop: 16 }]}>
          <Text style={st.infoTxt}>
            We couldn't auto-detect installed apps. Pick from the list below, only the ones you actually have.
          </Text>
        </View>
      )}
      <View style={{ width: '100%', marginTop: 20 }}>
        {(suggestedApps.length === 0 && Platform.OS === 'ios' && appsScanned ? IOS_APP_SCHEMES : suggestedApps).map(app => {
          const sel = selectedApps.includes(app.id);
          return (
            <TouchableOpacity key={app.id} style={[st.appRow, sel && st.appRowOn]} onPress={() =>
              setSelectedApps(p => p.includes(app.id) ? p.filter(x => x !== app.id) : [...p, app.id])
            }>
              <View style={{ flex: 1 }}>
                <Text style={[st.appName, sel && { color: O.white }]}>{app.name}</Text>
                {app.totalMinutes != null && (
                  <Text style={st.appMin}>{app.totalMinutes} min today</Text>
                )}
              </View>
              <View style={[st.cb, sel && st.cbOn]}>
                {sel && <Text style={{ color: O.bg, fontSize: 14, fontWeight: '800' }}>x</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[st.btn, { marginTop: 24, opacity: selectedApps.length === 0 ? 0.4 : 1 }]}
        onPress={next}
        disabled={selectedApps.length === 0}
      >
        <Text style={st.btnTxt}>
          {selectedApps.length === 0
            ? 'Pick at least one app'
            : `Target ${selectedApps.length} app${selectedApps.length !== 1 ? 's' : ''}`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    {showAppsHint && (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 90,
          alignItems: 'center',
          opacity: appsHintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          transform: [{ translateY: appsHintAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }],
        }}
      >
        <TouchableOpacity
          onPress={() => { setShowAppsHint(false); appsScrollRef.current?.scrollToEnd({ animated: true }); }}
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontSize: 13, fontWeight: '700', marginRight: 6 }}>Continue below</Text>
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>↓</Text>
        </TouchableOpacity>
      </Animated.View>
    )}
    </View>,

    /* 9 - Enforcement multi-select */
    <View key="s_enforce" style={st.slide}>
      <Text style={st.bigTitle}>How do you want{'\n'}to limit them?</Text>
      <Text style={st.sub}>Pick one or both. They work together.</Text>
      {[
        { id: 'limit', title: 'Time Limit', sub: 'Cap your daily usage (e.g. 30 min/day).' },
        { id: 'block', title: 'Time Block', sub: 'Block apps during specific hours (e.g. 9am-5pm).' },
      ].map(t => {
        const sel = enforcementTypes.includes(t.id);
        return (
          <TouchableOpacity
            key={t.id}
            style={[st.modeCard, sel && st.modeCardOn, { marginTop: 16 }]}
            onPress={() => setEnforcementTypes(p => p.includes(t.id) ? p.filter(x => x !== t.id) : [...p, t.id])}
          >
            <Text style={[st.modeTitle, sel && { color: O.white }]}>{t.title}</Text>
            <Text style={st.modeSub}>{t.sub}</Text>
          </TouchableOpacity>
        );
      })}
    </View>,

    /* 10 - Same for all apps? */
    (() => {
      const hasLimit = enforcementTypes.includes('limit');
      const hasBlock = enforcementTypes.includes('block');
      const settingWord = hasLimit && hasBlock ? 'daily limit and time block' : hasLimit ? 'daily limit' : 'time block';
      return (
        <View key="s_sameforall" style={st.slide}>
          <Text style={st.bigTitle}>Same {settingWord}{'\n'}for all of them?</Text>
          <Text style={st.sub}>You selected {selectedApps.length} apps. Apply the same {settingWord} to all, or set each one separately?</Text>
          <TouchableOpacity style={[st.btn, { marginTop: 32 }]} onPress={() => { setSameForAll(true); next(); }}>
            <Text style={st.btnTxt}>Same for all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.btn, { marginTop: 12, backgroundColor: 'transparent', borderWidth: 1, borderColor: O.border }]}
            onPress={() => { setSameForAll(false); next(); }}
          >
            <Text style={[st.btnTxt, { color: O.white }]}>Customize per app</Text>
          </TouchableOpacity>
        </View>
      );
    })(),

    /* 11 - Set time block (name + editable time window) */
    <ScrollView key="s_block" style={{ width: W }} contentContainerStyle={[st.slide, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={st.bigTitle}>Set your{'\n'}time block.</Text>
      <Text style={st.sub}>Name it, then set the time window.</Text>

      <Text style={st.sectionLbl}>NAME IT</Text>
      <View style={st.pillRow}>
        {['Morning focus', 'Study time', 'Work block', 'Wind down'].map(n => (
          <TouchableOpacity key={n} style={[st.pill, blockName === n && st.pillOn]} onPress={() => setBlockName(v => v === n ? '' : n)}>
            <Text style={[st.pillTxt, blockName === n && { color: O.white }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[st.input, { marginTop: 10 }]}
        placeholder="Or type your own..."
        placeholderTextColor={O.muted}
        value={blockName}
        onChangeText={setBlockName}
      />

      <Text style={[st.sectionLbl, { marginTop: 24 }]}>TIME WINDOW</Text>
      <Text style={[st.mutedNote, { textAlign: 'left', marginTop: 0, marginBottom: 10 }]}>Type 9:00 AM, 21:30, or 9pm.</Text>
      <View style={st.timeRow}>
        <TextInput
          style={[st.input, { flex: 1, textAlign: 'center', marginTop: 0, fontSize: 15, paddingVertical: 12 }]}
          placeholder={tStr(startMins)}
          placeholderTextColor={O.muted}
          value={startInput || tStr(startMins)}
          onFocus={() => setStartInput('')}
          onChangeText={setStartInput}
          onBlur={() => {
            const m = parseTimeStr(startInput);
            if (m !== null) setStartMins(m);
            setStartInput('');
          }}
          keyboardType="default"
          autoCapitalize="characters"
        />
        <Text style={st.timeSep}>to</Text>
        <TextInput
          style={[st.input, { flex: 1, textAlign: 'center', marginTop: 0, fontSize: 15, paddingVertical: 12 }]}
          placeholder={tStr(endMins)}
          placeholderTextColor={O.muted}
          value={endInput || tStr(endMins)}
          onFocus={() => setEndInput('')}
          onChangeText={setEndInput}
          onBlur={() => {
            const m = parseTimeStr(endInput);
            if (m !== null) setEndMins(m);
            setEndInput('');
          }}
          keyboardType="default"
          autoCapitalize="characters"
        />
      </View>

      <TouchableOpacity style={[st.btn, { marginTop: 28 }]} onPress={next}>
        <Text style={st.btnTxt}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>,

    /* 12 - Daily Limit picker */
    <View key="s_limit" style={st.slide}>
      <Text style={st.bigTitle}>How much per day?</Text>
      <Text style={st.sub}>The total time you'll allow yourself on these apps each day. Tap the number to type your own.</Text>
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        {limitInputVisible ? (
          <TextInput
            autoFocus
            style={{ color: O.white, fontSize: 72, fontWeight: '700', textAlign: 'center', minWidth: 180, borderBottomWidth: 1, borderBottomColor: O.muted, padding: 0 }}
            value={limitInputValue}
            onChangeText={v => setLimitInputValue(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            onBlur={() => {
              const n = parseInt(limitInputValue, 10);
              if (!isNaN(n)) setDailyLimitMins(Math.max(5, Math.min(480, n)));
              setLimitInputVisible(false);
              setLimitInputValue('');
            }}
            onSubmitEditing={() => {
              const n = parseInt(limitInputValue, 10);
              if (!isNaN(n)) setDailyLimitMins(Math.max(5, Math.min(480, n)));
              setLimitInputVisible(false);
              setLimitInputValue('');
            }}
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={() => { setLimitInputValue(String(dailyLimitMins)); setLimitInputVisible(true); }}>
            <Text style={{ color: O.white, fontSize: 72, fontWeight: '700' }}>{dailyLimitMins}</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: O.muted, fontSize: 16, marginTop: 4 }}>minutes / day</Text>
      </View>
      <View style={[st.timeRow, { marginTop: 24, justifyContent: 'center' }]}>
        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setDailyLimitMins(m => Math.max(5, m - 15))}>
          <Text style={st.limitAdjTxt}>-15</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setDailyLimitMins(m => Math.max(5, m - 5))}>
          <Text style={st.limitAdjTxt}>-5</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setDailyLimitMins(m => Math.min(480, m + 5))}>
          <Text style={st.limitAdjTxt}>+5</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setDailyLimitMins(m => Math.min(480, m + 15))}>
          <Text style={st.limitAdjTxt}>+15</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={{ alignSelf: 'center', marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: O.white }}
        onPress={() => setDailyLimitMins(recommendedMins)}
      >
        <Text style={{ color: O.white, fontWeight: '700', fontSize: 14 }}>Use Recommended ({recommendedMins} min)</Text>
      </TouchableOpacity>
    </View>,

    /* 14 - Per-app customization */
    <ScrollView key="s_perapp" style={{ width: W }} contentContainerStyle={[st.slide, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={st.bigTitle}>Customize{'\n'}each app.</Text>
      <Text style={st.sub}>Tap an app to set its own {enforcementTypes.includes('block') && enforcementTypes.includes('limit') ? 'time block and daily limit' : enforcementTypes.includes('block') ? 'time block' : 'daily limit'}.</Text>
      <View style={{ marginTop: 20 }}>
        {selectedApps.map(appId => {
          const cfg = perAppConfig[appId] || { startMins, endMins, dailyLimitMins };
          const expanded = expandedAppId === appId;
          const appName = (suggestedApps.find(a => a.id === appId)?.name) || (IOS_APP_SCHEMES.find(a => a.id === appId)?.name) || appId;
          const summary = [
            enforcementTypes.includes('block') ? `${tStr(cfg.startMins)} – ${tStr(cfg.endMins)}` : null,
            enforcementTypes.includes('limit') ? `${cfg.dailyLimitMins} min/day` : null,
          ].filter(Boolean).join(' · ');
          return (
            <View key={appId} style={[st.modeCard, { marginBottom: 12, padding: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setExpandedAppId(expanded ? null : appId)} style={{ flex: 1, padding: 16 }}>
                  <Text style={[st.modeTitle, { color: O.white, marginBottom: 4 }]}>{appName}</Text>
                  <Text style={st.modeSub}>{summary || 'Tap to configure'}</Text>
                </TouchableOpacity>
                {expanded && selectedApps.length > 1 && (
                  <TouchableOpacity
                    style={{ marginRight: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: O.white }}
                    onPress={() => {
                      const baseCfg = perAppConfig[appId] || { startMins, endMins, dailyLimitMins };
                      const next = {};
                      selectedApps.forEach(id => { next[id] = { ...baseCfg }; });
                      setPerAppConfig(next);
                    }}
                  >
                    <Text style={{ color: O.white, fontSize: 11, fontWeight: '700' }}>Apply to all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {expanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  {enforcementTypes.includes('block') && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={st.sectionLbl}>TIME WINDOW</Text>
                      <View style={[st.timeRow, { marginTop: 8 }]}>
                        <View style={[st.timeBox, { flex: 1 }]}>
                          <TouchableOpacity onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, startMins: Math.max(0, cfg.startMins - 15) } }))}><Text style={st.timeAdj}>-</Text></TouchableOpacity>
                          <Text style={st.timeTxt}>{tStr(cfg.startMins)}</Text>
                          <TouchableOpacity onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, startMins: Math.min(1425, cfg.startMins + 15) } }))}><Text style={st.timeAdj}>+</Text></TouchableOpacity>
                        </View>
                        <Text style={st.timeSep}>to</Text>
                        <View style={[st.timeBox, { flex: 1 }]}>
                          <TouchableOpacity onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, endMins: Math.max(15, cfg.endMins - 15) } }))}><Text style={st.timeAdj}>-</Text></TouchableOpacity>
                          <Text style={st.timeTxt}>{tStr(cfg.endMins)}</Text>
                          <TouchableOpacity onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, endMins: Math.min(1439, cfg.endMins + 15) } }))}><Text style={st.timeAdj}>+</Text></TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                  {enforcementTypes.includes('limit') && (
                    <View style={{ marginTop: enforcementTypes.includes('block') ? 20 : 8, borderTopWidth: enforcementTypes.includes('block') ? 1 : 0, borderTopColor: O.border, paddingTop: enforcementTypes.includes('block') ? 16 : 0 }}>
                      <Text style={st.sectionLbl}>DAILY LIMIT</Text>
                      <View style={{ alignItems: 'center', marginTop: 8 }}>
                        <TextInput
                          style={{ color: O.white, fontSize: 36, fontWeight: '700', textAlign: 'center', minWidth: 120, padding: 0 }}
                          value={String(cfg.dailyLimitMins)}
                          onChangeText={v => {
                            const cleaned = v.replace(/\D/g, '').slice(0, 4);
                            const n = parseInt(cleaned, 10);
                            setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: isNaN(n) ? 0 : Math.min(480, n) } }));
                          }}
                          onBlur={() => {
                            if (cfg.dailyLimitMins < 5) {
                              setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: 5 } }));
                            }
                          }}
                          keyboardType="number-pad"
                        />
                        <Text style={{ color: O.muted, fontSize: 14 }}>min / day</Text>
                      </View>
                      <View style={[st.timeRow, { marginTop: 8, justifyContent: 'center' }]}>
                        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: Math.max(5, cfg.dailyLimitMins - 15) } }))}>
                          <Text style={st.limitAdjTxt}>-15</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: Math.max(5, cfg.dailyLimitMins - 5) } }))}>
                          <Text style={st.limitAdjTxt}>-5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: Math.min(480, cfg.dailyLimitMins + 5) } }))}>
                          <Text style={st.limitAdjTxt}>+5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={st.limitAdjBtn} onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: Math.min(480, cfg.dailyLimitMins + 15) } }))}>
                          <Text style={st.limitAdjTxt}>+15</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={{ alignSelf: 'center', marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: O.white }}
                        onPress={() => setPerAppConfig(p => ({ ...p, [appId]: { ...cfg, dailyLimitMins: recommendedMins } }))}
                      >
                        <Text style={{ color: O.white, fontWeight: '700', fontSize: 12 }}>Use Recommended ({recommendedMins} min)</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
      <TouchableOpacity style={[st.btn, { marginTop: 16 }]} onPress={next}>
        <Text style={st.btnTxt}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>,

    /* 15 - Strict / Taper (only if Time Limit selected) */
    <View key="s_mode" style={st.slide}>
      <Text style={st.bigTitle}>Strict or gradual?</Text>
      <Text style={st.sub}>How you want the daily limit enforced.</Text>
      <TouchableOpacity style={[st.modeCard, blockingMode === 'strict' && st.modeCardOn, { marginTop: 16 }]} onPress={() => setBlockingMode('strict')}>
        <Text style={[st.modeTitle, blockingMode === 'strict' && { color: O.white }]}>Strict</Text>
        <Text style={st.modeSub}>Hard cutoff. Apps lock immediately when you hit the daily limit.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[st.modeCard, blockingMode === 'taper' && st.modeCardOn, { marginTop: 16 }]} onPress={() => setBlockingMode('taper')}>
        <Text style={[st.modeTitle, blockingMode === 'taper' && { color: O.white }]}>Taper Off</Text>
        <Text style={st.modeSub}>We gradually reduce your allowed daily usage each week until you hit your target.</Text>
      </TouchableOpacity>
    </View>,

    /* 14 - Override Method (Friend vs Self) */
    <ScrollView key="s_override" style={{ width: W }} contentContainerStyle={[st.slide, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
      <Text style={st.bigTitle}>Who unlocks{'\n'}your blocks?</Text>
      <Text style={st.sub}>Pick how you'll override your own limits later.</Text>
      <TouchableOpacity
        style={[st.modeCard, overrideMethod === 'friend' && st.modeCardOn, { marginTop: 16 }]}
        onPress={() => setOverrideMethod('friend')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={[st.modeTitle, overrideMethod === 'friend' && { color: O.white }]}>Friend Control</Text>
          <View style={{ marginLeft: 8, marginTop: -4, backgroundColor: O.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
            <Text style={{ color: O.bg, fontSize: 10, fontWeight: '700' }}>MORE EFFECTIVE</Text>
          </View>
        </View>
        <Text style={st.modeSub}>Share a link with a friend. They get a code (rotating hourly) you'll need to unlock apps or change settings.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[st.modeCard, overrideMethod === 'self' && st.modeCardOn, { marginTop: 16 }]}
        onPress={() => setOverrideMethod('self')}
      >
        <Text style={[st.modeTitle, overrideMethod === 'self' && { color: O.white }]}>Self Control</Text>
        <Text style={st.modeSub}>Hold a button for 10 seconds, then sit through 5 minutes of ads before you can override. Leaving the app cancels it.</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[st.btn, { marginTop: 28, opacity: overrideMethod ? 1 : 0.4 }]}
        onPress={finishOnboarding}
        disabled={!overrideMethod}
      >
        <Text style={st.btnTxt}>Done. Let's go</Text>
      </TouchableOpacity>
    </ScrollView>,
  ];

  return (
    <View style={st.container}>
      <View style={st.progressTrack}>
        <Animated.View style={[st.progressFill, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>

      <ScrollView
        ref={outerRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {slides}
      </ScrollView>

      <View style={st.navBar}>
        {step > 2 ? (
          <TouchableOpacity onPress={prev} style={st.backBtn}>
            <Text style={st.backTxt}>Back</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}

        {!SELF_NAV.has(step) ? (() => {
          const nextDisabled = (step === 10 && enforcementTypes.length === 0) || otpSending;
          return (
            <TouchableOpacity
              onPress={step === 2 ? validateEmail : next}
              style={[st.nextBtn, nextDisabled && { opacity: 0.4 }]}
              disabled={nextDisabled}
            >
              {step === 2 && otpSending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.nextTxt}>Next</Text>}
            </TouchableOpacity>
          );
        })() : <View style={{ width: 60 }} />}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: O.bg },
  slide: {
    width: W,
    minHeight: H - 100,
    paddingHorizontal: 28,
    paddingTop: H * 0.07,
    paddingBottom: 20,
    justifyContent: 'flex-start',
    backgroundColor: O.bg,
  },
  badge: {
    backgroundColor: O.dim, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 20,
  },
  badgeTxt: { color: O.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  bigTitle: { fontSize: 34, fontWeight: '700', color: O.white, lineHeight: 42, marginBottom: 12 },
  sub: { fontSize: 16, color: O.muted, lineHeight: 24, marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  stepNum: { fontSize: 11, fontWeight: '700', color: O.muted, width: 36, marginTop: 2, letterSpacing: 1 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: O.white, marginBottom: 3 },
  stepDesc: { fontSize: 14, color: O.muted, lineHeight: 20 },
  requiredPill: {
    backgroundColor: '#1a1000', borderWidth: 1, borderColor: '#ff9500',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    alignSelf: 'flex-start', marginTop: 12, marginBottom: 24,
  },
  requiredPillTxt: { color: '#ff9500', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  sysSheet: {
    backgroundColor: O.card, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: O.border, borderRadius: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: O.white, textAlign: 'center', marginBottom: 12 },
  sheetBody: { fontSize: 14, color: O.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  denyBtn: { flex: 1, paddingVertical: 13, borderWidth: 1, borderColor: O.border, alignItems: 'center' },
  denyTxt: { color: O.muted, fontWeight: '600', fontSize: 15 },
  allowBtn: { flex: 1, paddingVertical: 13, backgroundColor: O.white, alignItems: 'center' },
  allowTxt: { color: O.bg, fontWeight: '700', fontSize: 15 },
  input: {
    borderWidth: 1, borderColor: O.border,
    padding: 14, color: O.white, fontSize: 16, backgroundColor: O.card, marginTop: 12, borderRadius: 10,
  },
  errTxt: { color: O.red, fontSize: 13, marginTop: 6 },
  mutedNote: { color: O.muted, fontSize: 12, marginTop: 16, lineHeight: 18, textAlign: 'center' },
  btn: { backgroundColor: O.white, paddingVertical: 15, alignItems: 'center', borderRadius: 10 },
  btnTxt: { color: O.bg, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  link: { color: O.muted, fontSize: 14 },
  resendBtn: { alignSelf: 'center', marginTop: 16, paddingVertical: 8 },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: O.border,
    borderRadius: 8, padding: 12, marginTop: 8,
  },
  infoTxt: { color: O.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  scrollerBig: { fontSize: 44, fontWeight: '700', color: O.white, textAlign: 'center' },
  scrollerUnit: { fontSize: 20, color: O.muted, marginTop: -8 },
  swipeHint: { color: O.muted, fontSize: 13, textAlign: 'center', marginTop: 16 },
  hCard: {
    backgroundColor: O.card, padding: 24,
    borderWidth: 1, borderColor: O.border, borderRadius: 10,
  },
  hCardLabel: { fontSize: 12, fontWeight: '700', color: O.muted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  hCardValue: { fontSize: 52, fontWeight: '700', color: O.white, marginBottom: 8 },
  hCardSub: { fontSize: 14, color: O.muted, lineHeight: 20 },
  notifPreview: {
    backgroundColor: O.card, padding: 14, borderWidth: 1, borderColor: O.border,
  },
  notifApp: { fontSize: 12, fontWeight: '700', color: O.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 },
  notifMsg: { fontSize: 14, color: O.white },
  modeCard: { padding: 20, borderWidth: 1, borderColor: O.border, backgroundColor: O.card, borderRadius: 10 },
  modeCardOn: { borderColor: O.white, backgroundColor: 'rgba(255,255,255,0.06)' },
  modeTitle: { fontSize: 18, fontWeight: '700', color: O.muted, marginBottom: 8 },
  modeSub: { fontSize: 14, color: O.muted, lineHeight: 21 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10,
    backgroundColor: O.card, borderWidth: 1, borderColor: O.border, borderRadius: 10,
  },
  appRowOn: { borderColor: O.white, backgroundColor: 'rgba(255,255,255,0.06)' },
  appName: { fontSize: 16, fontWeight: '600', color: O.muted },
  appMin: { fontSize: 12, color: O.muted, marginTop: 2 },
  cb: { width: 24, height: 24, borderWidth: 2, borderColor: O.muted, alignItems: 'center', justifyContent: 'center' },
  cbOn: { backgroundColor: O.white, borderColor: O.white },
  sectionLbl: { fontSize: 11, fontWeight: '700', color: O.muted, letterSpacing: 1.5, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: O.card, borderWidth: 1, borderColor: O.border, borderRadius: 8 },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: O.white },
  pillTxt: { fontSize: 12, color: O.muted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: O.card, padding: 12, borderWidth: 1, borderColor: O.border, borderRadius: 10 },
  timeAdj: { fontSize: 22, color: O.white, paddingHorizontal: 10 },
  timeTxt: { fontSize: 16, fontWeight: '600', color: O.white },
  timeSep: { fontSize: 14, color: O.muted, marginHorizontal: 12 },
  limitAdjBtn: { paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 6, backgroundColor: O.card, borderWidth: 1, borderColor: O.border, borderRadius: 10 },
  limitAdjTxt: { color: O.white, fontWeight: '700', fontSize: 16 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  dot: { width: 18, height: 18, borderWidth: 2, borderColor: O.muted, borderRadius: 9 },
  dotFilled: { backgroundColor: O.white, borderColor: O.white },
  numPad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 32 },
  numKey: { width: '33.33%', paddingVertical: 18, alignItems: 'center' },
  numKeyTxt: { fontSize: 28, fontWeight: '300', color: O.white },
  progressTrack: {
    height: 4,
    width: '60%',
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: O.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: O.white, borderRadius: 2 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: O.border,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  backTxt: { color: O.muted, fontSize: 16 },
  nextBtn: { backgroundColor: O.white, paddingVertical: 10, paddingHorizontal: 24 },
  nextTxt: { color: O.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
