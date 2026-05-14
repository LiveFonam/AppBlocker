/** Calendar days since setup completed (inclusive of first day). */
export function daysInAppSince(iso: string | null | undefined): number {
  if (!iso) return 1
  const start = new Date(iso)
  const now = new Date()
  if (Number.isNaN(start.getTime())) return 1
  start.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((now.getTime() - start.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}
