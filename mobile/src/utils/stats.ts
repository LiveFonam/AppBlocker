import type { DayUsage, SessionEntry } from '../types'

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatSessionWhen(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const t0 = dateKey(today)
  const y0 = dateKey(yesterday)
  const k = dateKey(d)
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  if (k === t0) return `Today · ${time}`
  if (k === y0) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function weekdayInitial(d: Date): string {
  const initials = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return initials[d.getDay()]
}

export type DayBar = {
  key: string
  label: string
  minutes: number
  isToday: boolean
}

export function lastNDaysUsage(
  daily: DayUsage[],
  n: number,
  fallbackMinutes: number,
): DayBar[] {
  const map = new Map(daily.map((x) => [x.date, x.minutes]))
  const out: DayBar[] = []
  const todayKey = dateKey(new Date())
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    out.push({
      key,
      label: weekdayInitial(d),
      minutes: map.get(key) ?? fallbackMinutes,
      isToday: key === todayKey,
    })
  }
  return out
}

export function last7DaysUsage(
  daily: DayUsage[],
  fallbackMinutes: number,
): DayBar[] {
  return lastNDaysUsage(daily, 7, fallbackMinutes)
}

/** Rolling `weekCount` weeks, oldest → newest. Each bar is 7 days of screen-estimate minutes. */
export function lastNWeekTotals(
  daily: DayUsage[],
  weekCount: number,
  fallbackMinutes: number,
): DayBar[] {
  const map = new Map(daily.map((x) => [x.date, x.minutes]))
  const out: DayBar[] = []
  for (let wi = 0; wi < weekCount; wi++) {
    let sum = 0
    for (let d = 0; d < 7; d++) {
      const offset = (weekCount - 1 - wi) * 7 + d
      const dt = new Date()
      dt.setHours(12, 0, 0, 0)
      dt.setDate(dt.getDate() - offset)
      sum += map.get(dateKey(dt)) ?? fallbackMinutes
    }
    out.push({
      key: `wk${wi}`,
      label: `${wi + 1}`,
      minutes: sum,
      isToday: wi === weekCount - 1,
    })
  }
  return out
}

export function lastFourWeekTotals(
  daily: DayUsage[],
  fallbackMinutes: number,
): DayBar[] {
  const map = new Map(daily.map((x) => [x.date, x.minutes]))
  const out: DayBar[] = []
  for (let wi = 0; wi < 4; wi++) {
    let sum = 0
    for (let d = 0; d < 7; d++) {
      const offset = 27 - wi * 7 - d
      const dt = new Date()
      dt.setHours(12, 0, 0, 0)
      dt.setDate(dt.getDate() - offset)
      const k = dateKey(dt)
      sum += map.get(k) ?? fallbackMinutes
    }
    out.push({
      key: `w${wi}`,
      label: `${wi + 1}`,
      minutes: sum,
      isToday: wi === 3,
    })
  }
  return out
}

export function maxMinutes(bars: { minutes: number }[]): number {
  const m = Math.max(0, ...bars.map((b) => b.minutes))
  return Math.max(1, m)
}

