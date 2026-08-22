import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterResources,
  reconcileResourceSelection,
  selectAllResourceIds,
  toggleResourceSelection,
} from '@/components/admin/dashboard/shared/resource-state'

type Item = { id: string; name: string; status: string; amount: number }

const items: Item[] = [
  { id: 'a', name: 'Rice', status: 'available', amount: 10 },
  { id: 'b', name: 'Chicken', status: 'low', amount: 2 },
  { id: 'c', name: 'Tomato', status: 'available', amount: 8 },
]

test('selection toggles without mutating the source set', () => {
  const source = new Set(['a'])
  const added = toggleResourceSelection(source, 'b')
  const removed = toggleResourceSelection(added, 'a')

  assert.deepEqual([...source], ['a'])
  assert.deepEqual([...added].sort(), ['a', 'b'])
  assert.deepEqual([...removed], ['b'])
})

test('select all and reconciliation keep only visible resource ids', () => {
  const all = selectAllResourceIds(items, (item) => item.id, true)
  assert.deepEqual([...all].sort(), ['a', 'b', 'c'])

  const reconciled = reconcileResourceSelection(new Set(['a', 'missing']), items.slice(0, 2), (item) => item.id)
  assert.deepEqual([...reconciled], ['a'])
  assert.deepEqual([...selectAllResourceIds(items, (item) => item.id, false)], [])
})

test('resource filters apply query and column filters as an AND expression', () => {
  const columns = [
    { id: 'name', getValue: (item: Item) => item.name },
    { id: 'status', getValue: (item: Item) => item.status },
    { id: 'amount', getValue: (item: Item) => item.amount },
  ]

  assert.deepEqual(
    filterResources(items, 'rice', columns, { status: 'available' }).map((item) => item.id),
    ['a'],
  )
  assert.deepEqual(
    filterResources(items, '', columns, { amount: '2' }).map((item) => item.id),
    ['b'],
  )
  assert.deepEqual(filterResources(items, 'missing', columns), [])
})
