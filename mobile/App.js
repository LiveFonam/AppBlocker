import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  bg: '#050e18',
  card: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.08)',
  cyan: '#00d4d4',
  mint: '#3effa0',
  orange: '#ff9f0a',
  white: '#ffffff',
  muted: 'rgba(255,255,255,0.55)',
  blue: '#0066cc',
};

const INITIAL_APPS = [
  { id: '1', name: 'YouTube', icon: '▶️', color: '#ff3b30' },
  { id: '2', name: 'Instagram', icon: '📷', color: '#ff2d92' },
  { id: '3', name: 'TikTok', icon: '🎵', color: '#bf5af2' },
];

const LEADERBOARD = [
  { id: '1', name: 'Liam Rutherford', screenTime: '1h 03m', rank: 1 },
  { id: '2', name: 'Emma Garcia', screenTime: '1h 12m', rank: 2 },
  { id: '3', name: 'Me', screenTime: '2h 47m', rank: 3 },
  { id: '4', name: 'Noah Thompson', screenTime: '2h 54m', rank: 4 },
  { id: '5', name: 'Sophia Lee', screenTime: '3h 05m', rank: 5 },
];

const BARS = {
  screenTime: [0.03,0.02,0.04,0.03,0.02,0.04,0.06,0.05,0.09,0.22,0.31,0.43,0.46,0.53,0.49,0.63,0.74,0.86,0.61,0.52,0.37,0.24,0.12,0.07],
  pickups:    [0.01,0.0, 0.0, 0.0, 0.02,0.0, 0.01,0.0, 0.0, 0.08,0.04,0.03,0.03,0.0, 0.05,0.0, 0.0, 0.95,0.12,0.0, 0.06,0.0, 0.0, 0.0],
  notifs:     [0.0, 0.0, 0.01,0.0, 0.0, 0.0, 0.0, 0.04,0.03,0.0, 0.02,0.0, 0.0, 0.0, 0.08,0.03,0.02,0.04,0.09,0.08,0.05,0.03,0.01,0.0],
  weekly:     [0.65,0.48,0.43,0.51,0.46,0.31,0.28],
};

function readableDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function timeStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${suffix}`;
}

function todayDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function StatItem({ title, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: C.white, fontSize: 17, fontWeight: '500' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function SegmentControl({ options, selected, onSelect }) {
  return (
    <View style={s.segRow}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[s.segBtn, selected === o && s.segBtnOn]} onPress={() => onSelect(o)}>
          <Text style={[s.segTxt, selected === o && s.segTxtOn]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function BarChart({ bars, color, height = 80, labels }) {
  const bw = (SCREEN_WIDTH - 112) / bars.length;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
        {bars.map((v, i) => (
          <View key={i} style={{ width: Math.max(bw - 1, 3), height: Math.max(height * v, 2), backgroundColor: color, borderRadius: 2, marginHorizontal: 0.5, opacity: 0.9 }} />
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {labels.map(l => <Text key={l} style={{ color: C.muted, fontSize: 11 }}>{l}</Text>)}
        </View>
      )}
    </View>
  );
}

function Stepper({ value, onChange, min = 0, max = 1439, step = 15 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
        <Text style={{ color: C.white, fontSize: 18 }}>−</Text>
      </TouchableOpacity>
      <Text style={{ color: C.white, marginHorizontal: 10, minWidth: 72, textAlign: 'center' }}>{timeStr(value)}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
        <Text style={{ color: C.white, fontSize: 18 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function HomeScreen({ state, onEdit }) {
  const { blockedApps, screenTimeMinutes, pickups, startMinutes, endMinutes, blockTitle } = state;
  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 30, fontWeight: '900', color: C.white, flex: 1 }}>App blocker</Text>
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginRight: 10 }}>TODAY ›</Text>
        <TouchableOpacity style={s.iconBtn}><Text>🎁</Text></TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <View style={s.crystal}>
          <Text style={{ fontSize: 42 }}>🔮</Text>
        </View>
        <Text style={{ fontSize: 46, fontWeight: '500', color: C.mint, marginTop: 12 }}>{readableDuration(screenTimeMinutes)}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: C.muted, marginTop: 4, letterSpacing: 1 }}>SCREEN TIME</Text>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <StatItem title="MOST USED" value={blockedApps.slice(0, 3).map(a => a.name).join(' · ')} />
        <StatItem title="FOCUS LEVEL" value="83%" />
        <StatItem title="PICKUPS" value={String(pickups)} />
      </View>

      {/* Usage bars */}
      <Card style={{ marginBottom: 14 }}>
        <BarChart bars={BARS.pickups.slice(0, 12)} color={C.mint} height={70} labels={['6AM', '10AM', '2PM', '8PM']} />
      </Card>

      {/* Session card */}
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ color: C.mint, fontSize: 17, fontWeight: '600', flex: 1 }}>🌙 Time Offline</Text>
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '600' }}>5h 36m</Text>
        </View>
        <Text style={{ color: C.muted, marginBottom: 10 }}>68% of your day</Text>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 10 }} />
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ color: C.muted, fontSize: 12, flex: 1 }}>Session: {timeStr(startMinutes)}–{timeStr(endMinutes)}</Text>
          <Text style={{ color: C.white, fontSize: 12 }}>{blockTitle} ›</Text>
        </View>
      </Card>

      {/* Actions */}
      <TouchableOpacity style={[s.primaryBtn, { marginBottom: 10 }]} onPress={onEdit}>
        <Text style={s.primaryTxt}>🔒  Edit Block Distracting Apps</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondaryBtn}>
        <Text style={s.secondaryTxt}>📊  Open Daily Report</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function ReportScreen({ state }) {
  const { screenTimeMinutes, pickups, notifications } = state;
  const [range, setRange] = useState('Day');
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - 6 + i); return d; });

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.white, flex: 1 }}>refocus</Text>
        <TouchableOpacity style={s.iconBtn}><Text>👁</Text></TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, { marginLeft: 8 }]}><Text>❓</Text></TouchableOpacity>
      </View>

      <SegmentControl options={['Month', 'Week', 'Day']} selected={range} onSelect={setRange} />
      <View style={{ height: 16 }} />

      {/* Date strip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        {last7.map((date, i) => {
          const isToday = i === 6;
          return (
            <View key={i} style={{ alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>
                {['S','M','T','W','T','F','S'][date.getDay()]}
              </Text>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isToday ? C.blue : 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>{date.getDate()}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <Card style={{ marginBottom: 20 }}>
        <Text style={{ color: C.white, fontSize: 17, fontWeight: '600', marginBottom: 8 }}>Summary</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>{todayDate()}</Text>
        <Text style={{ color: C.white, fontSize: 42, fontWeight: '700', marginVertical: 4 }}>{readableDuration(screenTimeMinutes)}</Text>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Screen Time</Text>
        <View style={{ flexDirection: 'row' }}>
          <StatItem title="PICKUPS" value={String(pickups)} />
          <StatItem title="NOTIFICATIONS" value={String(notifications)} />
        </View>
      </Card>

      {/* Charts */}
      {[
        { title: 'Screen Time per Hour', bars: BARS.screenTime, color: C.cyan },
        { title: 'Pickups per Hour', bars: BARS.pickups, color: C.mint },
        { title: 'Notifications per Hour', bars: BARS.notifs, color: C.orange },
      ].map(({ title, bars, color }) => (
        <View key={title} style={{ marginBottom: 20 }}>
          <Text style={{ color: C.white, fontSize: 17, fontWeight: '600', marginBottom: 10 }}>{title}</Text>
          <Card>
            <BarChart bars={bars} color={color} height={80} labels={['12 AM', '6 AM', '12 PM', '6 PM']} />
          </Card>
        </View>
      ))}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function SessionsScreen({ state, onEdit }) {
  const { blockedApps, blockTitle, startMinutes, endMinutes, repeatRule, strictMode } = state;
  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.white, flex: 1 }}>refocus</Text>
        <TouchableOpacity style={s.iconBtn}><Text>👁</Text></TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, { marginLeft: 8 }]}><Text>❓</Text></TouchableOpacity>
      </View>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ color: C.white, fontSize: 19, fontWeight: '600', marginBottom: 14 }}>{blockTitle}</Text>
        {[
          ['🕐 Start', timeStr(startMinutes)],
          ['🕐 End', timeStr(endMinutes)],
          ['Repeat', repeatRule],
          ['Strict mode', strictMode],
        ].map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: C.muted }}>{label}</Text>
            <View style={label === 'Strict mode' ? { backgroundColor: 'rgba(255,159,10,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 } : null}>
              <Text style={{ color: C.white, fontWeight: '500' }}>{value}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={[s.primaryBtn, { marginTop: 6 }]} onPress={onEdit}>
          <Text style={s.primaryTxt}>Edit Block Distracting Apps</Text>
        </TouchableOpacity>
      </Card>

      {blockedApps.map(app => (
        <Card key={app.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 14 }}>
          <Text style={{ fontSize: 22, marginRight: 12 }}>{app.icon}</Text>
          <Text style={{ color: C.white, flex: 1, fontSize: 16 }}>{app.name}</Text>
          <Text style={{ color: C.muted }}>Blocked</Text>
        </Card>
      ))}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function LeaderboardScreen() {
  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: C.white, flex: 1 }}>Leaderboard</Text>
        <TouchableOpacity style={s.pillBtn}>
          <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>+ Add Friends</Text>
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 64, marginBottom: 8 }}>👤</Text>
        <Text style={{ color: C.muted, marginBottom: 4 }}>Just You!</Text>
        <Text style={{ color: C.white, fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>The Focused One</Text>
        <Text style={{ color: C.muted, marginBottom: 16 }}>See your friends' screen time</Text>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.white, paddingHorizontal: 24 }]}>
          <Text style={[s.primaryTxt, { color: '#000' }]}>Find Friends on App blocker</Text>
        </TouchableOpacity>
      </View>

      {LEADERBOARD.map(p => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
          <Text style={{ color: C.muted, fontWeight: '600', width: 22, fontSize: 14 }}>{p.rank}</Text>
          <Text style={{ fontSize: 20, marginHorizontal: 10 }}>{p.name === 'Me' ? '✅' : '👤'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.name === 'Me' ? C.cyan : C.white, fontWeight: '500' }}>{p.name}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{p.screenTime}</Text>
          </View>
          <Text style={{ color: C.muted }}>›</Text>
        </View>
      ))}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function ProfileScreen({ state }) {
  const { streakDays, focusHours, screenTimeMinutes } = state;
  const [metric, setMetric] = useState('Screen Time');

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 56, marginRight: 14 }}>👤</Text>
        <View>
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '800' }}>Powellite5120</Text>
          <View style={{ backgroundColor: 'rgba(255,214,10,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start', marginTop: 4 }}>
            <Text style={{ color: '#ffd60a', fontSize: 12, fontWeight: '700' }}>Top 5%</Text>
          </View>
        </View>
      </View>

      <Card style={{ flexDirection: 'row', marginBottom: 14 }}>
        {[
          { title: 'DAY STREAK', value: String(streakDays), icon: '🔥', color: C.orange },
          { title: 'FOCUS HOURS', value: String(focusHours), icon: '⏳', color: C.cyan },
        ].map(({ title, value, icon, color }) => (
          <View key={title} style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ fontSize: 30 }}>{icon}</Text>
            <Text style={{ color, fontSize: 42, fontWeight: '900', marginVertical: 4 }}>{value}</Text>
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 13 }}>{title}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <SegmentControl options={['Screen Time', 'Pickups', 'Notifications']} selected={metric} onSelect={setMetric} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 }}>
          <Text style={{ color: C.muted }}>Avg Screen Time</Text>
          <Text style={{ color: C.white, fontWeight: '700' }}>{readableDuration(Math.floor(screenTimeMinutes / 3))}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, marginBottom: 8 }}>
          {BARS.weekly.map((v, i) => (
            <View key={i} style={{ flex: 1, marginHorizontal: 3, height: Math.max(90 * v, 3), backgroundColor: C.cyan, borderRadius: 4, opacity: 0.85 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {['Fri','Sat','Sun','Mon','Tue','Wed','Thu'].map(d => (
            <Text key={d} style={{ flex: 1, color: C.muted, fontSize: 11, textAlign: 'center' }}>{d}</Text>
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: C.white, fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Community</Text>
        <Text style={{ color: C.muted, lineHeight: 20 }}>Your screen time was 78% lower than your peers yesterday. Great work.</Text>
      </Card>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── Block Editor Modal ───────────────────────────────────────────────────────

function BlockEditor({ visible, state, setState, onClose, onSave, onDelete }) {
  const { blockTitle, startMinutes, endMinutes, repeatRule, strictMode, isLocationBased, blockedApps } = state;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: C.cyan, fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: C.white, fontWeight: '600' }}>Edit Block</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={{ padding: 20 }}>
          <Card style={{ marginBottom: 14 }}>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>TITLE</Text>
            <TextInput
              value={blockTitle}
              onChangeText={v => setState(p => ({ ...p, blockTitle: v }))}
              style={{ color: C.white, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10 }}
              placeholderTextColor={C.muted}
            />
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 14, marginBottom: 8 }}>APPS & WEBSITES TO BLOCK</Text>
            {blockedApps.map(app => (
              <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, marginBottom: 6 }}>
                <Text style={{ marginRight: 10 }}>{app.icon}</Text>
                <Text style={{ color: C.white }}>{app.name}</Text>
              </View>
            ))}
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ color: C.muted }}>Start at</Text>
              <Stepper value={startMinutes} onChange={v => setState(p => ({ ...p, startMinutes: v }))} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>End at</Text>
              <Stepper value={endMinutes} onChange={v => setState(p => ({ ...p, endMinutes: v }))} />
            </View>
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>REPEAT</Text>
            <SegmentControl options={['Every day','Weekdays','Weekends']} selected={repeatRule} onSelect={v => setState(p => ({ ...p, repeatRule: v }))} />
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>STRICT MODE</Text>
            <SegmentControl options={['Easy','Normal','Hard']} selected={strictMode} onSelect={v => setState(p => ({ ...p, strictMode: v }))} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <Text style={{ color: C.white }}>Location based</Text>
              <Switch value={isLocationBased} onValueChange={v => setState(p => ({ ...p, isLocationBased: v }))} trackColor={{ true: C.blue }} />
            </View>
          </Card>

          <TouchableOpacity style={[s.primaryBtn, { marginBottom: 12 }]} onPress={onSave}>
            <Text style={s.primaryTxt}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: 'rgba(255,59,48,0.85)', marginBottom: 40 }]} onPress={onDelete}>
            <Text style={s.primaryTxt}>Delete</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

export default function App() {
  const [appState, setAppState] = useState({
    screenTimeMinutes: 167,
    pickups: 59,
    notifications: 11,
    streakDays: 2,
    focusHours: 24,
    blockTitle: 'Block Distracting Apps',
    startMinutes: 0,
    endMinutes: 1439,
    repeatRule: 'Every day',
    strictMode: 'Normal',
    isLocationBased: false,
    blockedApps: INITIAL_APPS,
  });

  const [showEditor, setShowEditor] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    setShowEditor(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1500);
  };

  const handleDelete = () => {
    Alert.alert('Delete schedule?', 'This removes all blocked apps from this schedule.', [
      { text: 'Delete', style: 'destructive', onPress: () => { setAppState(p => ({ ...p, blockedApps: [] })); setShowEditor(false); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const tabIcon = (emoji) => ({ color }) => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: '#0a0a0f', borderTopColor: 'rgba(255,255,255,0.08)' },
            tabBarActiveTintColor: C.cyan,
            tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
          }}
        >
          <Tab.Screen name="Home" options={{ tabBarIcon: tabIcon('🏠') }}>
            {() => <HomeScreen state={appState} onEdit={() => setShowEditor(true)} />}
          </Tab.Screen>
          <Tab.Screen name="Report" options={{ tabBarIcon: tabIcon('📊') }}>
            {() => <ReportScreen state={appState} />}
          </Tab.Screen>
          <Tab.Screen name="Sessions" options={{ tabBarIcon: tabIcon('⏱') }}>
            {() => <SessionsScreen state={appState} onEdit={() => setShowEditor(true)} />}
          </Tab.Screen>
          <Tab.Screen name="Leaderboard" options={{ tabBarIcon: tabIcon('🏆') }}>
            {() => <LeaderboardScreen />}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ tabBarIcon: tabIcon('👤') }}>
            {() => <ProfileScreen state={appState} />}
          </Tab.Screen>
        </Tab.Navigator>

        <BlockEditor
          visible={showEditor}
          state={appState}
          setState={setAppState}
          onClose={() => setShowEditor(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />

        {showToast && (
          <View style={s.toast} pointerEvents="none">
            <Text style={{ color: C.white, fontWeight: '600', fontSize: 15 }}>Saved</Text>
          </View>
        )}
      </View>
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  primaryBtn: {
    backgroundColor: C.cyan,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryTxt: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryTxt: {
    color: C.white,
    fontWeight: '600',
    fontSize: 14,
  },
  iconBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
  },
  segBtnOn: {
    backgroundColor: C.blue,
  },
  segTxt: {
    color: C.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  segTxtOn: {
    color: C.white,
  },
  stepBtn: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crystal: {
    width: 120,
    height: 130,
    borderRadius: 36,
    backgroundColor: 'rgba(0,212,212,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
