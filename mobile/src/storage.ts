import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  DayUsage,
  PersistedState,
  SessionEntry,
  UserProfile,
  WorkSchedule,
} from './types'
import { dateKey } from './utils/stats'

/** Bump when persisted shape changes so dev installs don’t keep broken onboarding flags. */
const STORAGE_KEY = 'austerity-focus-v2'

function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function defaultProfile(incomplete: boolean): UserProfile {
  return {
    mainObjective: '',
    longTermGoals: '',
    shortTermGoals: '',
    reportedDailyPhoneMinutes: incomplete ? 0 : 180,
    age: null,
    setupComplete: !incomplete,
    onboardingDone: !incomplete,
    setupCompletedAt: incomplete ? null : new Date().toISOString(),
    hasSeenMainScrollIntro: false,
  }
}

/** Flat daily screen estimate for the last `dayCount` days (inclusive of today). */
export function seedScreenTimeFromReport(
  minutes: number,
  dayCount: number,
): DayUsage[] {
  const out: DayUsage[] = []
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    out.push({ date: dateKey(d), minutes })
  }
  return out
}

export function defaultWorkSchedule(): WorkSchedule {
  return {
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    daysActive: [true, true, true, true, true, false, false],
    breaksAllowed: true,
    vacationMode: false,
  }
}

function defaultTargets() {
  return [
    { id: 'ig', name: 'Instagram', enabled: true },
    { id: 'tt', name: 'TikTok', enabled: true },
    { id: 'x', name: 'X (Twitter)', enabled: true },
    { id: 'rd', name: 'Reddit', enabled: false },
    { id: 'yt', name: 'YouTube', enabled: true },
    { id: 'disc', name: 'Discord', enabled: false },
  ]
}

/** First launch: no demo data until setup finishes. */
export function buildMinimalState(): PersistedState {
  return {
    profile: {
      ...defaultProfile(true),
      setupComplete: false,
      onboardingDone: false,
      setupCompletedAt: null,
      hasSeenMainScrollIntro: false,
    },
    targets: [],
    sessions: [],
    dailyUsage: [],
    dailyFocusMinutes: [],
    blockAttempts: 0,
    blockFailed: 0,
    workSchedule: defaultWorkSchedule(),
  }
}

function seedSessions(): SessionEntry[] {
  const mk = (h: number, min: number, dayOffset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - dayOffset)
    d.setHours(h, min, 0, 0)
    return d.toISOString()
  }
  return [
    {
      id: randomId(),
      title: 'Deep Work Session',
      startedAt: mk(9, 0, 0),
      durationMinutes: 150,
    },
    {
      id: randomId(),
      title: 'Morning Lockout',
      startedAt: mk(6, 0, 0),
      durationMinutes: 150,
    },
    {
      id: randomId(),
      title: 'Reading Mode',
      startedAt: mk(20, 30, 1),
      durationMinutes: 45,
    },
  ]
}

/** After reset from Settings: demo data + setup skipped (power users). */
export function buildResetDemoState(): PersistedState {
  const mins = 180
  return {
    profile: {
      ...defaultProfile(false),
      reportedDailyPhoneMinutes: mins,
      onboardingDone: true,
      hasSeenMainScrollIntro: true,
    },
    targets: defaultTargets(),
    sessions: seedSessions(),
    dailyUsage: seedScreenTimeFromReport(mins, 35),
    dailyFocusMinutes: [],
    blockAttempts: 142,
    blockFailed: 0,
    workSchedule: defaultWorkSchedule(),
  }
}

