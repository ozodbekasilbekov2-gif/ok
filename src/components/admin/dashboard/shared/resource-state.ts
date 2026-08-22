export type ResourceId = string | number

export type ResourceFilterColumn<T> = {
  id: string
  getValue: (item: T) => unknown
}

export type ResourceFilterValues = Readonly<Record<string, string>>

export function toggleResourceSelection<T extends ResourceId>(
  selected: ReadonlySet<T>,
  id: T,
  nextSelected = !selected.has(id),
): Set<T> {
  const next = new Set(selected)
  if (nextSelected) next.add(id)
  else next.delete(id)
  return next
}

export function selectAllResourceIds<T, I extends ResourceId>(
  items: readonly T[],
  getId: (item: T) => I,
  selected: boolean,
): Set<I> {
  return selected ? new Set(items.map(getId)) : new Set<I>()
}

export function reconcileResourceSelection<T, I extends ResourceId>(
  selected: ReadonlySet<I>,
  items: readonly T[],
  getId: (item: T) => I,
): Set<I> {
  const visibleIds = new Set(items.map(getId))
  return new Set([...selected].filter((id) => visibleIds.has(id)))
}

function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? ''
}

export function filterResources<T>(
  items: readonly T[],
  query: string,
  columns: readonly ResourceFilterColumn<T>[],
  filters: ResourceFilterValues = {},
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const activeFilters = Object.entries(filters)
    .map(([id, value]) => [id, value.trim().toLocaleLowerCase()] as const)
    .filter(([, value]) => value.length > 0)

  return items.filter((item) => {
    const values = new Map(columns.map((column) => [column.id, normalizeFilterValue(column.getValue(item)).toLocaleLowerCase()]))
    const queryMatches = !normalizedQuery || [...values.values()].some((value) => value.includes(normalizedQuery))
    if (!queryMatches) return false

    return activeFilters.every(([id, value]) => values.get(id)?.includes(value) ?? false)
  })
}
