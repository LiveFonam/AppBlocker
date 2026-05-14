import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomNav } from './src/components/BottomNav'
import { BlockView } from './src/components/BlockView'
import { HomeView } from './src/components/HomeView'
import { SettingsView } from './src/components/SettingsView'
import { StatsView } from './src/components/StatsView'
import {
  defaultWorkSchedule,
  loadPersisted,
  resetPersisted,
  savePersisted,
} from './src/storage'
import { colors } from './src/theme'
import type { DayUsage, PersistedState, TabId } from './src/types'
import { addOrMergeDaily, computeStreak, dateKey } from './src/utils/stats'
import { daysInAppSince } from './src/utils/time'

const STOP_SESSION_DELAY_MS = 20_000

type ActiveSession = {
  id: string
  title: string
  startedAt: number
  endAt: number
  durationMinutes: number
  stopAvailableAt: number
}

function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function focusMinutesLastNDays(daily: DayUsage[], n: number): number {
  const keys = new Set<string>()
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    keys.add(dateKey(d))
  }
  return daily.filter((x) => keys.has(x.date)).reduce((s, x) => s + x.minutes, 0)
}

function totalFocusMinutesRecorded(daily: DayUsage[]): number {
  return daily.reduce((s, x) => s + x.minutes, 0)
}

type Props = {
  onReplaySetup: () => void
}

