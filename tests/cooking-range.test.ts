import assert from 'node:assert/strict'
import test from 'node:test'

import { keepDateInRange, listLocalIsoDates, toLocalIsoDate } from '@/lib/warehouse/cooking-range'

test('local ISO dates use the calendar day instead of UTC serialization', () => {
  const date = new Date(2026, 7, 22, 23, 45, 10)
  assert.equal(toLocalIsoDate(date), '2026-08-22')
})

test('date ranges are normalized, inclusive, and bounded', () => {
  const from = new Date(2026, 7, 1, 15)
  const to = new Date(2026, 7, 3, 2)
  assert.deepEqual(listLocalIsoDates(from, to, 10), ['2026-08-01', '2026-08-02', '2026-08-03'])
  assert.deepEqual(listLocalIsoDates(from, to, 2), ['2026-08-01', '2026-08-02'])
  assert.deepEqual(listLocalIsoDates(undefined, to, 10), [])
})

test('selected cooking date stays inside the chosen range', () => {
  assert.equal(keepDateInRange('2026-08-02', ['2026-08-01', '2026-08-02']), '2026-08-02')
  assert.equal(keepDateInRange('outside', ['2026-08-01', '2026-08-02']), '2026-08-01')
  assert.equal(keepDateInRange('outside', []), 'outside')
})
