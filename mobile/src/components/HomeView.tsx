import { Ionicons } from '@expo/vector-icons'
import { useMemo, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { appBrandName, cardRadius, colors, fonts, space } from '../theme'
import type { DayUsage, WorkSchedule } from '../types'
import {
  awakeTimePercent,
  consistencyLabel,
  focusHoursMilestone,
  formatAvgScreenHeading,
  last7DaysUsage,
  lastFourWeekTotals,
  lastNWeekTotals,
  rankLabel,
  topPercentLabel,
  usageBarsToPaths,
} from '../utils/stats'
import { WorkTimeScheduleModal } from './WorkTimeScheduleModal'

type Active = {
  title: string
  startedAt: number
  endAt: number
  durationMinutes: number
  stopAvailableAt: number
}

const STREAK_TARGET_DAYS = 30

type AnalyticsTab = 'week' | 'month' | 'lifetime'

type Props = {
  dailyUsage: DayUsage[]
  fallbackScreenMinutes: number
  totalFocusMinutes: number
  enabledBlockCount: number
  currentStreak: number
  daysInApp: number
  weeklyFocusMinutes: number
  workSchedule: WorkSchedule
  onUpdateWorkSchedule: (next: WorkSchedule) => void
  onResetWorkSchedule: () => void
  onOpenBlockTab: () => void
  onOpenSettings: () => void
  active: Active | null
  onStopSessionEarly: () => void
  now: number
  bottomInset: number
  scrollIntroDone: boolean
  onScrollPastIntro: () => void
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatScheduleHint(s: WorkSchedule): string {
  if (s.vacationMode) return 'Vacation · schedule off'
  const fmt = (total: number) => {
    const m = ((total % 1440) + 1440) % 1440
    const h24 = Math.floor(m / 60)
    const min = m % 60
    const am = h24 < 12
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${min.toString().padStart(2, '0')} ${am ? 'AM' : 'PM'}`
  }
  return `${fmt(s.startMinutes)} – ${fmt(s.endMinutes)} · tap to edit`
}

function MiniProgress({ ratio, fill, track }: { ratio: number; fill: string; track: string }) {
  const r = Math.max(0, Math.min(1, ratio))
  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <View style={[styles.progressFill, { width: `${r * 100}%`, backgroundColor: fill }]} />
    </View>
  )
}

function AvatarMark() {
  return (
    <View style={styles.avatarRing}>
      <Ionicons name="person-outline" size={22} color={colors.muted2} />
    </View>
  )
}

export function HomeView({
  dailyUsage,
  fallbackScreenMinutes,
  totalFocusMinutes,
  enabledBlockCount,
  currentStreak,
  daysInApp,
  weeklyFocusMinutes,
  workSchedule,
  onUpdateWorkSchedule,
  onResetWorkSchedule,
  onOpenBlockTab,
  onOpenSettings,
  active,
  onStopSessionEarly,
  now,
  bottomInset,
  scrollIntroDone,
  onScrollPastIntro,
}: Props) {
  const remaining = active ? Math.max(0, active.endAt - now) : 0
  const stopInMs = active ? Math.max(0, active.stopAvailableAt - now) : 0
  const canStopEarly = active != null && now >= active.stopAvailableAt
  const [workTimeOpen, setWorkTimeOpen] = useState(false)
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('week')
  const scrollY = useRef(new Animated.Value(0)).current
  const rank = rankLabel(currentStreak)
  const topPct = topPercentLabel(currentStreak)
  const focusHours = Math.floor(totalFocusMinutes / 60)
  const hoursMilestone = focusHoursMilestone(focusHours)
  const pagesEstimate = Math.max(12, Math.round(weeklyFocusMinutes / 2))

  const chartBars = useMemo(() => {
    if (analyticsTab === 'week') return last7DaysUsage(dailyUsage, fallbackScreenMinutes)
    if (analyticsTab === 'month') return lastFourWeekTotals(dailyUsage, fallbackScreenMinutes)
    return lastNWeekTotals(dailyUsage, 12, fallbackScreenMinutes)
  }, [analyticsTab, dailyUsage, fallbackScreenMinutes])

  const avgDailyScreen = useMemo(() => {
    const sum = chartBars.reduce((s, b) => s + b.minutes, 0)
    if (analyticsTab === 'week') return sum / 7
    if (analyticsTab === 'month') return sum / 28
    return sum / 84
  }, [chartBars, analyticsTab])

  const { lineD, areaD } = useMemo(() => usageBarsToPaths(chartBars), [chartBars])
  const awakePct = awakeTimePercent(avgDailyScreen)

  const chartFooter =
    analyticsTab === 'week'
      ? 'Last 7 Days'
      : analyticsTab === 'month'
        ? 'Last 4 Weeks'
        : 'Last 12 Weeks'

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (!scrollIntroDone && e.nativeEvent.contentOffset.y > 72) {
        onScrollPastIntro()
      }
    },
  })

  const lowerRevealOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0.96, 1],
    extrapolate: 'clamp',
  })
  const lowerRevealY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const scrollPadBottom = bottomInset + space.bottomNav + 28

  return (
    <View style={styles.wrap}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollPadBottom }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.kickerRow}>
          <Text style={styles.pageKicker}>Home</Text>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.profileLeft}>
            <AvatarMark />
            <View style={styles.profileTextCol}>
              <Text style={styles.displayName} numberOfLines={1}>
                {appBrandName}
              </Text>
              <Text style={styles.profileMeta} numberOfLines={1}>
                {topPct} · {rank.title}
              </Text>
            </View>
          </View>
          <View style={styles.profileActions}>
            <Pressable onPress={onOpenSettings} hitSlop={10} style={styles.iconHit}>
              <Ionicons name="settings-outline" size={22} color={colors.muted2} />
            </Pressable>
            <Pressable hitSlop={10} style={styles.iconHit}>
              <Ionicons name="share-outline" size={20} color={colors.muted3} />
            </Pressable>
          </View>
        </View>

        {active ? (
          <View style={[styles.activeCard, styles.minCard]}>
            <Text style={styles.activeKicker}>Active session</Text>
            <Text style={styles.activeTitle}>{active.title}</Text>
            <Text style={styles.activeTimer}>{formatCountdown(remaining)}</Text>
            <Text style={styles.activeBody}>
              {enabledBlockCount} apps on your block list for this run. Limits still use Screen Time /
              Focus on device.
            </Text>
            {!canStopEarly ? (
              <Text style={styles.stopWait}>End unlocks in {Math.ceil(stopInMs / 1000)}s…</Text>
            ) : (
              <Pressable
                onPress={onStopSessionEarly}
                style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.endBtnText}>End session early</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.minCard]}>
            <Text style={styles.statKicker}>Streak</Text>
            <Text style={styles.statFigure}>{String(currentStreak).padStart(2, '0')}</Text>
            <Text style={styles.statUnit}>days</Text>
            <View style={styles.statDivider} />
            <Text style={styles.statTierName}>{rank.title}</Text>
            <MiniProgress
              ratio={currentStreak / STREAK_TARGET_DAYS}
              fill="rgba(255,255,255,0.45)"
              track={colors.outline}
            />
            <Text style={styles.statTierMeta}>
              {currentStreak}/{STREAK_TARGET_DAYS} days
            </Text>
          </View>

          <View style={[styles.statCard, styles.minCard]}>
            <Text style={styles.statKicker}>Focus</Text>
            <Text style={styles.statFigure}>{focusHours}</Text>
            <Text style={styles.statUnit}>hours</Text>
            <View style={styles.statDivider} />
            <Text style={styles.statTierName}>{hoursMilestone.label}</Text>
            <MiniProgress
              ratio={hoursMilestone.current / hoursMilestone.target}
              fill="rgba(255,255,255,0.45)"
              track={colors.outline}
            />
            <Text style={styles.statTierMeta}>
              {hoursMilestone.current}/{hoursMilestone.target} hours
            </Text>
          </View>
        </View>

        <View style={[styles.analyticsCard, styles.minCard]}>
          <View style={styles.analyticsTabs}>
            {(['week', 'month', 'lifetime'] as const).map((t) => {
              const on = analyticsTab === t
              const label = t === 'week' ? 'Week' : t === 'month' ? 'Month' : 'Lifetime'
              return (
                <Pressable
                  key={t}
                  onPress={() => setAnalyticsTab(t)}
                  style={[styles.analyticsTab, on && styles.analyticsTabOn]}
                >
                  <Text style={[styles.analyticsTabText, on && styles.analyticsTabTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.analyticsHead}>
            <View>
              <Text style={styles.analyticsBig}>{formatAvgScreenHeading(avgDailyScreen)}</Text>
              <Text style={styles.analyticsSub}>Avg Screen Time</Text>
            </View>
            <View style={styles.awakeCol}>
              <Text style={styles.awakeLabel}>AWAKE TIME</Text>
              <Text style={styles.awakePct}>{awakePct}%</Text>
            </View>
          </View>
          <View style={styles.chartWrap}>
            <Svg width="100%" height={120} viewBox="0 0 400 100" preserveAspectRatio="none">
              {areaD ? <Path d={areaD} fill="rgba(255,255,255,0.04)" /> : null}
              <Path
                d={lineD}
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={styles.chartAxis}>
            {chartBars.map((b) => (
              <Text key={b.key} style={styles.chartTick}>
                {b.label}
              </Text>
            ))}
          </View>
          <View style={styles.chartFooter}>
            <Ionicons name="chevron-back" size={18} color={colors.muted3} />
            <Text style={styles.chartFooterText}>{chartFooter}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted3} />
          </View>
        </View>

        <View style={[styles.heroCard, styles.minCard]}>
          <Text style={styles.heroLine}>
            <Text style={styles.heroEm}>You could've read </Text>
            <Text style={styles.heroBold}>{pagesEstimate} pages</Text>
            <Text style={styles.heroEm}> of a book</Text>
          </Text>
          <Text style={styles.heroSub}>This week from your focus minutes — {consistencyLabel(currentStreak)} consistency.</Text>
          <Text style={styles.heroFoot}>
            {daysInApp} {daysInApp === 1 ? 'day' : 'days'} in app
          </Text>
        </View>

        <Animated.View
          style={{
            opacity: lowerRevealOpacity,
            transform: [{ translateY: lowerRevealY }],
          }}
        >
          <Pressable
            onPress={() => setWorkTimeOpen(true)}
            style={({ pressed }) => [styles.workTimeRow, styles.minCard, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.workTimeLeft}>
              <Ionicons name="laptop-outline" size={20} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.workTimeTitle}>Work Time</Text>
                <Text style={styles.workTimeHint}>{formatScheduleHint(workSchedule)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted2} />
          </Pressable>
        </Animated.View>
      </Animated.ScrollView>

      <WorkTimeScheduleModal
        visible={workTimeOpen}
        schedule={workSchedule}
        onClose={() => setWorkTimeOpen(false)}
        onSave={onUpdateWorkSchedule}
        onOpenBlockList={() => {
          setWorkTimeOpen(false)
          onOpenBlockTab()
        }}
        onResetToDefault={onResetWorkSchedule}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    maxWidth: 672,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.container,
    paddingTop: 12,
  },
  minCard: {
    borderRadius: cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    backgroundColor: 'transparent',
  },
  kickerRow: { marginBottom: 20 },
  pageKicker: {
    ...fonts.semibold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTextCol: { flex: 1, minWidth: 0, gap: 6 },
  displayName: {
    ...fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.text,
  },
  profileMeta: {
    ...fonts.regular,
    fontSize: 13,
    color: colors.muted2,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: { padding: 8 },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  statKicker: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statFigure: {
    ...fonts.light,
    fontSize: 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 2,
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outline,
    marginVertical: 12,
  },
  statTierName: {
    ...fonts.medium,
    fontSize: 14,
    color: colors.muted2,
    marginBottom: 8,
  },
  statTierMeta: {
    ...fonts.regular,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.muted3,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  analyticsCard: {
    padding: 18,
    marginBottom: 16,
  },
  analyticsTabs: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    paddingBottom: 10,
  },
  analyticsTab: {
    paddingVertical: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -10,
  },
  analyticsTabOn: {
    borderBottomColor: colors.text,
  },
  analyticsTabText: {
    ...fonts.medium,
    fontSize: 13,
    color: colors.muted2,
  },
  analyticsTabTextOn: {
    color: colors.text,
  },
  analyticsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  analyticsBig: {
    ...fonts.light,
    fontSize: 28,
    color: colors.text,
    letterSpacing: -0.5,
  },
  analyticsSub: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
  },
  awakeCol: { alignItems: 'flex-end' },
  awakeLabel: {
    ...fonts.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
  },
  awakePct: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  chartWrap: {
    marginTop: 8,
    height: 120,
    marginHorizontal: -4,
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 0,
    gap: 2,
  },
  chartTick: {
    ...fonts.medium,
    fontSize: 9,
    color: colors.muted3,
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  chartFooterText: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted3,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroCard: {
    padding: 18,
    marginBottom: 20,
  },
  heroLine: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted2,
  },
  heroEm: { color: colors.muted2 },
  heroBold: {
    ...fonts.bold,
    color: colors.text,
  },
  heroSub: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 8,
  },
  heroFoot: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted3,
    marginTop: 10,
  },
  workTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 20,
  },
  workTimeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  workTimeTitle: {
    ...fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  workTimeHint: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  activeCard: {
    padding: 20,
    marginBottom: 20,
  },
  activeKicker: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  activeTitle: {
    ...fonts.bold,
    fontSize: 24,
    color: colors.text,
    marginTop: 8,
  },
  activeTimer: {
    ...fonts.light,
    fontSize: 56,
    marginTop: 12,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  activeBody: {
    marginTop: 12,
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  stopWait: {
    marginTop: 16,
    ...fonts.medium,
    fontSize: 14,
    color: colors.muted2,
  },
  endBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  endBtnText: {
    ...fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
})
