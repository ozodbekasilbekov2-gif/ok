'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, Settings2 } from 'lucide-react'

import type { Stats } from '@/components/admin/dashboard/types'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'

export type StatisticsCopy = {
  successful: string
  failed: string
  inDelivery: string
  pending: string
  prepaid: string
  unpaid: string
  card: string
  cash: string
  daily: string
  evenDay: string
  oddDay: string
  special: string
  lowCal: string
  standard: string
  medium: string
  high: string
  max: string
  single: string
  multi: string
}

type StatKey = keyof Stats

type Metric = {
  key: StatKey
  label: string
  sub: string
  color: string
  dot: string
}

type WidgetId = 'outcomes' | 'payments' | 'frequency' | 'calories' | 'order-size'

type Widget = {
  id: WidgetId
  title: string
  metrics: Metric[]
}

const DEFAULT_WIDGET_ORDER: WidgetId[] = ['outcomes', 'payments', 'frequency', 'calories', 'order-size']
const WIDGET_STORAGE_KEY = 'autofood:statistics-widgets:v1'

function MetricCard({ metric, stats }: { metric: Metric; stats: Stats | null }) {
  return (
    <div className="rounded-base border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-md ${metric.dot}`} aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
      </div>
      <div className={`text-2xl font-bold ${metric.color}`}>{stats?.[metric.key] ?? 0}</div>
      <p className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">{metric.sub}</p>
    </div>
  )
}

