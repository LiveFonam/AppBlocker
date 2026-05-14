export type TabId = 'home' | 'block' | 'stats' | 'settings'

export interface UserProfile {
  mainObjective: string
  longTermGoals: string
  shortTermGoals: string
  /** Typical phone / screen time, minutes per day (from setup). */
  reportedDailyPhoneMinutes: number
  /** Age used for life projection; null = use default curve. */
  age: number | null
  setupComplete: boolean
  /** Set true only in finishSetupPatch — source of truth for showing the main app. */
  onboardingDone: boolean
  /** ISO date when setup finished — used for “days in app” on Home. */
  setupCompletedAt: string | null
  /** After first scroll intro, skip heavy animations. */
  hasSeenMainScrollIntro: boolean
}

export interface BlockTarget {
  id: string
  name: string
  enabled: boolean
}

export interface SessionEntry {
  id: string
  title: string
  startedAt: string
  durationMinutes: number
}

export interface DayUsage {
  date: string
  minutes: number
}

/** Scheduled “Work Time” window (visual + reminders; blocking is still system-level). */
export interface WorkSchedule {
  /** Minutes from midnight (0–1439). */
  startMinutes: number
  endMinutes: number
  /** Index 0 = Monday … 6 = Sunday. */
  daysActive: boolean[]
  breaksAllowed: boolean
  vacationMode: boolean
}

export interface PersistedState {
  profile: UserProfile
  targets: BlockTarget[]
  sessions: SessionEntry[]
  /** Estimated phone / screen time minutes per calendar day (match Screen Time in Settings). */
  dailyUsage: DayUsage[]
  /** Focus time completed (minutes) per calendar day from sessions. */
  dailyFocusMinutes: DayUsage[]
  blockAttempts: number
  blockFailed: number
  workSchedule: WorkSchedule
}