function migrate(raw: Record<string, unknown>): PersistedState {
  const minimal = buildMinimalState()
  const p = raw.profile as Partial<UserProfile> | undefined
  const hadProfileObject = p != null && typeof p === 'object'

  const sessions = Array.isArray(raw.sessions) ? raw.sessions : minimal.sessions
  let dailyUsage = Array.isArray(raw.dailyUsage) ? raw.dailyUsage : minimal.dailyUsage

  /** Saves from before `profile` existed—keep them out of setup. */
  const legacyNoProfile =
    !hadProfileObject &&
    ((sessions as SessionEntry[]).length > 0 || (dailyUsage as DayUsage[]).length > 0)

  let profile: UserProfile = hadProfileObject
    ? {
        mainObjective: p!.mainObjective ?? '',
        longTermGoals: p!.longTermGoals ?? '',
        shortTermGoals: p!.shortTermGoals ?? '',
        reportedDailyPhoneMinutes:
          p!.reportedDailyPhoneMinutes ?? minimal.profile.reportedDailyPhoneMinutes,
        age: p!.age ?? null,
        setupComplete: p!.setupComplete === true,
        onboardingDone: p!.onboardingDone === true,
        setupCompletedAt: p!.setupCompletedAt ?? null,
        hasSeenMainScrollIntro: p!.hasSeenMainScrollIntro === true,
      }
    : legacyNoProfile
      ? {
          ...minimal.profile,
          setupComplete: true,
          onboardingDone: true,
          reportedDailyPhoneMinutes: 180,
          setupCompletedAt: minimal.profile.setupCompletedAt,
          hasSeenMainScrollIntro: true,
        }
      : { ...minimal.profile }

  const targets = Array.isArray(raw.targets) ? raw.targets : minimal.targets

  let dailyFocusMinutes = Array.isArray(raw.dailyFocusMinutes)
    ? raw.dailyFocusMinutes
    : minimal.dailyFocusMinutes

  if (!hadProfileObject && (dailyUsage as DayUsage[]).length > 0) {
    const avg = Math.round(
      dailyUsage.reduce((s: number, x: DayUsage) => s + x.minutes, 0) /
        dailyUsage.length,
    )
    profile.reportedDailyPhoneMinutes = avg || 180
    profile.setupComplete = true
    profile.onboardingDone = true
    dailyFocusMinutes = []
  }

  if (
    !hadProfileObject &&
    (dailyUsage as DayUsage[]).length === 0 &&
    (sessions as SessionEntry[]).length > 0
  ) {
    profile.setupComplete = true
    profile.onboardingDone = true
    dailyUsage = seedScreenTimeFromReport(profile.reportedDailyPhoneMinutes, 35)
  }

  if (profile.setupComplete === true && profile.setupCompletedAt == null) {
    profile.setupCompletedAt = new Date().toISOString()
  }

  const rawProf = hadProfileObject ? (raw.profile as Record<string, unknown>) : null
  const onboardingKeyOnDisk =
    rawProf != null && Object.prototype.hasOwnProperty.call(rawProf, 'onboardingDone')

  /**
   * Never infer “done” when `onboardingDone: false` is on disk. Only infer for older saves
   * missing that key (setupComplete + timestamp).
   */
  const onboardingDone =
    profile.onboardingDone === true ||
    (hadProfileObject &&
      !onboardingKeyOnDisk &&
      profile.setupComplete === true &&
      profile.setupCompletedAt != null)

  profile = {
    ...profile,
    onboardingDone,
  }

  let workSchedule: WorkSchedule = minimal.workSchedule
  const ws = raw.workSchedule as Partial<WorkSchedule> | undefined
  if (ws && typeof ws === 'object') {
    const daysRaw = Array.isArray(ws.daysActive) ? ws.daysActive : null
    const daysOk =
      daysRaw != null &&
      daysRaw.length === 7 &&
      daysRaw.every((x) => x === true || x === false)
    workSchedule = {
      startMinutes:
        typeof ws.startMinutes === 'number'
          ? Math.max(0, Math.min(1439, ws.startMinutes))
          : minimal.workSchedule.startMinutes,
      endMinutes:
        typeof ws.endMinutes === 'number'
          ? Math.max(0, Math.min(1439, ws.endMinutes))
          : minimal.workSchedule.endMinutes,
      daysActive: daysOk ? (daysRaw as boolean[]) : [...minimal.workSchedule.daysActive],
      breaksAllowed: ws.breaksAllowed !== false,
      vacationMode: ws.vacationMode === true,
    }
  }

  return {
    profile,
    targets,
    sessions,
    dailyUsage,
    dailyFocusMinutes,
    blockAttempts: (raw.blockAttempts as number) ?? minimal.blockAttempts,
    blockFailed: (raw.blockFailed as number) ?? minimal.blockFailed,
    workSchedule,
  }
}

export async function loadPersisted(): Promise<PersistedState> {
  try {
    const rawStr = await AsyncStorage.getItem(STORAGE_KEY)
    if (!rawStr) {
      const initial = buildMinimalState()
      await savePersisted(initial)
      return initial
    }
    const raw = JSON.parse(rawStr) as Record<string, unknown>
    return migrate(raw)
  } catch {
    const initial = buildMinimalState()
    await savePersisted(initial)
    return initial
  }
}

export async function savePersisted(state: PersistedState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export async function resetPersisted(): Promise<PersistedState> {
  const fresh = buildResetDemoState()
  await savePersisted(fresh)
  return fresh
}

export function finishSetupPatch(
  state: PersistedState,
  profile: UserProfile,
): PersistedState {
  const minutes = profile.reportedDailyPhoneMinutes || 180
  return {
    ...state,
    profile: {
      ...profile,
      setupComplete: true,
      onboardingDone: true,
      reportedDailyPhoneMinutes: minutes,
      setupCompletedAt: new Date().toISOString(),
      hasSeenMainScrollIntro: false,
    },
    dailyUsage: seedScreenTimeFromReport(minutes, 35),
  }
}

export function patchReportedScreenTime(
  state: PersistedState,
  minutes: number,
): PersistedState {
  const m = Math.max(30, Math.min(960, minutes))
  return {
    ...state,
    profile: { ...state.profile, reportedDailyPhoneMinutes: m },
    dailyUsage: seedScreenTimeFromReport(m, 35),
  }
}
