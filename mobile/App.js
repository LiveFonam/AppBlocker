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

const { width: W } = Dimensions.get('window');

const C = {
  bg:       '#060d18',
  bg2:      '#0a1525',
  card:     '#0f1d2e',
  cardGlow: '#0d2a3a',
  border:   'rgba(255,255,255,0.07)',
  cyan:     '#00e5ff',
  cyanDim:  'rgba(0,229,255,0.15)',
  mint:     '#00ffb0',
  mintDim:  'rgba(0,255,176,0.12)',
  orange:   '#ff9f0a',
  orangeDim:'rgba(255,159,10,0.15)',
  blue:     '#1a6fff',
  blueDim:  'rgba(26,111,255,0.2)',
  white:    '#ffffff',
  off:      '#e0f0ff',
  muted:    'rgba(180,210,255,0.5)',
  dim:      'rgba(180,210,255,0.25)',
};

const INITIAL_APPS = [
  { id: '1', name: 'YouTube',   icon: '▶',  color: '#ff453a' },
  { id: '2', name: 'Instagram', icon: '◈',  color: '#ff375f' },
  { id: '3', name: 'TikTok',    icon: '♪',  color: '#bf5af2' },
];

const LEADERBOARD = [
  { id: '1', name: 'Liam Rutherford', screenTime: '1h 03m', rank: 1, me: false },
  { id: '2', name: 'Emma Garcia',     screenTime: '1h 12m', rank: 2, me: false },
  { id: '3', name: 'Me',              screenTime: '2h 47m', rank: 3, me: true  },
  { id: '4', name: 'Noah Thompson',   screenTime: '2h 54m', rank: 4, me: false },
  { id: '5', name: 'Sophia Lee',      screenTime: '3h 05m', rank: 5, me: false },
];

