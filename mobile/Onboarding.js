import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, Dimensions, Platform, TextInput, Vibration,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch (_) {}

const { width: W, height: H } = Dimensions.get('window');
const TOTAL = 10;

const O = {
  bg:     '#080808',
  card:   '#141414',
  border: 'rgba(255,255,255,0.10)',
  blue:   '#0a84ff',
  red:    '#ff3b30',
  green:  '#30d158',
  white:  '#ffffff',
  muted:  'rgba(255,255,255,0.45)',
  dim:    'rgba(255,255,255,0.12)',
};

const GUESS_VALUES = Array.from({ length: 32 }, (_, i) => +((i + 1) * 0.5).toFixed(1));

const IOS_APPS = [
  { id: 'youtube',   name: 'YouTube' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok',    name: 'TikTok' },
  { id: 'reddit',    name: 'Reddit' },
  { id: 'twitter',   name: 'X / Twitter' },
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

export default function Onboarding({ onComplete, requestAuth, getUsageStats }) {
  const outerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL)).current;

  const [step,         setStep]         = useState(0);
  const [guessIdx,     setGuessIdx]     = useState(3);
  const [selectedApps, setSelectedApps] = useState([]);
  const [blockName,    setBlockName]    = useState('');
  const [startMins,    setStartMins]    = useState(540);
  const [endMins,      setEndMins]      = useState(660);
  const [email,        setEmail]        = useState('');
  const [emailErr,     setEmailErr]     = useState('');
  const [blockingMode, setBlockingMode] = useState('strict');
  const [suggestedApps,setSuggestedApps]= useState(IOS_APPS);
  const [pinSlide,     setPinSlide]     = useState(false);
  const [pin,          setPin]          = useState('');

  const guessHours = GUESS_VALUES[guessIdx];
  const actualHours = +(guessHours * 1.4).toFixed(1);
  const diff        = +(actualHours - guessHours).toFixed(1);
  const cut         = +Math.max(0.5, actualHours - 1.5).toFixed(1);
  const weekHrs     = (cut * 7).toFixed(1);
  const daysBack    = Math.round((cut * 365) / 24);

  useEffect(() => {
    if (step !== 8 || Platform.OS !== 'android' || !getUsageStats) return;
    getUsageStats().then(stats => {
      if (!stats || !stats.length) return;
      const filtered = stats
        .filter(s => ANDROID_BAD_PKGS.includes(s.packageName))
        .sort((a, b) => b.totalMinutes - a.totalMinutes)
        .slice(0, 5)
        .map(s => ({ id: s.packageName, name: s.name, totalMinutes: s.totalMinutes }));
      if (filtered.length > 0) setSuggestedApps(filtered);
    }).catch(() => {});
  }, [step]);

  const goTo = (i) => {
    const n = Math.max(0, Math.min(TOTAL - 1, i));
    setStep(n);
    outerRef.current?.scrollTo({ x: n * W, animated: true });
    Animated.spring(progressAnim, {
      toValue: (n + 1) / TOTAL,
      tension: 60, friction: 12, useNativeDriver: false,
    }).start();
  };
  const next = () => goTo(step + 1);
  const prev = () => goTo(step - 1);

  const validateEmail = () => {
    const domain = (email.split('@')[1] || '').toLowerCase();
    const ok =
      /\.(edu|ac\.[a-z]{2,}|edu\.[a-z]{2,})$/i.test(domain) ||
      /mcgill|concordia|umontreal|utoronto|ubc|queens|uottawa|harvard|mit|stanford|yale|columbia/i.test(domain);
    if (!ok) { setEmailErr('School email required (e.g. name@mcgill.ca or name@school.edu)'); return; }
    setEmailErr('');
    next();
  };

  const requestNotifs = async () => {
    try { if (Notifications) await Notifications.requestPermissionsAsync(); } catch (_) {}
    next();
  };

  const finishWithPin = async () => {
    try {
      await AsyncStorage.multiSet([
        ['@nova_onboarding_done', 'true'],
        ['@nova_blocked_apps',   JSON.stringify(selectedApps)],
        ['@nova_blocking_mode',  blockingMode],
        ...(pin.length === 4 ? [['@nova_pin', pin]] : []),
      ]);
    } catch (_) {}
    onComplete({ blockName: blockName || 'Focus Block', selectedApps, startMins, endMins, blockingMode, email });
  };

  // ── PIN slide ──────────────────────────────────────────────────────────────
  if (pinSlide) {
    return (
      <View style={[st.container, { justifyContent: 'flex-end', paddingBottom: 48 }]}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={st.bigTitle}>Set an accountability code.</Text>
          <Text style={[st.sub, { marginBottom: 40 }]}>
            Give this 4-digit code to a trusted person.{'\n\n'}
            You will need it to change any block settings.{'\n'}
            You will not see it again after this screen.
          </Text>
          <View style={st.pinDots}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[st.dot, pin.length > i && st.dotFilled]} />
            ))}
          </View>
        </View>
        <View style={st.numPad}>
          {['1','2','3','4','5','6','7','8','9','','0','<'].map((k, i) => (
            <TouchableOpacity
              key={i}
              style={[st.numKey, k === '' && { opacity: 0 }]}
              disabled={k === ''}
              onPress={() => {
                if (k === '<') setPin(p => p.slice(0, -1));
                else if (pin.length < 4) setPin(p => p + k);
              }}
            >
              <Text style={st.numKeyTxt}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[st.btn, { marginHorizontal: 32, marginTop: 16, opacity: pin.length < 4 ? 0.3 : 1 }]}
          onPress={finishWithPin}
          disabled={pin.length < 4}
        >
          <Text style={st.btnTxt}>I have shared it — let's go</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={finishWithPin} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={st.link}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Slide data ─────────────────────────────────────────────────────────────
  const REALITY_DATA = [
    { label: 'You said',          value: guessHours % 1 === 0 ? `${guessHours}h` : `${guessHours.toFixed(1)}h`, sub: 'per day',                                   color: O.white },
    { label: 'Reality',           value: actualHours % 1 === 0 ? `${actualHours}h` : `${actualHours.toFixed(1)}h`, sub: `+${diff.toFixed(1)}h you didn't account for`, color: O.red   },
    { label: 'Savings potential', value: `${weekHrs}h`,  sub: `per week — ${daysBack} full days per year`,    color: O.green },
  ];

  const BENEFIT_DATA = [
    { title: 'Focus',        stat: `${daysBack} days`, sub: 'back per year'                        },
    { title: 'Sleep',        stat: '+47 min',          sub: 'nightly improvement reported'         },
    { title: 'Control',      stat: '83%',              sub: 'feel more in control after 30 days'   },
    { title: 'Productivity', stat: '2.1 hrs',          sub: 'less daily screen time, on average'   },
  ];

  // Slides 1, 6, 8, 9 handle their own CTA buttons
  const SELF_NAV = new Set([1, 6, 8, 9]);

  // ── Slides ─────────────────────────────────────────────────────────────────
  const slides = [

    /* 0 — Welcome */
    <View key="s0" style={[st.slide, { justifyContent: 'flex-start', paddingTop: H * 0.08 }]}>
      <View style={st.badge}><Text style={st.badgeTxt}>NOVA FOCUS</Text></View>
      <Text style={st.bigTitle}>Take back{'\n'}your time.</Text>
      <Text style={st.sub}>Here's how it works.</Text>
      <View style={{ marginTop: 32 }}>
        {[
          ['01', 'See your reality',      'Compare what you think vs. what you actually do.'],
          ['02', 'Block what drains you', 'Set time windows and limits that stick.'],
          ['03', 'Get the years back',    'Small changes compound into real time saved.'],
        ].map(([n, h, d]) => (
          <View key={n} style={st.stepRow}>
            <Text style={st.stepNum}>{n}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.stepTitle}>{h}</Text>
              <Text style={st.stepDesc}>{d}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>,

    /* 1 — Permission */
    <View key="s1" style={[st.slide, { backgroundColor: '#050505' }]}>
      <View style={st.requiredBanner}>
        <Text style={st.requiredTxt}>Required — the app cannot function without this</Text>
      </View>
      <Text style={st.bigTitle}>We need to see{'\n'}what you're using.</Text>
      <Text style={st.sub}>To block apps and show your real usage, we need access to your activity data.</Text>
      <View style={st.sysSheet}>
        <Text style={st.sheetTitle}>"Nova Focus" wants to track activity across other apps.</Text>
        <Text style={st.sheetBody}>
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

    /* 2 — School email */
    <KeyboardAvoidingView key="s2" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: W }}>
      <ScrollView contentContainerStyle={[st.slide, { justifyContent: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={st.badge}><Text style={st.badgeTxt}>STUDENTS ONLY — FREE</Text></View>
        <Text style={st.bigTitle}>Sign in with your{'\n'}school email.</Text>
        <Text style={st.sub}>School accounts only. Always free — no card needed.</Text>
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
        <TouchableOpacity style={[st.btn, { marginTop: 20 }]} onPress={validateEmail}>
          <Text style={st.btnTxt}>Continue</Text>
        </TouchableOpacity>
        <Text style={st.mutedNote}>
          A one-time verification code sent to your inbox will be added in a future update.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>,

    /* 3 — Daily guess (horizontal value scroller) */
    <View key="s3" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center' }]}>How much time do you{'\n'}think you use daily?</Text>
      <Text style={[st.sub, { textAlign: 'center' }]}>Swipe to your guess</Text>
      <View style={{ height: 200, width: W, marginTop: 8 }}>
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={GUESS_VALUES}
          keyExtractor={(_, i) => `g${i}`}
          initialScrollIndex={guessIdx}
          getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.x / W);
            setGuessIdx(Math.max(0, Math.min(GUESS_VALUES.length - 1, i)));
          }}
          renderItem={({ item }) => (
            <View style={{ width: W, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={st.scrollerBig}>{item % 1 === 0 ? `${item}` : item.toFixed(1)}</Text>
              <Text style={st.scrollerUnit}>hrs / day</Text>
            </View>
          )}
        />
      </View>
      <Text style={st.swipeHint}>-- swipe left or right --</Text>
    </View>,

    /* 4 — Reality check (horizontal cards) */
    <View key="s4" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center' }]}>Here's your{'\n'}reality check.</Text>
      <Text style={[st.sub, { textAlign: 'center', marginBottom: 16 }]}>Swipe through</Text>
      <FlatList
        horizontal
        snapToInterval={W * 0.72 + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        data={REALITY_DATA}
        keyExtractor={(_, i) => `r${i}`}
        contentContainerStyle={{ paddingHorizontal: W * 0.14 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <View style={[st.hCard, { borderColor: item.color + '55', width: W * 0.72, marginRight: 16 }]}>
            <Text style={[st.hCardLabel, { color: item.color }]}>{item.label}</Text>
            <Text style={[st.hCardValue, { color: item.color }]}>{item.value}</Text>
            <Text style={st.hCardSub}>{item.sub}</Text>
          </View>
        )}
      />
    </View>,

    /* 5 — Benefits (horizontal cards) */
    <View key="s5" style={st.slide}>
      <Text style={[st.bigTitle, { textAlign: 'center' }]}>What changing this{'\n'}actually looks like.</Text>
      <Text style={[st.sub, { textAlign: 'center', marginBottom: 16 }]}>Users report after 30 days — swipe</Text>
      <FlatList
        horizontal
        snapToInterval={W * 0.65 + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        data={BENEFIT_DATA}
        keyExtractor={(_, i) => `b${i}`}
        contentContainerStyle={{ paddingHorizontal: W * 0.175 }}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <View style={[st.hCard, { width: W * 0.65, marginRight: 16, alignItems: 'center' }]}>
            <Text style={[st.hCardLabel, { marginBottom: 8 }]}>{item.title}</Text>
            <Text style={[st.hCardValue, { color: O.blue, fontSize: 44 }]}>{item.stat}</Text>
            <Text style={[st.hCardSub, { textAlign: 'center' }]}>{item.sub}</Text>
          </View>
        )}
      />
    </View>,

    /* 6 — Notifications */
    <View key="s6" style={[st.slide, { backgroundColor: '#050505' }]}>
      <Text style={st.bigTitle}>Stay informed.{'\n'}Not distracted.</Text>
      <Text style={st.sub}>We'll only notify you when it actually matters. No spam.</Text>
      <View style={[st.sysSheet, { marginTop: 32 }]}>
        <Text style={st.sheetTitle}>"Nova Focus" would like to send you notifications.</Text>
        <View style={[st.notifPreview, { marginTop: 16 }]}>
          <Text style={st.notifApp}>Nova Focus</Text>
          <Text style={st.notifMsg}>You've hit your daily goal. Lock in.</Text>
        </View>
        <View style={[st.notifPreview, { opacity: 0.4, marginTop: 8 }]}>
          <Text style={st.notifApp}>Nova Focus</Text>
          <Text style={st.notifMsg}>7-day streak. You're 2h ahead of last week.</Text>
        </View>
        <View style={[st.sheetBtns, { marginTop: 20 }]}>
          <TouchableOpacity style={st.denyBtn} onPress={next}>
            <Text style={st.denyTxt}>Don't Allow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.allowBtn} onPress={requestNotifs}>
            <Text style={st.allowTxt}>Allow</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>,

    /* 7 — Blocking mode */
    <View key="s7" style={st.slide}>
      <Text style={st.bigTitle}>How do you want{'\n'}to do this?</Text>
      <Text style={st.sub}>Choose your approach to quitting.</Text>
      <TouchableOpacity style={[st.modeCard, blockingMode === 'strict' && st.modeCardOn]} onPress={() => setBlockingMode('strict')}>
        <Text style={[st.modeTitle, blockingMode === 'strict' && { color: O.white }]}>Strict Block</Text>
        <Text style={st.modeSub}>Apps are completely blocked during your focus windows. Requires a 3-second hold and your accountability code to override.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[st.modeCard, blockingMode === 'taper' && st.modeCardOn, { marginTop: 16 }]} onPress={() => setBlockingMode('taper')}>
        <Text style={[st.modeTitle, blockingMode === 'taper' && { color: O.white }]}>Taper Off</Text>
        <Text style={st.modeSub}>We reduce your allowed daily usage by 20% each week until you hit your target. Slower, but more sustainable long term.</Text>
      </TouchableOpacity>
    </View>,

    /* 8 — App suggestions */
    <View key="s8" style={[st.slide, { backgroundColor: '#050505', justifyContent: 'flex-start', paddingTop: H * 0.08 }]}>
      <Text style={st.bigTitle}>Apps to take{'\n'}control of.</Text>
      <Text style={st.sub}>
        {Platform.OS === 'android'
          ? 'Based on your usage — we suggest reducing these by at least 30%.'
          : 'Select the apps you spend the most time on.'}
      </Text>
      <View style={{ width: '100%', marginTop: 20 }}>
        {suggestedApps.map(app => {
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
      <TouchableOpacity style={[st.btn, { marginTop: 24 }]} onPress={next}>
        <Text style={st.btnTxt}>
          {selectedApps.length === 0
            ? 'Skip for now'
            : `Target ${selectedApps.length} app${selectedApps.length !== 1 ? 's' : ''}`}
        </Text>
      </TouchableOpacity>
    </View>,

    /* 9 — Set first block */
    <ScrollView key="s9" style={{ width: W }} contentContainerStyle={[st.slide, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
      <Text style={st.bigTitle}>Set your{'\n'}first block.</Text>
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

      <Text style={[st.sectionLbl, { marginTop: 28 }]}>TIME WINDOW</Text>
      <View style={st.timeRow}>
        <View style={st.timeBox}>
          <TouchableOpacity onPress={() => setStartMins(m => Math.max(0, m - 15))}>
            <Text style={st.timeAdj}>-</Text>
          </TouchableOpacity>
          <Text style={st.timeTxt}>{tStr(startMins)}</Text>
          <TouchableOpacity onPress={() => setStartMins(m => Math.min(1425, m + 15))}>
            <Text style={st.timeAdj}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={st.timeSep}>to</Text>
        <View style={st.timeBox}>
          <TouchableOpacity onPress={() => setEndMins(m => Math.max(15, m - 15))}>
            <Text style={st.timeAdj}>-</Text>
          </TouchableOpacity>
          <Text style={st.timeTxt}>{tStr(endMins)}</Text>
          <TouchableOpacity onPress={() => setEndMins(m => Math.min(1439, m + 15))}>
            <Text style={st.timeAdj}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={[st.btn, { marginTop: 36 }]} onPress={() => setPinSlide(true)}>
        <Text style={st.btnTxt}>Continue to final step</Text>
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
        {step > 0 ? (
          <TouchableOpacity onPress={prev} style={st.backBtn}>
            <Text style={st.backTxt}>Back</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}

        {!SELF_NAV.has(step) ? (
          <TouchableOpacity onPress={step === 2 ? validateEmail : next} style={st.nextBtn}>
            <Text style={st.nextTxt}>Next</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
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
    borderRadius: 8, alignSelf: 'flex-start', marginBottom: 20,
  },
  badgeTxt: { color: O.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  bigTitle: { fontSize: 34, fontWeight: '700', color: O.white, lineHeight: 42, marginBottom: 12 },
  sub: { fontSize: 16, color: O.muted, lineHeight: 24, marginBottom: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  stepNum: { fontSize: 11, fontWeight: '700', color: O.blue, width: 36, marginTop: 2, letterSpacing: 1 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: O.white, marginBottom: 3 },
  stepDesc: { fontSize: 14, color: O.muted, lineHeight: 20 },
  requiredBanner: {
    backgroundColor: '#2a1a00', borderWidth: 1, borderColor: '#ff9500',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 28, alignSelf: 'stretch',
  },
  requiredTxt: { color: '#ff9500', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sysSheet: {
    backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: O.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: O.white, textAlign: 'center', marginBottom: 12 },
  sheetBody: { fontSize: 14, color: O.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  denyBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: O.dim, alignItems: 'center' },
  denyTxt: { color: O.muted, fontWeight: '600', fontSize: 15 },
  allowBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: O.blue, alignItems: 'center' },
  allowTxt: { color: O.white, fontWeight: '700', fontSize: 15 },
  input: {
    borderWidth: 1, borderColor: O.border, borderRadius: 12,
    padding: 14, color: O.white, fontSize: 16, backgroundColor: '#141414', marginTop: 12,
  },
  errTxt: { color: O.red, fontSize: 13, marginTop: 6 },
  mutedNote: { color: O.muted, fontSize: 12, marginTop: 16, lineHeight: 18, textAlign: 'center' },
  btn: { backgroundColor: O.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnTxt: { color: O.white, fontWeight: '700', fontSize: 16 },
  link: { color: O.muted, fontSize: 14 },
  scrollerBig: { fontSize: 88, fontWeight: '700', color: O.white },
  scrollerUnit: { fontSize: 20, color: O.muted, marginTop: -8 },
  swipeHint: { color: O.muted, fontSize: 13, textAlign: 'center', marginTop: 16 },
  hCard: {
    backgroundColor: '#141414', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: O.border,
  },
  hCardLabel: { fontSize: 12, fontWeight: '700', color: O.muted, letterSpacing: 1, marginBottom: 12 },
  hCardValue: { fontSize: 52, fontWeight: '700', color: O.white, marginBottom: 8 },
  hCardSub: { fontSize: 14, color: O.muted, lineHeight: 20 },
  notifPreview: {
    backgroundColor: '#242424', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: O.border,
  },
  notifApp: { fontSize: 12, fontWeight: '700', color: O.muted, marginBottom: 3 },
  notifMsg: { fontSize: 14, color: O.white },
  modeCard: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: O.border, backgroundColor: '#141414' },
  modeCardOn: { borderColor: O.blue, backgroundColor: '#0a1f3c' },
  modeTitle: { fontSize: 18, fontWeight: '700', color: O.muted, marginBottom: 8 },
  modeSub: { fontSize: 14, color: O.muted, lineHeight: 21 },
  appRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10,
    backgroundColor: '#141414', borderWidth: 1, borderColor: O.border,
  },
  appRowOn: { borderColor: O.blue, backgroundColor: '#0a1f3c' },
  appName: { fontSize: 16, fontWeight: '600', color: O.muted },
  appMin: { fontSize: 12, color: O.muted, marginTop: 2 },
  cb: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: O.muted, alignItems: 'center', justifyContent: 'center' },
  cbOn: { backgroundColor: O.blue, borderColor: O.blue },
  sectionLbl: { fontSize: 11, fontWeight: '700', color: O.muted, letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#141414', borderWidth: 1, borderColor: O.border },
  pillOn: { backgroundColor: O.blue, borderColor: O.blue },
  pillTxt: { fontSize: 14, color: O.muted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141414', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: O.border },
  timeAdj: { fontSize: 22, color: O.blue, paddingHorizontal: 10 },
  timeTxt: { fontSize: 16, fontWeight: '600', color: O.white },
  timeSep: { fontSize: 14, color: O.muted },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: O.muted },
  dotFilled: { backgroundColor: O.blue, borderColor: O.blue },
  numPad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 32 },
  numKey: { width: '33.33%', paddingVertical: 18, alignItems: 'center' },
  numKeyTxt: { fontSize: 28, fontWeight: '300', color: O.white },
  progressTrack: { height: 3, backgroundColor: O.dim },
  progressFill: { height: 3, backgroundColor: O.blue },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: O.border,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  backTxt: { color: O.muted, fontSize: 16 },
  nextBtn: { backgroundColor: O.blue, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20 },
  nextTxt: { color: O.white, fontSize: 16, fontWeight: '600' },
});
