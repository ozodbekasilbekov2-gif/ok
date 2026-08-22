import type { Client, Order } from '@/components/admin/dashboard/types'
import { filterResources } from '@/components/admin/dashboard/shared/resource-state'

export type ClientFinanceProjection = {
  balance: number
  dailyPrice: number
}

export function filterDeletedOrders(orders: Order[], query: string): Order[] {
  return filterResources(orders, query, [
    { id: 'id', getValue: (order) => order.id },
    { id: 'status', getValue: (order) => order.orderStatus },
    { id: 'customer', getValue: (order) => order.customer?.name },
    { id: 'phone', getValue: (order) => order.customer?.phone },
  ])
}

export function filterDeletedClients(clients: Client[], query: string): Client[] {
  return filterResources(clients, query, [
    { id: 'name', getValue: (client) => client.name },
    { id: 'phone', getValue: (client) => client.phone },
    { id: 'address', getValue: (client) => client.address },
  ])
}

export function parseClientFinanceProjections(value: unknown): Record<string, ClientFinanceProjection> {
  if (!Array.isArray(value)) return {}
  const next: Record<string, ClientFinanceProjection> = {}

  for (const row of value) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) continue
    const candidate = row as Record<string, unknown>
    if (typeof candidate.id !== 'string') continue
    if (typeof candidate.balance !== 'number' || !Number.isFinite(candidate.balance)) continue
    next[candidate.id] = {
      balance: candidate.balance,
      dailyPrice: typeof candidate.dailyPrice === 'number' && Number.isFinite(candidate.dailyPrice)
        ? candidate.dailyPrice
        : 0,
    }
  }

  return next
}

export function hasActiveDispatchedOrder(orders: Order[], isToday: boolean): boolean {
  if (!isToday) return false
  return orders.some((order) => Boolean(order.courierId) && order.orderStatus !== 'NEW' && order.orderStatus !== 'IN_PROCESS')
}