const BARS = {
  screenTime: [0.03,0.02,0.04,0.03,0.02,0.04,0.06,0.05,0.09,0.22,0.31,0.43,0.46,0.53,0.49,0.63,0.74,0.86,0.61,0.52,0.37,0.24,0.12,0.07],
  pickups:    [0.01,0,0,0,0.02,0,0.01,0,0,0.08,0.04,0.03,0.03,0,0.05,0,0,0.95,0.12,0,0.06,0,0,0],
  notifs:     [0,0,0.01,0,0,0,0,0.04,0.03,0,0.02,0,0,0,0.08,0.03,0.02,0.04,0.09,0.08,0.05,0.03,0.01,0],
  weekly:     [0.65,0.48,0.43,0.51,0.46,0.31,0.28],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dur(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function tstr(mins) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  const s = h >= 12 ? 'PM' : 'AM';
  const d = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${d}:${String(m).padStart(2,'0')} ${s}`;
}

function today() {
  return new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Card({ children, style, glow }) {
  return (
    <View style={[s.card, glow && s.cardGlow, style]}>
      {children}
    </View>
  );
}

function Label({ children, style }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

function SectionTitle({ children, style }) {
  return <Text style={[s.sectionTitle, style]}>{children}</Text>;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />;
}

function Pill({ children, color = C.cyanDim, textColor = C.cyan }) {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' }}>
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

function IconBtn({ icon, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.iconBtn}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
    </TouchableOpacity>
  );
}

function StatBox({ title, value, sub, accent = C.cyan }) {
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
            width: Math.max(bw - 2, 2),
            height: Math.max(height * v, 2),
            backgroundColor: color,
            borderRadius: 3,
            marginHorizontal: 1,
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
        <Text style={s.stepTxt}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepVal}>{tstr(value)}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(Math.min(1439, value + 15))}>
        <Text style={s.stepTxt}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function ScreenHeader({ title, onEye, onHelp }) {
  return (
    <View style={s.screenHeader}>
      <Text style={s.screenTitle}>{title}</Text>
      <View style={{ flexDirection:'row', gap: 8 }}>
        {onEye  && <IconBtn icon="👁" onPress={onEye} />}
        {onHelp && <IconBtn icon="?" onPress={onHelp} />}
      </View>
    </View>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function HomeScreen({ state, onEdit }) {
  const { blockedApps, screenTimeMinutes, pickups, startMinutes, endMinutes, blockTitle } = state;

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Top bar */}
      <View style={s.screenHeader}>
        <View>
          <Text style={s.screenTitle}>App Blocker</Text>
          <Text style={s.muted}>Today's overview</Text>
        </View>
        <View style={{ flexDirection:'row', gap: 8 }}>
          <View style={s.todayBadge}><Text style={{ color: C.cyan, fontSize: 12, fontWeight: '700' }}>TODAY</Text></View>
          <IconBtn icon="🎁" />
        </View>
      </View>

      {/* Hero orb */}
      <View style={s.heroWrap}>
        <View style={s.heroGlow} />
        <View style={s.heroOrb}>
          <View style={s.heroOrbInner}>
            <Text style={s.heroTime}>{dur(screenTimeMinutes)}</Text>
            <Text style={s.heroLabel}>SCREEN TIME</Text>
          </View>
        </View>
      </View>

      {/* Quick stats */}
      <Card style={{ flexDirection:'row', marginBottom: 14 }}>
        <StatBox title="MOST USED"   value={blockedApps[0]?.name ?? '—'} sub={blockedApps[1]?.name} accent={C.cyan} />
        <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />
        <StatBox title="FOCUS"       value="83%"          accent={C.mint} />
        <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />
        <StatBox title="PICKUPS"     value={String(pickups)} accent={C.orange} />
      </Card>

      {/* Usage bars */}
      <Card style={{ marginBottom: 14 }} glow>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <SectionTitle>Hourly Activity</SectionTitle>
          <Pill color={C.mintDim} textColor={C.mint}>Today</Pill>
        </View>
        <BarChart bars={BARS.pickups.slice(0, 12)} color={C.mint} height={64} labels={['6 AM','10 AM','2 PM','8 PM']} />
      </Card>

      {/* Session card */}
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom: 4 }}>
          <Text style={{ color: C.cyan, fontSize: 13, fontWeight: '700', flex: 1, letterSpacing: 0.5 }}>🌙  TIME OFFLINE</Text>
          <Text style={{ color: C.white, fontSize: 28, fontWeight: '800' }}>5h 36m</Text>
        </View>
        <Text style={[s.muted, { marginBottom: 12 }]}>68% of your day spent offline</Text>
        <Divider />
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Text style={[s.muted, { flex: 1, fontSize: 12 }]}>
            {tstr(startMinutes)} – {tstr(endMinutes)}
          </Text>
          <Text style={{ color: C.off, fontSize: 12, fontWeight: '600' }}>{blockTitle}  ›</Text>
        </View>
      </Card>

      {/* Blocked apps row */}
      {blockedApps.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <SectionTitle style={{ marginBottom: 12 }}>Blocked Right Now</SectionTitle>
          {blockedApps.map((app, i) => (
            <View key={app.id} style={[{ flexDirection:'row', alignItems:'center', paddingVertical: 9 }, i < blockedApps.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: app.color + '22', justifyContent:'center', alignItems:'center', marginRight: 12 }}>
                <Text style={{ color: app.color, fontSize: 16, fontWeight: '800' }}>{app.icon}</Text>
              </View>
              <Text style={{ color: C.off, fontSize: 15, fontWeight: '500', flex: 1 }}>{app.name}</Text>
              <View style={{ backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={{ color: '#ff453a', fontSize: 12, fontWeight: '700' }}>Blocked</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Actions */}
      <TouchableOpacity style={s.primaryBtn} onPress={onEdit}>
        <Text style={s.primaryTxt}>🔒  Edit Blocked Apps</Text>
      </TouchableOpacity>
      <View style={{ height: 10 }} />
      <TouchableOpacity style={s.ghostBtn}>
        <Text style={s.ghostTxt}>📊  View Full Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

function ReportScreen({ state }) {
  const { screenTimeMinutes, pickups, notifications } = state;
  const [range, setRange] = useState('Day');
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 6 + i); return d;
  });

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Report" />

      <SegControl options={['Month','Week','Day']} selected={range} onSelect={setRange} />
      <View style={{ height: 16 }} />

      {/* Date strip */}
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: 20 }}>
        {last7.map((date, i) => {
          const isToday = i === 6;
          return (
            <View key={i} style={{ alignItems:'center' }}>
              <Text style={[s.muted, { fontSize: 11, marginBottom: 6 }]}>
                {['S','M','T','W','T','F','S'][date.getDay()]}
              </Text>
              <View style={[s.dateDot, isToday && s.dateDotActive]}>
                <Text style={[s.dateTxt, isToday && { color: C.white }]}>{date.getDate()}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <Card glow style={{ marginBottom: 20 }}>
        <Label style={{ marginBottom: 4 }}>SUMMARY</Label>
        <Text style={s.muted}>{today()}</Text>
        <Text style={s.bigNum}>{dur(screenTimeMinutes)}</Text>
        <Text style={[s.muted, { marginBottom: 16 }]}>Total Screen Time</Text>
        <View style={{ flexDirection:'row' }}>
          <StatBox title="PICKUPS"       value={String(pickups)}       accent={C.mint}   />
          <View style={{ width: 1, backgroundColor: C.border }} />
          <StatBox title="NOTIFICATIONS" value={String(notifications)} accent={C.orange} />
        </View>
      </Card>

      {/* Charts */}
      {[
        { title: 'Screen Time per Hour', bars: BARS.screenTime, color: C.cyan   },
        { title: 'Pickups per Hour',     bars: BARS.pickups,    color: C.mint   },
        { title: 'Notifications/Hour',   bars: BARS.notifs,     color: C.orange },
      ].map(({ title, bars, color }) => (
        <Card key={title} style={{ marginBottom: 16 }}>
          <SectionTitle style={{ marginBottom: 14 }}>{title}</SectionTitle>
          <BarChart bars={bars} color={color} height={80} labels={['12 AM','6 AM','12 PM','6 PM']} />
        </Card>
      ))}
    </ScrollView>
  );
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function SessionsScreen({ state, onEdit }) {
  const { blockedApps, blockTitle, startMinutes, endMinutes, repeatRule, strictMode } = state;

  const strictColor = { Easy: C.mint, Normal: C.orange, Hard: '#ff453a' }[strictMode] ?? C.cyan;

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Sessions" />

      {/* Active block */}
      <Card glow style={{ marginBottom: 16 }}>
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Label style={{ marginBottom: 4 }}>ACTIVE BLOCK</Label>
            <Text style={{ color: C.white, fontSize: 20, fontWeight: '700' }}>{blockTitle}</Text>
          </View>
          <View style={{ backgroundColor: C.cyanDim, padding: 10, borderRadius: 12 }}>
            <Text style={{ fontSize: 20 }}>🔒</Text>
          </View>
        </View>
        <Divider />
        {[
          { label: 'Start',       value: tstr(startMinutes), accent: C.cyan },
          { label: 'End',         value: tstr(endMinutes),   accent: C.cyan },
          { label: 'Repeat',      value: repeatRule,         accent: C.off  },
          { label: 'Strict Mode', value: strictMode,         accent: strictColor },
        ].map(({ label, value, accent }) => (
          <View key={label} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 8 }}>
            <Text style={s.muted}>{label}</Text>
            <Text style={{ color: accent, fontWeight: '600', fontSize: 15 }}>{value}</Text>
          </View>
        ))}
        <View style={{ height: 14 }} />
        <TouchableOpacity style={s.primaryBtn} onPress={onEdit}>
          <Text style={s.primaryTxt}>Edit Block</Text>
        </TouchableOpacity>
      </Card>

      <Label style={{ marginBottom: 10 }}>BLOCKED APPS</Label>
      {blockedApps.length === 0 ? (
        <Card><Text style={[s.muted, { textAlign:'center', paddingVertical: 20 }]}>No apps blocked</Text></Card>
      ) : (
        blockedApps.map(app => (
          <Card key={app.id} style={{ flexDirection:'row', alignItems:'center', marginBottom: 10, paddingVertical: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: app.color + '25', justifyContent:'center', alignItems:'center', marginRight: 14 }}>
              <Text style={{ color: app.color, fontSize: 18, fontWeight: '800' }}>{app.icon}</Text>
            </View>
            <Text style={{ color: C.off, fontSize: 16, fontWeight: '600', flex: 1 }}>{app.name}</Text>
            <View style={{ backgroundColor:'rgba(255,59,48,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ color:'#ff453a', fontSize: 12, fontWeight: '700' }}>Blocked</Text>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function LeaderboardScreen() {
  const medals = ['🥇','🥈','🥉'];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Leaderboard</Text>
        <TouchableOpacity style={s.pillBtn}>
          <Text style={{ color: C.cyan, fontWeight: '700', fontSize: 13 }}>+ Add Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Empty friend state */}
      <Card glow style={{ alignItems:'center', paddingVertical: 32, marginBottom: 24 }}>
        <Text style={{ fontSize: 56, marginBottom: 12 }}>🏆</Text>
        <Text style={[s.muted, { marginBottom: 6 }]}>Just You Right Now</Text>
        <Text style={{ color: C.white, fontSize: 26, fontWeight: '900', marginBottom: 8 }}>The Focused One</Text>
        <Text style={[s.muted, { textAlign:'center', marginBottom: 20, lineHeight: 20 }]}>
          Invite friends to compare{'\n'}screen time and stay accountable
        </Text>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.white, paddingHorizontal: 28 }]}>
          <Text style={[s.primaryTxt, { color:'#000' }]}>Find Friends</Text>
        </TouchableOpacity>
      </Card>

      <Label style={{ marginBottom: 10 }}>THIS WEEK</Label>
      <Card>
        {LEADERBOARD.map((p, i) => (
          <View key={p.id} style={[
            { flexDirection:'row', alignItems:'center', paddingVertical: 12 },
            i < LEADERBOARD.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
            p.me && { backgroundColor: C.cyanDim, marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 10 }
          ]}>
            <Text style={{ fontSize: p.rank <= 3 ? 20 : 14, width: 28, textAlign:'center', color: C.muted, fontWeight: '700' }}>
              {p.rank <= 3 ? medals[p.rank - 1] : p.rank}
            </Text>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.me ? C.cyanDim : 'rgba(255,255,255,0.07)', justifyContent:'center', alignItems:'center', marginRight: 12 }}>
              <Text style={{ fontSize: 18 }}>{p.me ? '😊' : '👤'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.me ? C.cyan : C.off, fontWeight: p.me ? '700' : '500', fontSize: 15 }}>{p.name}</Text>
              <Text style={[s.muted, { fontSize: 12 }]}>{p.screenTime} today</Text>
            </View>
            {p.me && <Pill color="transparent" textColor={C.cyan}>You</Pill>}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileScreen({ state }) {
  const { streakDays, focusHours, screenTimeMinutes } = state;
  const [metric, setMetric] = useState('Screen Time');

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom: 24 }}>
        <View style={s.avatarWrap}>
          <Text style={{ fontSize: 32 }}>😊</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Powellite5120</Text>
          <Pill color="rgba(255,214,10,0.15)" textColor="#ffd60a">⭐ Top 5%</Pill>
        </View>
        <TouchableOpacity style={s.iconBtn}><Text>⚙️</Text></TouchableOpacity>
      </View>

      {/* Streak + Focus */}
      <Card glow style={{ flexDirection:'row', marginBottom: 14 }}>
        {[
          { title: 'DAY STREAK',  value: String(streakDays), icon: '🔥', color: C.orange },
          { title: 'FOCUS HOURS', value: String(focusHours), icon: '⏳', color: C.cyan   },
        ].map(({ title, value, icon, color }, i) => (
          <View key={title} style={[{ flex: 1, alignItems:'center', paddingVertical: 16 }, i === 0 && { borderRightWidth: 1, borderRightColor: C.border }]}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>{icon}</Text>
            <Text style={{ color, fontSize: 40, fontWeight: '900', lineHeight: 44 }}>{value}</Text>
            <Text style={[s.label, { marginTop: 4 }]}>{title}</Text>
          </View>
        ))}
      </Card>

      {/* Weekly trend */}
      <Card style={{ marginBottom: 14 }}>
        <SegControl options={['Screen Time','Pickups','Notifications']} selected={metric} onSelect={setMetric} />
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: 14, marginBottom: 10 }}>
          <Text style={s.muted}>Weekly Avg</Text>
          <Text style={{ color: C.white, fontWeight: '700' }}>{dur(Math.floor(screenTimeMinutes / 3))}</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'flex-end', height: 90, gap: 6, marginBottom: 8 }}>
          {BARS.weekly.map((v, i) => (
            <View key={i} style={{
              flex: 1,
              height: Math.max(90 * v, 4),
              backgroundColor: i === 6 ? C.cyan : C.blueDim,
              borderRadius: 6,
              borderTopWidth: 1,
              borderTopColor: i === 6 ? C.cyan : 'rgba(26,111,255,0.4)',
            }} />
          ))}
        </View>
        <View style={{ flexDirection:'row' }}>
          {['F','Sa','Su','M','T','W','Th'].map((d, i) => (
            <Text key={i} style={[{ flex: 1, textAlign:'center', fontSize: 11 }, i === 6 ? { color: C.cyan, fontWeight:'700' } : { color: C.muted }]}>{d}</Text>
          ))}
        </View>
      </Card>

      {/* Community */}
      <Card>
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, marginRight: 8 }}>🌍</Text>
          <SectionTitle>Community Insight</SectionTitle>
        </View>
        <Text style={[s.muted, { lineHeight: 22 }]}>
          Your screen time was <Text style={{ color: C.mint, fontWeight: '700' }}>78% lower</Text> than your peers yesterday. Keep it up!
        </Text>
      </Card>
    </ScrollView>
  );
}

// ─── Block Editor ─────────────────────────────────────────────────────────────

function BlockEditor({ visible, state, setState, onClose, onSave, onDelete }) {
  const { blockTitle, startMinutes, endMinutes, repeatRule, strictMode, isLocationBased, blockedApps } = state;
  const set = (key, val) => setState(p => ({ ...p, [key]: val }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: C.bg }}>

        {/* Nav */}
        <View style={s.modalNav}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: C.cyan, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 16 }}>Edit Block</Text>
          <TouchableOpacity onPress={onSave}>
            <Text style={{ color: C.cyan, fontSize: 16, fontWeight: '700' }}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>

          {/* Title */}
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

          {/* Apps */}
          <Label style={{ marginBottom: 8 }}>BLOCKED APPS</Label>
          <Card style={{ marginBottom: 20 }}>
            {blockedApps.map((app, i) => (
              <View key={app.id} style={[{ flexDirection:'row', alignItems:'center', paddingVertical: 10 }, i < blockedApps.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: app.color + '22', justifyContent:'center', alignItems:'center', marginRight: 12 }}>
                  <Text style={{ color: app.color, fontWeight: '800' }}>{app.icon}</Text>
                </View>
                <Text style={{ color: C.off, flex: 1 }}>{app.name}</Text>
              </View>
            ))}
          </Card>

          {/* Schedule */}
          <Label style={{ marginBottom: 8 }}>SCHEDULE</Label>
          <Card style={{ marginBottom: 20 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={s.muted}>Start at</Text>
              <Stepper value={startMinutes} onChange={v => set('startMinutes', v)} />
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 6 }}>
              <Text style={s.muted}>End at</Text>
              <Stepper value={endMinutes} onChange={v => set('endMinutes', v)} />
            </View>
          </Card>

          {/* Repeat */}
          <Label style={{ marginBottom: 8 }}>REPEAT</Label>
          <Card style={{ marginBottom: 20 }}>
            <SegControl options={['Every day','Weekdays','Weekends']} selected={repeatRule} onSelect={v => set('repeatRule', v)} />
          </Card>

          {/* Strict */}
          <Label style={{ marginBottom: 8 }}>STRICT MODE</Label>
          <Card style={{ marginBottom: 20 }}>
            <SegControl options={['Easy','Normal','Hard']} selected={strictMode} onSelect={v => set('strictMode', v)} />
            <Divider />
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <View>
                <Text style={{ color: C.off, fontWeight: '600' }}>Location Based</Text>
                <Text style={[s.muted, { fontSize: 12 }]}>Activate block at specific places</Text>
              </View>
              <Switch value={isLocationBased} onValueChange={v => set('isLocationBased', v)} trackColor={{ true: C.blue }} thumbColor={C.white} />
            </View>
          </Card>

          <TouchableOpacity style={[s.primaryBtn, { marginBottom: 12 }]} onPress={onSave}>
            <Text style={s.primaryTxt}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete}>
            <Text style={s.deleteTxt}>Delete Block</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
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
  const [toast, setToast] = useState(false);

  const save = () => {
    setShowEditor(false);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  const del = () => {
    Alert.alert('Delete Block?', 'This removes all blocked apps from this schedule.', [
      { text: 'Delete', style: 'destructive', onPress: () => { setAppState(p => ({ ...p, blockedApps: [] })); setShowEditor(false); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: s.tabBar,
            tabBarActiveTintColor: C.cyan,
            tabBarInactiveTintColor: C.dim,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
          }}
        >
          {[
            { name: 'Home',        icon: '🏠', Screen: () => <HomeScreen        state={appState} onEdit={() => setShowEditor(true)} /> },
            { name: 'Report',      icon: '📊', Screen: () => <ReportScreen      state={appState} /> },
            { name: 'Sessions',    icon: '⏱',  Screen: () => <SessionsScreen    state={appState} onEdit={() => setShowEditor(true)} /> },
            { name: 'Leaderboard', icon: '🏆', Screen: () => <LeaderboardScreen /> },
            { name: 'Profile',     icon: '😊', Screen: () => <ProfileScreen     state={appState} /> },
          ].map(({ name, icon, Screen }) => (
            <Tab.Screen
              key={name}
              name={name}
              component={Screen}
              options={{ tabBarIcon: ({ focused }) => (
                <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
              )}}
            />
          ))}
        </Tab.Navigator>

        <BlockEditor
          visible={showEditor}
          state={appState}
          setState={setAppState}
          onClose={() => setShowEditor(false)}
          onSave={save}
          onDelete={del}
        />

        {toast && (
          <View style={s.toast} pointerEvents="none">
            <Text style={{ fontSize: 16 }}>✓</Text>
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Saved</Text>
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
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  screenTitle: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  cardGlow: {
    borderColor: 'rgba(0,229,255,0.15)',
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: C.off,
    fontSize: 15,
    fontWeight: '700',
  },
  muted: {
    color: C.muted,
    fontSize: 14,
  },
  bigNum: {
    color: C.white,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginVertical: 4,
  },

  // Hero
  heroWrap: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.cyanDim,
    top: '10%',
    opacity: 0.6,
  },
  heroOrb: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  heroOrbInner: {
    alignItems: 'center',
  },
  heroTime: {
    color: C.cyan,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },

  // Stats
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statTitle: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  statSub: {
    color: C.dim,
    fontSize: 10,
    marginTop: 1,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: C.cyan,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryTxt: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  ghostTxt: {
    color: C.cyan,
    fontWeight: '700',
    fontSize: 15,
  },
  deleteBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.4)',
    backgroundColor: 'rgba(255,69,58,0.08)',
  },
  deleteTxt: {
    color: '#ff453a',
    fontWeight: '700',
    fontSize: 15,
  },
  iconBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.cyanDim,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  todayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.cyanDim,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Segments
  segWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  segOn: {
    backgroundColor: C.blue,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  segTxt: {
    color: C.muted,
    fontWeight: '600',
    fontSize: 12,
  },
  segTxtOn: {
    color: C.white,
    fontWeight: '700',
  },

  // Charts
  chartLabel: {
    color: C.muted,
    fontSize: 11,
  },

  // Stepper
  stepBtn: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  stepTxt: {
    color: C.white,
    fontSize: 20,
    lineHeight: 24,
  },
  stepVal: {
    color: C.white,
    fontWeight: '600',
    fontSize: 14,
    marginHorizontal: 12,
    minWidth: 70,
    textAlign: 'center',
  },

  // Date
  dateDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  dateDotActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  dateTxt: {
    color: C.muted,
    fontWeight: '600',
    fontSize: 13,
  },

  // Profile
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.card,
    borderWidth: 2,
    borderColor: 'rgba(0,229,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  // Modal
  modalNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  input: {
    color: C.white,
    fontSize: 15,
    paddingVertical: 8,
  },

  // Tab bar
  tabBar: {
    backgroundColor: '#08121f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,229,255,0.1)',
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 82 : 62,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,29,46,0.95)',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
});
