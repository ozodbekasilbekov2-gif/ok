const DAY_MS = 24 * 60 * 60 * 1000

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function listLocalIsoDates(from: Date | undefined, to: Date | undefined, limit: number): string[] {
  if (!from || !Number.isFinite(from.getTime()) || limit <= 0) return []

  const start = new Date(from)
  start.setHours(0, 0, 0, 0)
  const end = new Date(to && Number.isFinite(to.getTime()) ? to : from)
  end.setHours(0, 0, 0, 0)

  const dates: string[] = []
  while (start.getTime() <= end.getTime() && dates.length < limit) {
    dates.push(toLocalIsoDate(start))
    start.setTime(start.getTime() + DAY_MS)
  }
  return dates
}

export function keepDateInRange(selected: string, dates: readonly string[]): string {
  return dates.includes(selected) ? selected : dates[0] || selected
}