export default function Shell({ onReplaySetup }: Props) {
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<TabId>('home')
  const [data, setData] = useState<PersistedState | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const lastCompletedId = useRef<string | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    loadPersisted().then(setData)
  }, [])

  useEffect(() => {
    if (!data) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    savePersisted(data)
  }, [data])

  useEffect(() => {
    if (!activeSession) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeSession])

  useEffect(() => {
    if (!activeSession || now < activeSession.endAt) return
    if (lastCompletedId.current === activeSession.id) return
    lastCompletedId.current = activeSession.id
    const done = activeSession
    setActiveSession(null)
    setData((d) => {
      if (!d) return d
      return {
        ...d,
        sessions: [
          {
            id: randomId(),
            title: done.title,
            startedAt: new Date(done.startedAt).toISOString(),
            durationMinutes: done.durationMinutes,
          },
          ...d.sessions,
        ],
        dailyFocusMinutes: addOrMergeDaily(
          d.dailyFocusMinutes,
          dateKey(new Date()),
          done.durationMinutes,
        ),
      }
    })
  }, [activeSession, now])

  if (!data) {
    return <View style={styles.boot} />
  }

  const enabledBlockCount = data.targets.filter((t) => t.enabled).length
  const weeklyFocusMinutes = focusMinutesLastNDays(data.dailyFocusMinutes, 7)
  const totalFocusMins = totalFocusMinutesRecorded(data.dailyFocusMinutes)
  const bottomInset = insets.bottom

  return (
    <View style={styles.root}>
      <View style={[styles.main, { paddingTop: insets.top }]}>
        {tab === 'home' && (
          <HomeView
            enabledBlockCount={enabledBlockCount}
            dailyUsage={data.dailyUsage}
            fallbackScreenMinutes={data.profile.reportedDailyPhoneMinutes}
            totalFocusMinutes={totalFocusMins}
            currentStreak={computeStreak(data.dailyFocusMinutes)}
            daysInApp={daysInAppSince(data.profile.setupCompletedAt)}
            weeklyFocusMinutes={weeklyFocusMinutes}
            workSchedule={data.workSchedule}
            onUpdateWorkSchedule={(next) =>
              setData((d) => (d ? { ...d, workSchedule: next } : d))
            }
            onResetWorkSchedule={() =>
              setData((d) => (d ? { ...d, workSchedule: defaultWorkSchedule() } : d))
            }
            onOpenBlockTab={() => setTab('block')}
            onOpenSettings={() => setTab('settings')}
            scrollIntroDone={data.profile.hasSeenMainScrollIntro === true}
            onScrollPastIntro={() =>
              setData((d) =>
                d
                  ? { ...d, profile: { ...d.profile, hasSeenMainScrollIntro: true } }
                  : d,
              )
            }
            active={activeSession}
            now={now}
            bottomInset={bottomInset}
            onStopSessionEarly={() => {
              const cur = activeSession
              if (!cur) return
              const t = Date.now()
              if (t < cur.stopAvailableAt) return
              if (lastCompletedId.current === cur.id) return
              lastCompletedId.current = cur.id
              const elapsedMs = t - cur.startedAt
              const partialMinutes = Math.max(
                1,
                Math.min(cur.durationMinutes, Math.ceil(elapsedMs / 60_000)),
              )
              setActiveSession(null)
              setData((d) => {
                if (!d) return d
                return {
                  ...d,
                  sessions: [
                    {
                      id: randomId(),
                      title: cur.title,
                      startedAt: new Date(cur.startedAt).toISOString(),
                      durationMinutes: partialMinutes,
                    },
                    ...d.sessions,
                  ],
                  dailyFocusMinutes: addOrMergeDaily(
                    d.dailyFocusMinutes,
                    dateKey(new Date()),
                    partialMinutes,
                  ),
                }
              })
            }}
          />
        )}
        {tab === 'block' && (
          <BlockView
            targets={data.targets}
            enabledBlockCount={enabledBlockCount}
            active={activeSession}
            now={now}
            bottomInset={bottomInset}
            onToggle={(id) =>
              setData((d) =>
                d
                  ? {
                      ...d,
                      targets: d.targets.map((x) =>
                        x.id === id ? { ...x, enabled: !x.enabled } : x,
                      ),
                    }
                  : d,
              )
            }
            onAdd={(name) =>
              setData((d) => {
                if (!d) return d
                const key = name.trim().toLowerCase()
                if (!key) return d
                if (d.targets.some((t) => t.name.trim().toLowerCase() === key)) return d
                return {
                  ...d,
                  targets: [...d.targets, { id: randomId(), name: name.trim(), enabled: true }],
                }
              })
            }
            onStartSession={(minutes, title) => {
              const t = Date.now()
              setNow(t)
              setActiveSession({
                id: randomId(),
                title,
                startedAt: t,
                endAt: t + minutes * 60_000,
                durationMinutes: minutes,
                stopAvailableAt: t + STOP_SESSION_DELAY_MS,
              })
            }}
            onStopSessionEarly={() => {
              const cur = activeSession
              if (!cur) return
              const t = Date.now()
              if (t < cur.stopAvailableAt) return
              if (lastCompletedId.current === cur.id) return
              lastCompletedId.current = cur.id
              const elapsedMs = t - cur.startedAt
              const partialMinutes = Math.max(
                1,
                Math.min(cur.durationMinutes, Math.ceil(elapsedMs / 60_000)),
              )
              setActiveSession(null)
              setData((d) => {
                if (!d) return d
                return {
                  ...d,
                  sessions: [
                    {
                      id: randomId(),
                      title: cur.title,
                      startedAt: new Date(cur.startedAt).toISOString(),
                      durationMinutes: partialMinutes,
                    },
                    ...d.sessions,
                  ],
                  dailyFocusMinutes: addOrMergeDaily(
                    d.dailyFocusMinutes,
                    dateKey(new Date()),
                    partialMinutes,
                  ),
                }
              })
            }}
          />
        )}
        {tab === 'stats' && (
          <StatsView
            data={data}
            bottomInset={bottomInset}
            onOpenSettings={() => setTab('settings')}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            data={data}
            bottomInset={bottomInset}
            onUpdate={(next) => setData(next)}
            onReset={() => {
              resetPersisted().then((fresh) => {
                setData(fresh)
                setActiveSession(null)
              })
            }}
            onReplaySetup={onReplaySetup}
          />
        )}
      </View>
      <BottomNav active={tab} onChange={setTab} />
    </View>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  main: {
    flex: 1,
  },
})
