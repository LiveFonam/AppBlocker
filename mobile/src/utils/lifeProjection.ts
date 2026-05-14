/** US life expectancy–style default for “years ahead” when age unknown. */
const DEFAULT_AGE = 32
const LIFE_EXPECTANCY = 79

export function yearsAhead(age: number | null): number {
  const a = age ?? DEFAULT_AGE
  return Math.max(8, LIFE_EXPECTANCY - a)
}

/** Fraction of waking hours (16h) spent on phone at this daily average. */
export function wakingFractionFromDailyMinutes(dailyMinutes: number): number {
  const hours = dailyMinutes / 60
  return Math.min(1, hours / 16)
}

/** “Equivalent years of waking life” on the phone at current pace. */
export function equivalentWakingYearsOnPhone(
  dailyMinutes: number,
  age: number | null,
): number {
  return wakingFractionFromDailyMinutes(dailyMinutes) * yearsAhead(age)
}

export function hoursPerWeek(dailyMinutes: number): number {
  return (dailyMinutes * 7) / 60
}

export function hoursPerYear(dailyMinutes: number): number {
  return (dailyMinutes * 365) / 60
}

/** White = waking life still yours; grey = hours going to the phone at this daily pace. */
export function lifeRemainingGrid(dailyMinutes: number, _age: number | null) {
  void _age
  const f = wakingFractionFromDailyMinutes(dailyMinutes)
  const cols = 12
  const rows = 16
  const total = cols * rows
  const greyCount = Math.min(total, Math.max(0, Math.round(f * total)))
  const whiteCount = total - greyCount
  return { cols, rows, total, whiteCount, greyCount, f }
}

/** If we recover `recoverFraction` of that phone time back to life. */
export function recoverableHoursPerYear(
  dailyMinutes: number,
  recoverFraction = 0.25,
): number {
  return hoursPerYear(dailyMinutes) * recoverFraction
}