function MetricGroup({ metrics, stats }: { metrics: Metric[]; stats: Stats | null }) {
  const columns = metrics.length === 5 ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid gap-3 ${columns}`}>
      {metrics.map((metric) => <MetricCard key={metric.key} metric={metric} stats={stats} />)}
    </div>
  )
}

function readWidgetState(): { order: WidgetId[]; hidden: Set<WidgetId> } {
  if (typeof window === 'undefined') return { order: DEFAULT_WIDGET_ORDER, hidden: new Set() }

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(WIDGET_STORAGE_KEY) || '{}')
    if (!value || typeof value !== 'object') return { order: DEFAULT_WIDGET_ORDER, hidden: new Set() }

    const record = value as { order?: unknown; hidden?: unknown }
    const validIds = new Set(DEFAULT_WIDGET_ORDER)
    const savedOrder = Array.isArray(record.order)
      ? record.order.filter((id): id is WidgetId => typeof id === 'string' && validIds.has(id as WidgetId))
      : []
    const order = [...savedOrder, ...DEFAULT_WIDGET_ORDER.filter((id) => !savedOrder.includes(id))]
    const hidden = new Set(
      Array.isArray(record.hidden)
        ? record.hidden.filter((id): id is WidgetId => typeof id === 'string' && validIds.has(id as WidgetId))
        : [],
    )
    return { order, hidden }
  } catch {
    return { order: DEFAULT_WIDGET_ORDER, hidden: new Set() }
  }
}

export function StatisticsTab({ stats, copy }: { stats: Stats | null; copy: StatisticsCopy }) {
  const widgets = useMemo<Widget[]>(() => [
    {
      id: 'outcomes',
      title: `${copy.successful} / ${copy.failed}`,
      metrics: [
        { key: 'successfulOrders', label: copy.successful, sub: 'Доставлено', color: 'text-emerald-600', dot: 'bg-emerald-500' },
        { key: 'failedOrders', label: copy.failed, sub: 'Отменено', color: 'text-rose-600', dot: 'bg-rose-500' },
        { key: 'inDeliveryOrders', label: copy.inDelivery, sub: 'В процессе', color: 'text-blue-600', dot: 'bg-blue-500' },
        { key: 'pendingOrders', label: copy.pending, sub: 'В очереди', color: 'text-amber-600', dot: 'bg-amber-500' },
      ],
    },
    {
      id: 'payments',
      title: `${copy.prepaid} / ${copy.unpaid}`,
      metrics: [
        { key: 'prepaidOrders', label: copy.prepaid, sub: 'Оплачено', color: 'text-emerald-600', dot: 'bg-emerald-500' },
        { key: 'unpaidOrders', label: copy.unpaid, sub: 'При получении', color: 'text-rose-600', dot: 'bg-rose-500' },
        { key: 'cardOrders', label: copy.card, sub: 'Онлайн', color: 'text-blue-600', dot: 'bg-blue-500' },
        { key: 'cashOrders', label: copy.cash, sub: 'Наличные', color: 'text-teal-600', dot: 'bg-teal-500' },
      ],
    },
    {
      id: 'frequency',
      title: copy.daily,
      metrics: [
        { key: 'dailyCustomers', label: copy.daily, sub: 'Каждый день', color: 'text-violet-600', dot: 'bg-violet-500' },
        { key: 'evenDayCustomers', label: copy.evenDay, sub: 'Четные дни', color: 'text-indigo-600', dot: 'bg-indigo-500' },
        { key: 'oddDayCustomers', label: copy.oddDay, sub: 'Нечетные дни', color: 'text-pink-600', dot: 'bg-pink-500' },
        { key: 'specialPreferenceCustomers', label: copy.special, sub: 'С особенностями', color: 'text-orange-600', dot: 'bg-orange-500' },
      ],
    },
    {
      id: 'calories',
      title: copy.lowCal,
      metrics: [
        { key: 'orders1200', label: copy.lowCal, sub: '1200 ккал', color: 'text-rose-600', dot: 'bg-rose-500' },
        { key: 'orders1600', label: copy.standard, sub: '1600 ккал', color: 'text-orange-600', dot: 'bg-orange-500' },
        { key: 'orders2000', label: copy.medium, sub: '2000 ккал', color: 'text-yellow-600', dot: 'bg-yellow-500' },
        { key: 'orders2500', label: copy.high, sub: '2500 ккал', color: 'text-emerald-600', dot: 'bg-emerald-500' },
        { key: 'orders3000', label: copy.max, sub: '3000 ккал', color: 'text-blue-600', dot: 'bg-blue-500' },
      ],
    },
    {
      id: 'order-size',
      title: `${copy.single} / ${copy.multi}`,
      metrics: [
        { key: 'singleItemOrders', label: copy.single, sub: '1 порция', color: 'text-indigo-600', dot: 'bg-indigo-500' },
        { key: 'multiItemOrders', label: copy.multi, sub: 'Две и более порций', color: 'text-violet-600', dot: 'bg-violet-500' },
      ],
    },
  ], [copy])

  const widgetById = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets])
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER)
  const [hidden, setHidden] = useState<Set<WidgetId>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readWidgetState()
    setOrder(stored.order)
    setHidden(stored.hidden)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify({ order, hidden: [...hidden] }))
  }, [hydrated, hidden, order])

  const visibleWidgets = order
    .map((id) => widgetById.get(id))
    .filter((widget): widget is Widget => widget !== undefined && !hidden.has(widget.id))

  const moveWidget = (id: WidgetId, direction: -1 | 1) => {
    setOrder((current) => {
      const index = current.indexOf(id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  return (
    <TabsContent value="statistics" className="space-y-5">
      <div className="flex items-center justify-end border-b border-border pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setShowSettings((current) => !current)}
          aria-expanded={showSettings}
          aria-controls="statistics-widget-settings"
        >
          <Settings2 className="size-4" />
          Widgets
        </Button>
      </div>

      {showSettings && (
        <div id="statistics-widget-settings" className="space-y-3 rounded-base border border-border bg-card p-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                setOrder(DEFAULT_WIDGET_ORDER)
                setHidden(new Set())
              }}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {order.map((id, index) => {
            const widget = widgetById.get(id)
            if (!widget) return null
            const isVisible = !hidden.has(id)
            return (
              <div key={id} className="flex items-center gap-2 rounded-base border border-border px-2 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setHidden((current) => {
                    const next = new Set(current)
                    if (isVisible) next.add(id)
                    else next.delete(id)
                    return next
                  })}
                  aria-label={isVisible ? `Hide ${widget.title}` : `Show ${widget.title}`}
                  title={isVisible ? `Hide ${widget.title}` : `Show ${widget.title}`}
                  aria-pressed={isVisible}
                >
                  {isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{widget.title}</span>
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveWidget(id, -1)} disabled={index === 0} aria-label={`Move ${widget.title} up`}>
                  <ChevronUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => moveWidget(id, 1)} disabled={index === order.length - 1} aria-label={`Move ${widget.title} down`}>
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {visibleWidgets.map((widget) => (
        <section key={widget.id} className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{widget.title}</h3>
          <MetricGroup metrics={widget.metrics} stats={stats} />
        </section>
      ))}
    </TabsContent>
  )
}