export function computeStreak(daily: DayUsage[]): number {
  const map = new Map(daily.map((d) => [d.date, d.minutes]))
  const todayKey = dateKey(new Date())
  const start = new Date()
  start.setHours(12, 0, 0, 0)
  if ((map.get(todayKey) ?? 0) === 0) {
    start.setDate(start.getDate() - 1)
  }
  let streak = 0
  const cursor = new Date(start)
  for (;;) {
    const k = dateKey(cursor)
    if ((map.get(k) ?? 0) > 0) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export function todayMinutes(
  daily: DayUsage[],
  fallbackMinutes: number,
): number {
  const k = dateKey(new Date())
  return daily.find((d) => d.date === k)?.minutes ?? fallbackMinutes
}

export function addOrMergeDaily(
  daily: DayUsage[],
  date: string,
  addMinutes: number,
): DayUsage[] {
  const next = daily.map((d) => ({ ...d }))
  const i = next.findIndex((d) => d.date === date)
  if (i === -1) next.push({ date, minutes: addMinutes })
  else next[i] = { date, minutes: next[i].minutes + addMinutes }
  return next
}

export function focusTrendPercent(daily: DayUsage[]): number {
  if (daily.length < 4) return 12
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const half = Math.floor(sorted.length / 2)
  const a = sorted.slice(0, half)
  const b = sorted.slice(half)
  const avg = (xs: DayUsage[]) =>
    xs.reduce((s, x) => s + x.minutes, 0) / Math.max(1, xs.length)
  const prev = avg(a)
  const cur = avg(b)
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function sumMinutesForLastDays(
  daily: DayUsage[],
  startOffset: number,
  fallback: number,
): number {
  const map = new Map(daily.map((x) => [x.date, x.minutes]))
  let s = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - (startOffset + i))
    const k = dateKey(d)
    s += map.get(k) ?? fallback
  }
  return s
}

export function weekOverWeekReductionLabel(
  daily: DayUsage[],
  fallbackMinutes: number,
): string {
  const thisWeek = sumMinutesForLastDays(daily, 0, fallbackMinutes)
  const lastWeek = sumMinutesForLastDays(daily, 7, fallbackMinutes)
  if (lastWeek === 0) return '-42%'
  const pct = Math.round(((lastWeek - thisWeek) / lastWeek) * 100)
  if (pct > 0) return `-${pct}%`
  if (pct < 0) return `+${Math.abs(pct)}%`
  return '0%'
}

export function focusTrendPath(daily: DayUsage[]): string {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
  if (sorted.length < 2)
    return 'M0,80 L50,60 L100,70 L150,30 L200,40 L250,10 L300,50 L350,20 L400,30'
  const max = Math.max(1, ...sorted.map((d) => d.minutes))
  const n = sorted.length
  const pts = sorted.map((d, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * 400
    const y = 100 - (d.minutes / max) * 85 - 8
    return `${x},${y}`
  })
  return 'M' + pts.join(' L')
}

export type TrendPoint = {
  x: number
  y: number
  date: string
  minutes: number
}

/** Points in viewBox 0–400 × 0–100 for scrubbing / tooltips. */
export function focusTrendSeries(daily: DayUsage[]): TrendPoint[] {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date)).slice(-8)
  if (sorted.length === 0) {
    return [{ x: 0, y: 92, date: '', minutes: 0 }]
  }
  const max = Math.max(1, ...sorted.map((d) => d.minutes))
  const n = sorted.length
  return sorted.map((d, i) => {
    const x = n === 1 ? 200 : (i / Math.max(1, n - 1)) * 400
    const y = 100 - (d.minutes / max) * 85 - 8
    return { x, y, date: d.date, minutes: d.minutes }
  })
}

export function formatDurationMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

/** Gamified “Top X%” badge from streak (illustrative). */
export function topPercentLabel(streak: number): string {
  if (streak >= 14) return 'Top 1%'
  if (streak >= 7) return 'Top 5%'
  if (streak >= 3) return 'Top 30%'
  return 'Top 60%'
}

export function usageBarsToPaths(bars: { minutes: number }[]): {
  lineD: string
  areaD: string
} {
  if (bars.length === 0) {
    return { lineD: 'M0,88 L400,88', areaD: '' }
  }
  const max = Math.max(1, ...bars.map((b) => b.minutes))
  const n = bars.length
  const pts = bars.map((b, i) => {
    const x = n === 1 ? 200 : (i / (n - 1)) * 400
    const y = 100 - (b.minutes / max) * 72 - 14
    return { x, y }
  })
  const lineD = 'M' + pts.map((p) => `${p.x},${p.y}`).join(' L')
  const areaD = `${lineD} L${pts[pts.length - 1].x},100 L${pts[0].x},100 Z`
  return { lineD, areaD }
}

/** Next focus-hours tier toward a long-run goal (for progress UI). */
export function focusHoursMilestone(focusHours: number): {
  label: string
  current: number
  target: number
} {
  const tiers = [
    { t: 30, label: 'Emerging' },
    { t: 60, label: 'Solid' },
    { t: 100, label: 'Diligent' },
    { t: 200, label: 'Elite' },
  ]
  for (const tier of tiers) {
    if (focusHours < tier.t) {
      return { label: tier.label, current: focusHours, target: tier.t }
    }
  }
  const cap = Math.max(200, focusHours)
  return { label: 'Elite', current: focusHours, target: cap }
}

const AWAKE_MINUTES_DEFAULT = 16 * 60

export function awakeTimePercent(avgDailyScreenMinutes: number): number {
  if (avgDailyScreenMinutes <= 0) return 0
  return Math.min(100, Math.round((avgDailyScreenMinutes / AWAKE_MINUTES_DEFAULT) * 100))
}

export function formatAvgScreenHeading(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m} mins`
  if (m === 0) return `${h} ${h === 1 ? 'hr' : 'hrs'}`
  return `${h} ${h === 1 ? 'hr' : 'hrs'}, ${m.toString().padStart(2, '0')} mins`
}

export function rankLabel(streak: number): { title: string; subtitle: string } {
  if (streak >= 14)
    return { title: 'Elite', subtitle: 'Top 1% Worldwide' }
  if (streak >= 7)
    return { title: 'Dedicated', subtitle: 'Top 5% Worldwide' }
  if (streak >= 3)
    return { title: 'Rising', subtitle: 'Building momentum' }
  return { title: 'Novice', subtitle: 'Keep showing up' }
}

export function consistencyLabel(streak: number): string {
  if (streak >= 10) return 'High'
  if (streak >= 4) return 'Medium'
  return 'Growing'
}

export function sortSessionsRecent(sessions: SessionEntry[]): SessionEntry[] {
  return [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}
