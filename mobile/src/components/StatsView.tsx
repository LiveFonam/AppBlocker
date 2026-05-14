import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { PersistedState } from '../types'
import { appBrandName, cardRadius, colors, fonts, space } from '../theme'
import {
  awakeTimePercent,
  focusTrendPercent,
  focusTrendPath,
  formatAvgScreenHeading,
  formatSessionWhen,
  last7DaysUsage,
  lastFourWeekTotals,
  lastNWeekTotals,
  sortSessionsRecent,
  todayMinutes,
  usageBarsToPaths,
  weekOverWeekReductionLabel,
} from '../utils/stats'

type AnalyticsTab = 'week' | 'month' | 'lifetime'

type Props = {
  data: PersistedState
  onOpenSettings: () => void
  bottomInset: number
}

function AvatarMark() {
  return (
    <View style={styles.avatarRing}>
      <Ionicons name="person-outline" size={22} color={colors.muted2} />
    </View>
  )
}

export function StatsView({ data, onOpenSettings, bottomInset }: Props) {
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('week')
  const fallback = data.profile.reportedDailyPhoneMinutes || 180

  const trendPct = focusTrendPercent(data.dailyFocusMinutes)
  const trendPathD = focusTrendPath(data.dailyFocusMinutes)
  const reduction = weekOverWeekReductionLabel(data.dailyUsage, fallback)
  const today = todayMinutes(data.dailyUsage, fallback)
  const attempts = data.blockAttempts
  const failed = data.blockFailed
  const successRate =
    attempts === 0 ? 100 : Math.round(((attempts - failed) / attempts) * 100)
  const sessions = sortSessionsRecent(data.sessions).slice(0, 12)

  const chartBars = useMemo(() => {
    if (analyticsTab === 'week') return last7DaysUsage(data.dailyUsage, fallback)
    if (analyticsTab === 'month') return lastFourWeekTotals(data.dailyUsage, fallback)
    return lastNWeekTotals(data.dailyUsage, 12, fallback)
  }, [analyticsTab, data.dailyUsage, fallback])

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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + space.bottomNav + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.pageKicker}>Statistics</Text>
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.profileLeft}>
          <AvatarMark />
          <View style={styles.profileTextCol}>
            <Text style={styles.displayName} numberOfLines={1}>
              {appBrandName}
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

      <View style={[styles.subCard, styles.minCard]}>
        <View style={styles.subCardHead}>
          <Text style={styles.subCardKicker}>Today (estimate)</Text>
          <Text style={styles.subCardStat}>{Math.round(today)} min</Text>
          <Text style={styles.subCardHint}>Match Screen Time in Settings if needed.</Text>
        </View>
        <View style={styles.subCardDivider} />
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.subCardKicker}>Vs prior week</Text>
            <Text style={styles.reductionMeta}>Screen time estimate</Text>
          </View>
          <Text style={styles.reduction}>{reduction}</Text>
        </View>
      </View>

      <View style={[styles.trendCard, styles.minCard]}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionLabel}>Focus trend</Text>
          <Text style={styles.trendPct}>
            {trendPct >= 0 ? '+' : ''}
            {trendPct}%
          </Text>
        </View>
        <View style={styles.trendChartWrap}>
          <Svg width="100%" height={72} viewBox="0 0 400 100" preserveAspectRatio="none">
            <Path
              d={trendPathD}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      <View style={[styles.successCard, styles.minCard]}>
        <Text style={styles.sectionLabel}>Block attempts</Text>
        <View style={styles.successMid}>
          <Text style={styles.successBig}>{successRate}%</Text>
          <Text style={styles.successCaption}>success rate</Text>
        </View>
        <View style={styles.successGrid}>
          <View>
            <Text style={styles.metaUpper}>Attempts</Text>
            <Text style={styles.metaNum}>{attempts}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaUpper}>Failed</Text>
            <Text style={styles.metaNum}>{failed}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.logCard, styles.minCard]}>
        <Text style={styles.sectionTitle}>Session log</Text>
        {sessions.length === 0 ? (
          <Text style={styles.emptyLog}>No sessions yet.</Text>
        ) : (
          sessions.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.logRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.outline,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.logName}>{s.title}</Text>
                <Text style={styles.logWhen}>{formatSessionWhen(s.startedAt)}</Text>
              </View>
              <Text style={styles.logDur}>{s.durationMinutes}m</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
  profileTextCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  displayName: {
    ...fonts.bold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.text,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: { padding: 8 },
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
  subCard: {
    padding: 18,
    marginBottom: 16,
    gap: 16,
  },
  subCardHead: { gap: 6 },
  subCardKicker: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  subCardStat: {
    ...fonts.light,
    fontSize: 28,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  subCardHint: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted2,
    lineHeight: 18,
    marginTop: 4,
  },
  subCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outline,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reduction: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  reductionMeta: {
    ...fonts.regular,
    fontSize: 11,
    color: colors.muted3,
    marginTop: 4,
  },
  trendCard: {
    padding: 18,
    marginBottom: 16,
  },
  sectionLabel: {
    ...fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  trendPct: {
    ...fonts.medium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  trendChartWrap: {
    marginTop: 16,
    height: 72,
  },
  successCard: {
    padding: 18,
    marginBottom: 16,
    gap: 16,
  },
  successMid: {
    paddingVertical: 8,
  },
  successBig: {
    ...fonts.light,
    fontSize: 36,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  successCaption: {
    ...fonts.regular,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 4,
  },
  successGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  metaUpper: {
    ...fonts.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  metaNum: {
    ...fonts.medium,
    fontSize: 18,
    color: colors.text,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  logCard: {
    padding: 18,
    marginBottom: 24,
  },
  sectionTitle: {
    ...fonts.bold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.text,
    marginBottom: 8,
  },
  emptyLog: {
    ...fonts.regular,
    fontSize: 14,
    color: colors.muted2,
    paddingVertical: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  logName: {
    ...fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  logWhen: {
    marginTop: 4,
    ...fonts.regular,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  logDur: {
    ...fonts.medium,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
})
