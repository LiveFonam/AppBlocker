import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Modal, Alert, Dimensions, StatusBar,
  Platform, FlatList, Vibration, Animated,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Onboarding from './Onboarding';
import { useAppBlocker } from './src/useAppBlocker';
import { supabase } from './src/supabase';

const { width: W } = Dimensions.get('window');

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) {
      return (
        <View style={{ flex:1, backgroundColor:'#000', justifyContent:'center', padding:32 }}>
          <Text style={{ color:'#ff453a', fontSize:16, fontWeight:'700', marginBottom:12 }}>Startup error</Text>
          <Text style={{ color:'#fff', fontSize:12, lineHeight:18 }}>{String(this.state.err)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const C = {
  bg:       '#000000',
  bg2:      '#0a0a0a',
  card:     '#111111',
  border:   '#1c1c1c',
  white:    '#ffffff',
  muted:    'rgba(255,255,255,0.4)',
  dim:      'rgba(255,255,255,0.18)',
  red:      '#ff453a',
  orange:   '#ff9f0a',
  orangeDim:'rgba(255,159,10,0.15)',
};

const COMMON_APPS = [
  { id: 'com.google.android.youtube',       name: 'YouTube',    icon: 'YT', color: '#ff453a' },
  { id: 'com.instagram.android',            name: 'Instagram',  icon: 'IG', color: '#ff375f' },
  { id: 'com.zhiliaoapp.musically',         name: 'TikTok',     icon: 'TK', color: '#bf5af2' },
  { id: 'com.twitter.android',              name: 'X',          icon: 'X',  color: '#1d9bf0' },
  { id: 'com.facebook.katana',              name: 'Facebook',   icon: 'FB', color: '#1877f2' },
  { id: 'com.snapchat.android',             name: 'Snapchat',   icon: 'SC', color: '#fffc00' },
  { id: 'com.reddit.frontpage',             name: 'Reddit',     icon: 'RD', color: '#ff4500' },
  { id: 'com.discord',                      name: 'Discord',    icon: 'DC', color: '#5865f2' },
  { id: 'com.netflix.mediaclient',          name: 'Netflix',    icon: 'NF', color: '#e50914' },
  { id: 'com.amazon.avod.thirdpartyclient', name: 'Prime Video',icon: 'PV', color: '#00a8e1' },
];

function dur(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function tstr(mins) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const s = h >= 12 ? 'PM' : 'AM';
  const d = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${d}:${String(m).padStart(2,'0')} ${s}`;
}

// ─── Shared Components ─────────────────────────────────────────────────────────

function Card({ children, style, glow }) {
  return <View style={[s.card, glow && s.cardGlow, style]}>{children}</View>;
}
function Label({ children, style }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}
function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />;
}
function StatBox({ title, value, sub, accent = C.white }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statVal, { color: accent }]}>{value}</Text>
      <Text style={s.statTitle}>{title}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}
function SegControl({ options, selected, onSelect }) {
  return (
    <View style={s.segWrap}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[s.segBtn, selected === o && s.segOn]} onPress={() => onSelect(o)}>
          <Text style={[s.segTxt, selected === o && s.segTxtOn]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function BarChart({ bars, color, height = 80, labels }) {
  const bw = (W - 96) / bars.length;
  return (
    <View>
      <View style={{ flexDirection:'row', alignItems:'flex-end', height }}>
        {bars.map((v, i) => (
          <View key={i} style={{
            width: Math.max(bw - 2, 2), height: Math.max(height * v, 2),
            backgroundColor: color, borderRadius: 3, marginHorizontal: 1,
            opacity: v > 0.5 ? 1 : 0.75,
          }} />
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: 8 }}>
          {labels.map(l => <Text key={l} style={s.chartLabel}>{l}</Text>)}
        </View>
      )}
    </View>
  );
}
function Stepper({ value, onChange }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(0, value - 15))}>
        <Text style={s.stepTxt}>-</Text>
      </TouchableOpacity>
      <Text style={s.stepVal}>{tstr(value)}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(1439, value + 15))}>
        <Text style={s.stepTxt}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const WEEKLY = [0.65, 0.48, 0.43, 0.51, 0.46, 0.31, 0.28];
const HOURLY = [0.03,0.02,0.04,0.03,0.02,0.04,0.06,0.05,0.09,0.22,0.31,0.43,0.46,0.53,0.49,0.63,0.74,0.86,0.61,0.52,0.37,0.24,0.12,0.07];

// ─── PIN Modal ─────────────────────────────────────────────────────────────────

function PinModal({ visible, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const verify = async () => {
    const stored = await AsyncStorage.getItem('@nova_pin');
    if (!stored || pin === stored) {
      setPin('');
      onSuccess();
    } else {
      setPin('');
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  };

  useEffect(() => { if (pin.length === 4) verify(); }, [pin]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.pinSheet}>
          <Text style={s.pinTitle}>Enter accountability code</Text>
          <Text style={[s.pinSub]}>Required to change block settings</Text>
          <Animated.View style={[s.pinDots, { transform: [{ translateX: shakeAnim }] }]}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[s.pinDot, pin.length > i && s.pinDotFilled]} />
            ))}
          </Animated.View>
          <View style={s.numPad}>
            {['1','2','3','4','5','6','7','8','9','','0','<'].map((k, i) => (
              <TouchableOpacity
                key={i}
                style={[s.numKey, k === '' && { opacity: 0 }]}
                disabled={k === ''}
                onPress={() => {
                  if (k === '<') setPin(p => p.slice(0, -1));
                  else if (pin.length < 4) setPin(p => p + k);
                }}
              >
                <Text style={s.numKeyTxt}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => { setPin(''); onCancel(); }} style={{ marginTop: 8 }}>
            <Text style={[s.link, { textAlign: 'center' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Time Lock Modal ────────────────────────────────────────────────────────────

function TimeLockModal({ visible, lockUntil, onExpired, onCancel }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!visible || !lockUntil) return;
    const tick = () => {
      const rem = Math.max(0, lockUntil - Date.now());
      setRemaining(rem);
      if (rem === 0) onExpired();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, lockUntil]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const progress = lockUntil ? Math.max(0, (lockUntil - Date.now()) / (2 * 60 * 1000)) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.timeLockSheet}>
          <Text style={s.pinTitle}>Changing settings</Text>
          <Text style={s.pinSub}>
            This cooldown helps prevent impulsive changes.{'\n'}
            Settings unlock when the timer reaches zero.
          </Text>
          <Text style={s.lockTimer}>{`${mins}:${String(secs).padStart(2,'0')}`}</Text>
          <View style={s.lockTrack}>
            <View style={[s.lockBar, { width: `${(1 - progress) * 100}%` }]} />
          </View>
          <TouchableOpacity onPress={onCancel} style={{ marginTop: 24 }}>
            <Text style={[s.link, { textAlign: 'center' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Blocked Screen Modal (preview / redirect target) ─────────────────────────

function BlockedScreenModal({ visible, blockTitle, endMins, appId = 'unknown', onClose }) {
  const holdAnim = useRef(new Animated.Value(0)).current;
  const holdRef  = useRef(null);
  const [done, setDone]             = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [emergencyMins, setEmergencyMins] = useState(15);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const raw = await AsyncStorage.getItem('@nova_emergency_today');
      const today = new Date().toDateString();
      const data = raw ? JSON.parse(raw) : null;

      if (!data || data.date !== today) {
        setAlreadyUsed(false);
        setEmergencyMins(15);
        return;
      }
      if (data.usedApps && data.usedApps.includes(appId)) {
        setAlreadyUsed(true);
        return;
      }
      // App hasn't used emergency yet — first app of the day gets 15 min, rest get 5
      setAlreadyUsed(false);
      setEmergencyMins(data.firstAppId ? 5 : 15);
    })();
  }, [visible, appId]);

  const startHold = () => {
    if (alreadyUsed) return;
    Vibration.vibrate([0, 80, 60, 80, 60, 80, 60, 80, 60, 80], true);
    holdRef.current = Animated.timing(holdAnim, { toValue: 1, duration: 3000, useNativeDriver: false });
    holdRef.current.start(async ({ finished }) => {
      Vibration.cancel();
      if (finished) {
        setDone(true);
        Vibration.vibrate([0, 200, 100, 200, 100, 400]);

        const today = new Date().toDateString();
        const raw = await AsyncStorage.getItem('@nova_emergency_today');
        const data = raw ? JSON.parse(raw) : null;
        const prev = data && data.date === today ? data : { date: today, firstAppId: null, usedApps: [] };
        await AsyncStorage.setItem('@nova_emergency_today', JSON.stringify({
          date: today,
          firstAppId: prev.firstAppId || appId,
          usedApps: [...(prev.usedApps || []), appId],
        }));
        setAlreadyUsed(true);

        setTimeout(() => { setDone(false); holdAnim.setValue(0); onClose(); }, 2000);
      }
    });
  };

  const endHold = () => {
    holdRef.current?.stop();
    Vibration.cancel();
    Animated.timing(holdAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const fillWidth = holdAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const holdLabel = done
    ? `${emergencyMins} min emergency granted`
    : alreadyUsed
      ? 'Emergency used for this app today'
      : `Hold for ${emergencyMins} min emergency access`;

  return (
    <Modal visible={visible} animationType="fade">
      <View style={s.blockedBg}>
        <StatusBar barStyle="light-content" />
        <Text style={s.blockedTitle}>THIS APP IS BLOCKED</Text>
        <Text style={s.blockedSub}>Until {tstr(endMins)}</Text>
        {blockTitle ? <Text style={s.blockedName}>{blockTitle}</Text> : null}

        <View style={s.holdWrap}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={startHold}
            onPressOut={endHold}
            style={s.holdBtn}
            disabled={alreadyUsed}
          >
            <View style={s.holdTrack}>
              <Animated.View style={[s.holdFill, { width: fillWidth }]} />
            </View>
            <Text style={s.holdTxt}>{holdLabel}</Text>
          </TouchableOpacity>
          <Text style={s.holdHint}>
            {alreadyUsed
              ? 'No more emergency access for this app today'
              : `Hold 3 seconds - vibration will be strong${emergencyMins === 5 ? ' (5 min, first app already used 15)' : ''}`}
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} style={s.blockedBack}>
          <Text style={s.blockedBackTxt}>Back to Student Focus</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Settings Sheet ────────────────────────────────────────────────────────────

function SettingsSheet({ visible, onClose, blocker, blockTitle, endMins, onPreviewBlock }) {
  const [email, setEmail] = useState('');
  useEffect(() => { AsyncStorage.getItem('@nova_pin').then(p => p && setEmail('')); }, [visible]);
  useEffect(() => { AsyncStorage.getItem('@nova_email').then(e => e && setEmail(e)); }, [visible]);

  const handleUnlockAll = () => {
    Alert.alert(
      'Unlock All Apps',
      'This will stop all active blocks immediately. Are you sure?',
      [
        {
          text: 'Unlock Everything',
          style: 'destructive',
          onPress: async () => {
            await blocker.stopBlocking();
            await AsyncStorage.removeItem('@nova_pin');
            onClose();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleStopBlocks = () => {
    Alert.alert(
      'Stop All Blocks',
      'Blocked apps will become accessible immediately.',
      [
        { text: 'Stop Blocking', style: 'destructive', onPress: () => { blocker.stopBlocking(); onClose(); } },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleResetPin = () => {
    Alert.alert(
      'Reset Accountability Code',
      'This removes the PIN. Anyone will be able to change your block settings. Are you sure?',
      [
        { text: 'Remove PIN', style: 'destructive', onPress: () => AsyncStorage.removeItem('@nova_pin') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.modalNav}>
          <View style={{ width: 60 }} />
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={{ color: C.white, fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>

          {email ? (
            <Card style={{ marginBottom: 20 }}>
              <Label style={{ marginBottom: 4 }}>ACCOUNT</Label>
              <Text style={{ color: C.white, fontSize: 15 }}>{email}</Text>
            </Card>
          ) : null}

          <Card style={{ marginBottom: 14 }}>
            <Label style={{ marginBottom: 8 }}>ACCOUNTABILITY CODE</Label>
            <Text style={[s.muted, { fontSize: 13, marginBottom: 12 }]}>
              A 4-digit code your trusted person holds. Required to change block settings.
            </Text>
            <TouchableOpacity onPress={handleResetPin}>
              <Text style={{ color: C.red, fontSize: 14, fontWeight: '600' }}>Remove Code</Text>
            </TouchableOpacity>
          </Card>

          <TouchableOpacity style={[s.ghostBtn, { marginBottom: 14 }]} onPress={onPreviewBlock}>
            <Text style={s.ghostTxt}>Preview Blocked Screen</Text>
          </TouchableOpacity>

          <Card style={{ marginBottom: 14, borderColor: C.orangeDim }}>
            <Label style={{ marginBottom: 8 }}>BEFORE DELETING THIS APP</Label>
            <Text style={[s.muted, { fontSize: 13, marginBottom: 14 }]}>
              {blocker.isBlocking
                ? `You currently have ${blocker.selectedCount} app${blocker.selectedCount === 1 ? '' : 's'} blocked. Deleting Student Focus will remove all blocks immediately.`
                : 'No active blocks. Safe to delete.'}
            </Text>
            {blocker.isBlocking && (
              <>
                <TouchableOpacity style={[s.deleteBtn, { marginBottom: 10 }]} onPress={handleStopBlocks}>
                  <Text style={s.deleteTxt}>Stop All Blocks</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.deleteBtn, { marginBottom: 10 }]} onPress={() => {
                  blocker.stopBlocking();
                  setTimeout(blocker.startBlocking, 60 * 60 * 1000);
                  onClose();
                  Alert.alert('Paused', 'Blocking paused for 1 hour.');
                }}>
                  <Text style={s.deleteTxt}>Pause for 1 Hour</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[s.deleteBtn, { borderColor: C.red + '60' }]} onPress={handleUnlockAll}>
              <Text style={[s.deleteTxt, { color: C.red }]}>Unlock All My Apps</Text>
            </TouchableOpacity>
          </Card>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Android App Picker ────────────────────────────────────────────────────────

function AndroidAppPickerModal({ visible, apps, blockedPackages, onToggle, onClose }) {
  const displayApps = apps.length > 0 ? apps : COMMON_APPS;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.modalNav}>
          <View style={{ width: 60 }} />
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>Choose Apps to Block</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={{ color: C.white, fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={displayApps}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const blocked = blockedPackages.includes(item.id);
            return (
              <TouchableOpacity
                style={[s.card, { flexDirection:'row', alignItems:'center', marginBottom: 10 }]}
                onPress={() => onToggle(item.id)}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (item.color || '#888') + '25', justifyContent:'center', alignItems:'center', marginRight: 14 }}>
                  <Text style={{ color: item.color || '#888', fontSize: 13, fontWeight: '800' }}>{item.icon || item.name?.slice(0,2)}</Text>
                </View>
                <Text style={{ color: C.white, fontSize: 16, fontWeight: '600', flex: 1 }}>{item.name}</Text>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: blocked ? C.white : 'transparent',
                  borderWidth: 2, borderColor: blocked ? C.white : C.muted,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {blocked && <Text style={{ color: '#000', fontSize: 14, fontWeight: '800' }}>x</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── Block Editor ──────────────────────────────────────────────────────────────

function BlockEditor({ visible, state, setState, blocker, onClose, onSave, onStop }) {
  const { blockTitle, startMinutes, endMinutes, repeatRule } = state;
  const { isBlocking, selectedCount, blockedPackages, installedApps, openAppPicker, stopBlocking, togglePackage } = blocker;
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const set = (key, val) => setState(p => ({ ...p, [key]: val }));

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={s.modalNav}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: C.white, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>Edit Block</Text>
            <TouchableOpacity onPress={onSave}>
              <Text style={{ color: C.white, fontSize: 16, fontWeight: '700' }}>{isBlocking ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            <Label style={{ marginBottom: 8 }}>BLOCK TITLE</Label>
            <Card style={{ marginBottom: 20 }}>
              <TextInput
                value={blockTitle}
                onChangeText={v => set('blockTitle', v)}
                style={s.input}
                placeholderTextColor={C.muted}
                placeholder="Give this block a name"
              />
            </Card>

            <Label style={{ marginBottom: 8 }}>APPS TO BLOCK</Label>
            <Card style={{ marginBottom: 20 }}>
              <TouchableOpacity
                style={{ flexDirection:'row', alignItems:'center', paddingVertical: 6 }}
                onPress={() => openAppPicker(setShowAndroidPicker)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>
                    {selectedCount === 0 ? 'Choose Apps to Block' : `${selectedCount} apps selected`}
                  </Text>
                  <Text style={[s.muted, { fontSize: 12, marginTop: 2 }]}>
                    {Platform.OS === 'ios' ? 'Opens system app picker' : 'Choose from installed apps'}
                  </Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            </Card>

            <Label style={{ marginBottom: 8 }}>SCHEDULE</Label>
            <Card style={{ marginBottom: 20 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={s.muted}>Start</Text>
                <Stepper value={startMinutes} onChange={v => set('startMinutes', v)} />
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 6 }}>
                <Text style={s.muted}>End</Text>
                <Stepper value={endMinutes} onChange={v => set('endMinutes', v)} />
              </View>
            </Card>

            <Label style={{ marginBottom: 8 }}>REPEAT</Label>
            <Card style={{ marginBottom: 24 }}>
              <SegControl options={['Every day','Weekdays','Weekends']} selected={repeatRule} onSelect={v => set('repeatRule', v)} />
            </Card>

            <TouchableOpacity
              style={[s.primaryBtn, { marginBottom: 12, opacity: selectedCount === 0 ? 0.4 : 1 }]}
              onPress={onSave}
              disabled={selectedCount === 0}
            >
              <Text style={s.primaryTxt}>{isBlocking ? 'Update Block' : 'Start Blocking'}</Text>
            </TouchableOpacity>

            {isBlocking && (
              <TouchableOpacity style={s.deleteBtn} onPress={() => {
                Alert.alert('Stop All Blocks?', 'Apps will become accessible after a 2-minute cooldown.', [
                  { text: 'Stop', style: 'destructive', onPress: onStop },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}>
                <Text style={s.deleteTxt}>Stop All Blocks</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <AndroidAppPickerModal
        visible={showAndroidPicker}
        apps={installedApps}
        blockedPackages={blockedPackages}
        onToggle={togglePackage}
        onClose={() => setShowAndroidPicker(false)}
      />
    </>
  );
}

// ─── Insights Screen ───────────────────────────────────────────────────────────

function InsightsScreen({ state, blocker, onManageBlock, onSettings }) {
  const { screenTimeMinutes, blockTitle, startMinutes, endMinutes } = state;
  const { isBlocking, selectedCount } = blocker;

  const insightMsg = isBlocking
    ? `${blockTitle} is active until ${tstr(endMinutes)}. Stay focused.`
    : selectedCount > 0
      ? `You have ${selectedCount} app${selectedCount === 1 ? '' : 's'} targeted. Start a block when you're ready.`
      : 'Set up your first block to start reclaiming your time.';

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[s.screenHeader, { justifyContent: 'space-between' }]}>
        <Text style={s.screenTitle}>Student Focus</Text>
        <TouchableOpacity onPress={onSettings} style={s.gearBtn}>
          <Text style={{ color: C.muted, fontSize: 20 }}>--</Text>
        </TouchableOpacity>
      </View>

      {/* Usage card */}
      <Card glow style={{ marginBottom: 14 }}>
        <Label style={{ marginBottom: 4 }}>TODAY'S USAGE</Label>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <Text style={s.bigNum}>{dur(screenTimeMinutes)}</Text>
          <Text style={s.muted}>screen time</Text>
        </View>
        <BarChart bars={HOURLY.slice(6, 18)} color={C.white} height={56} labels={['6 AM', '9 AM', '12 PM', '3 PM']} />
      </Card>

      {/* Active block card */}
      <Card style={{ marginBottom: 14, borderColor: isBlocking ? 'rgba(255,255,255,0.20)' : C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.statusDot, { backgroundColor: isBlocking ? C.white : C.muted }]} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: isBlocking ? C.white : C.muted, fontWeight: '700', fontSize: 16 }}>
              {isBlocking ? 'Blocking Active' : 'Not Blocking'}
            </Text>
            <Text style={s.muted}>
              {isBlocking
                ? `${tstr(startMinutes)} - ${tstr(endMinutes)}`
                : selectedCount > 0
                  ? `${selectedCount} app${selectedCount === 1 ? '' : 's'} targeted`
                  : 'No apps selected'}
            </Text>
          </View>
          <TouchableOpacity onPress={onManageBlock} style={s.manageBtn}>
            <Text style={[s.manageTxt, { color: C.white }]}>Manage</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* AI insight card */}
      <Card style={{ marginBottom: 14, backgroundColor: C.bg2 }}>
        <Label style={{ marginBottom: 8 }}>INSIGHT</Label>
        <Text style={{ color: C.white, fontSize: 15, lineHeight: 22 }}>{insightMsg}</Text>
      </Card>

      {/* Weekly trend */}
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <Label>WEEKLY TREND</Label>
          <Text style={[s.muted, { fontSize: 12 }]}>Last 7 days</Text>
        </View>
        <BarChart
          bars={WEEKLY}
          color={C.white}
          height={72}
          labels={['Mon','Tue','Wed','Thu','Fri','Sat','Sun']}
        />
      </Card>

      <TouchableOpacity style={s.primaryBtn} onPress={onManageBlock}>
        <Text style={s.primaryTxt}>{isBlocking ? 'Manage Block' : 'Start Blocking'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Ideas Screen ──────────────────────────────────────────────────────────────

function IdeasScreen() {
  const IDEAS = [
    { title: 'No-phone morning',    desc: 'Try keeping your phone off for the first 30 minutes after you wake up.' },
    { title: 'Add a study buddy',   desc: 'Share your weekly goal with a friend. Accountability works.' },
    { title: 'Block a new category', desc: 'News and browsing are often bigger time sinks than social media.' },
    { title: 'Streak challenge',    desc: '7 days under your target. Start tracking your longest streak.' },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Ideas</Text>
      </View>
      <Text style={[s.muted, { marginBottom: 20, fontSize: 14, lineHeight: 20 }]}>
        Small experiments to try this week. Tap one that feels doable.
      </Text>
      {IDEAS.map((idea, i) => (
        <TouchableOpacity key={i} activeOpacity={0.75}>
          <Card style={{ marginBottom: 14 }}>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>{idea.title}</Text>
            <Text style={[s.muted, { fontSize: 14, lineHeight: 20 }]}>{idea.desc}</Text>
          </Card>
        </TouchableOpacity>
      ))}
      <Card style={{ marginTop: 8, borderStyle: 'dashed', borderColor: C.dim }}>
        <Text style={[s.muted, { textAlign: 'center', fontSize: 13 }]}>
          More ideas coming in future updates.
        </Text>
      </Card>
    </ScrollView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

function App() {
  const [onboardingDone, setOnboardingDone] = useState(null);
  const blocker = useAppBlocker();

  const [appState, setAppState] = useState({
    screenTimeMinutes: 167,
    pickups: 59,
    blockTitle: 'Focus Block',
    startMinutes: 540,
    endMinutes: 660,
    repeatRule: 'Every day',
  });

  // Load persisted appState on mount
  useEffect(() => {
    AsyncStorage.getItem('@nova_app_state').then(raw => {
      if (raw) {
        try { setAppState(p => ({ ...p, ...JSON.parse(raw) })); } catch (_) {}
      }
    });
  }, []);

  const [showEditor,       setShowEditor]       = useState(false);
  const [showPinModal,     setShowPinModal]      = useState(false);
  const [showTimeLock,     setShowTimeLock]      = useState(false);
  const [showSettings,     setShowSettings]      = useState(false);
  const [showBlockedPreview, setShowBlockedPreview] = useState(false);
  const [lockUntil,        setLockUntil]         = useState(null);
  const [toast,            setToast]             = useState(null);
  const pendingAction  = useRef(null);
  const preEditState   = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('@nova_onboarding_done').then(v => setOnboardingDone(v === 'true'));
    supabase.auth.getSession(); // restores persisted session silently on startup
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleManageBlock = () => {
    preEditState.current = {
      startMinutes: appState.startMinutes,
      endMinutes:   appState.endMinutes,
      selectedCount: blocker.selectedCount,
      isBlocking:   blocker.isBlocking,
    };
    setShowEditor(true);
  };

  const blockDuration = (start, end) =>
    end > start ? end - start : 1440 - start + end;

  const applyLockThen = async (action) => {
    const storedLock = await AsyncStorage.getItem('@nova_lock_until');
    const now = Date.now();
    if (storedLock && parseInt(storedLock) > now) {
      setLockUntil(parseInt(storedLock));
    } else {
      const until = now + 2 * 60 * 1000;
      setLockUntil(until);
      await AsyncStorage.setItem('@nova_lock_until', String(until));
    }
    pendingAction.current = action;
    setShowTimeLock(true);
  };

  const doSave = async () => {
    await blocker.startBlocking(appState.startMinutes, appState.endMinutes);
    await AsyncStorage.setItem('@nova_app_state', JSON.stringify({
      blockTitle:   appState.blockTitle,
      startMinutes: appState.startMinutes,
      endMinutes:   appState.endMinutes,
      repeatRule:   appState.repeatRule,
    }));
    setShowEditor(false);
    showToast('Block saved');
  };

  const handleSave = async () => {
    const pre = preEditState.current;
    const wasBlocking = pre?.isBlocking;
    const newDur = blockDuration(appState.startMinutes, appState.endMinutes);
    const oldDur = pre ? blockDuration(pre.startMinutes, pre.endMinutes) : Infinity;
    const isWeakening = wasBlocking && (
      newDur < oldDur || blocker.selectedCount < (pre?.selectedCount ?? 0)
    );

    if (isWeakening) {
      await applyLockThen(doSave);
    } else {
      await doSave();
    }
  };

  const handleStopBlocking = async () => {
    await applyLockThen(async () => {
      await blocker.stopBlocking();
      setShowEditor(false);
      showToast('Blocks stopped');
    });
  };

  const onLockExpired = async () => {
    setShowTimeLock(false);
    await AsyncStorage.removeItem('@nova_lock_until');
    const pin = await AsyncStorage.getItem('@nova_pin');
    if (pin) {
      setShowPinModal(true);
    } else {
      const action = pendingAction.current;
      pendingAction.current = null;
      await action?.();
    }
  };

  // ── Splash ────
  if (onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems:'center', justifyContent:'center' }}>
        <Text style={{ color: C.white, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>STUDENT FOCUS</Text>
      </View>
    );
  }

  // ── Onboarding ────
  if (!onboardingDone) {
    return (
      <Onboarding
        requestAuth={blocker.requestAuthorization}
        getUsageStats={blocker.getUsageStats}
        onComplete={async (config) => {
          const next = {
            blockTitle:   config.blockName,
            startMinutes: config.startMins,
            endMinutes:   config.endMins,
          };
          setAppState(p => ({ ...p, ...next }));
          await AsyncStorage.setItem('@nova_app_state', JSON.stringify(next));
          if (config.email) await AsyncStorage.setItem('@nova_email', config.email);
          await AsyncStorage.setItem('@nova_onboarding_done', 'true');
          setOnboardingDone(true);
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" />

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: s.tabBar,
          tabBarActiveTintColor: C.white,
          tabBarInactiveTintColor: C.muted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tab.Screen name="Insights">
          {() => (
            <InsightsScreen
              state={appState}
              blocker={blocker}
              onManageBlock={handleManageBlock}
              onSettings={() => setShowSettings(true)}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Ideas" component={IdeasScreen} />
      </Tab.Navigator>

      {/* Modals */}
      <TimeLockModal
        visible={showTimeLock}
        lockUntil={lockUntil}
        onExpired={onLockExpired}
        onCancel={() => { setShowTimeLock(false); AsyncStorage.removeItem('@nova_lock_until'); }}
      />

      <PinModal
        visible={showPinModal}
        onSuccess={async () => {
          setShowPinModal(false);
          const action = pendingAction.current;
          pendingAction.current = null;
          await action?.();
        }}
        onCancel={() => setShowPinModal(false)}
      />

      <BlockEditor
        visible={showEditor}
        state={appState}
        setState={setAppState}
        blocker={blocker}
        onClose={() => setShowEditor(false)}
        onSave={handleSave}
        onStop={handleStopBlocking}
      />

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        blocker={blocker}
        blockTitle={appState.blockTitle}
        endMins={appState.endMinutes}
        onPreviewBlock={() => { setShowSettings(false); setShowBlockedPreview(true); }}
      />

      <BlockedScreenModal
        visible={showBlockedPreview}
        blockTitle={appState.blockTitle}
        endMins={appState.endMinutes}
        appId="preview"
        onClose={() => setShowBlockedPreview(false)}
      />

      {/* Toast */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastTxt}>{toast}</Text>
        </View>
      )}
    </NavigationContainer>
  );
}

const _App = App;
export default function AppWithBoundary() {
  return <ErrorBoundary><_App /></ErrorBoundary>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: 56 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  screenTitle: { color: C.white, fontSize: 28, fontWeight: '800', flex: 1 },
  gearBtn: { padding: 8 },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 16, marginBottom: 0, borderWidth: 1, borderColor: C.border },
  cardGlow: { backgroundColor: C.card, borderColor: 'rgba(255,255,255,0.12)' },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  muted: { color: C.muted, fontSize: 13 },
  bigNum: { color: C.white, fontSize: 32, fontWeight: '800' },
  chartLabel: { color: C.dim, fontSize: 10 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statTitle: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  statSub: { color: C.dim, fontSize: 10, marginTop: 1 },
  segWrap: { flexDirection: 'row', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 7, alignItems: 'center' },
  segOn: { backgroundColor: C.border },
  segTxt: { color: C.muted, fontSize: 13, fontWeight: '600' },
  segTxtOn: { color: C.white },
  stepBtn: { width: 36, height: 36, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  stepTxt: { color: C.white, fontSize: 20, lineHeight: 24 },
  stepVal: { color: C.white, fontSize: 14, fontWeight: '600', marginHorizontal: 12, minWidth: 80, textAlign: 'center' },
  primaryBtn: { backgroundColor: C.white, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  primaryTxt: { color: C.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  ghostBtn: { paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  ghostTxt: { color: C.muted, fontSize: 16, fontWeight: '600' },
  deleteBtn: { paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.orangeDim },
  deleteTxt: { color: C.orange, fontSize: 15, fontWeight: '600' },
  input: { color: C.white, fontSize: 16, paddingVertical: 4 },
  link: { color: C.muted, fontSize: 14 },
  tabBar: { backgroundColor: C.bg, borderTopColor: C.border, height: 64, paddingBottom: 10 },
  modalNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  toast: { position: 'absolute', bottom: 100, left: 40, right: 40, backgroundColor: 'rgba(10,10,10,0.97)', padding: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  toastTxt: { color: C.white, fontWeight: '600', fontSize: 14 },
  // PIN modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  pinSheet: { backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, padding: 32, paddingBottom: 48 },
  pinTitle: { color: C.white, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  pinSub: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 28 },
  pinDot: { width: 16, height: 16, borderRadius: 0, borderWidth: 2, borderColor: C.muted },
  pinDotFilled: { backgroundColor: C.white, borderColor: C.white },
  numPad: { flexDirection: 'row', flexWrap: 'wrap' },
  numKey: { width: '33.33%', paddingVertical: 16, alignItems: 'center' },
  numKeyTxt: { fontSize: 26, fontWeight: '300', color: C.white },
  // Time lock modal
  timeLockSheet: { backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, padding: 32, paddingBottom: 48 },
  lockTimer: { color: C.white, fontSize: 56, fontWeight: '800', textAlign: 'center', marginVertical: 16 },
  lockTrack: { height: 3, backgroundColor: C.border, overflow: 'hidden', marginHorizontal: 16 },
  lockBar: { height: 3, backgroundColor: C.white },
  // Blocked screen
  blockedBg: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  blockedTitle: { color: C.white, fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginBottom: 8 },
  blockedSub: { color: C.muted, fontSize: 18, textAlign: 'center', marginBottom: 4 },
  blockedName: { color: C.dim, fontSize: 14, textAlign: 'center', marginBottom: 48 },
  holdWrap: { width: '100%', alignItems: 'center' },
  holdBtn: { width: '100%', overflow: 'hidden', backgroundColor: C.card, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  holdTrack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  holdFill: { height: '100%', backgroundColor: C.red + '40' },
  holdTxt: { color: C.white, fontSize: 15, fontWeight: '700', textAlign: 'center', padding: 20, zIndex: 1 },
  holdHint: { color: C.muted, fontSize: 12, textAlign: 'center' },
  blockedBack: { position: 'absolute', bottom: 48, alignSelf: 'center' },
  blockedBackTxt: { color: C.muted, fontSize: 14 },
  // Status dot
  statusDot: { width: 8, height: 8, marginRight: 12 },
  // Manage button
  manageBtn: { borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 6 },
  manageTxt: { fontSize: 13, fontWeight: '700' },
});
