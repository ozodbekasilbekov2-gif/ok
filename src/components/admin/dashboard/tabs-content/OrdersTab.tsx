import dynamic from 'next/dynamic'
import type { ComponentType, RefObject } from 'react'
import type { DateRange } from 'react-day-picker'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDateSelector } from '@/components/admin/dashboard/shared/CalendarDateSelector'
import { ResourceActionBar } from '@/components/admin/dashboard/shared/ResourceActionBar'
import { RefreshIconButton } from '@/components/admin/dashboard/shared/RefreshIconButton'
import { TabEmptyState } from '@/components/admin/dashboard/shared/TabEmptyState'
import type { Order } from '@/components/admin/dashboard/types'
import { Plus, Trash2 } from 'lucide-react'

const OrdersTable = dynamic(
  () => import('@/components/admin/OrdersTable').then((mod) => mod.OrdersTable),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading...</div> },
)

export type OrdersTabProps = {
  copy: {
    title: string
    description: string
    createOrder: string
    deleteSelected: string
    loading: string
  }
  profileCopy: {
    calendar: string
    today: string
    clearDate: string
    yesterday: string
    tomorrow: string
    thisWeek: string
    thisMonth: string
    allTime: string
    refresh: string
    searchOrdersPlaceholder: string
    noOrdersFound: string
    noOrdersFoundDescription: string
  }
  dateLocale: string
  selectedDate: Date | null
  selectedDateLabel: string
  selectedPeriod: DateRange | undefined
  applySelectedDate: (date: Date | null) => void
  shiftSelectedDate: (days: number) => void
  applySelectedPeriod: (range: DateRange | undefined) => void
  onRefresh: () => void
  isLoading: boolean
  isDashboardRefreshing: boolean
  onCreateOrder: () => void
  onOpenDispatch: () => void
  dispatchActionLabel: string
  dispatchIcon: ComponentType<{ className?: string }>
  selectedDateAvailable: boolean
  selectedOrdersSize: number
  isDeletingOrders: boolean
  onOpenDeleteDialog: () => void
  onClearSelection?: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filteredOrders: Order[]
  selectedOrders: Set<string>
  onSelectOrder: (id: string) => void
  onSelectAll: () => void
  onEditOrder: (order: Order) => void
  onViewOrder: (order: Order) => void
}

export function OrdersTab({
  copy,
  profileCopy,
  dateLocale,
  selectedDate,
  selectedDateLabel,
  selectedPeriod,
  applySelectedDate,
  shiftSelectedDate,
  applySelectedPeriod,
  onRefresh,
  isLoading,
  isDashboardRefreshing,
  onCreateOrder,
  onOpenDispatch,
  dispatchActionLabel,
  dispatchIcon: DispatchActionIcon,
  selectedDateAvailable,
  selectedOrdersSize,
  isDeletingOrders,
  onOpenDeleteDialog,
  onClearSelection,
  searchInputRef,
  searchTerm,
  onSearchTermChange,
  filteredOrders,
  selectedOrders,
  onSelectOrder,
  onSelectAll,
  onEditOrder,
  onViewOrder,
}: OrdersTabProps) {
  return (
    <div data-testid="orders-tab-content">
      <Card className="border bg-card">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </div>
            <ResourceActionBar
              searchValue={searchTerm}
              onSearchChange={onSearchTermChange}
              searchPlaceholder={profileCopy.searchOrdersPlaceholder}
              inputRef={searchInputRef}
              selectedCount={selectedOrdersSize}
              onClearSelection={onClearSelection}
              className="w-full border-0 pb-0 sm:w-auto sm:flex-1 sm:border-0 sm:pb-0"
            >
              <CalendarDateSelector
                selectedDate={selectedDate}
                applySelectedDate={applySelectedDate}
                shiftSelectedDate={shiftSelectedDate}
                selectedDateLabel={selectedDateLabel}
                selectedPeriod={selectedPeriod}
                applySelectedPeriod={applySelectedPeriod}
                showShiftButtons={false}
                locale={dateLocale}
                profileUiText={profileCopy}
              />
              <RefreshIconButton
                label={profileCopy.refresh}
                onClick={onRefresh}
                isLoading={isLoading || isDashboardRefreshing}
                iconSize="md"
              />
              <Button onClick={onCreateOrder} size="icon" className="h-9 w-9" aria-label={copy.createOrder} title={copy.createOrder}>
                <Plus className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={onOpenDispatch}
                disabled={!selectedDateAvailable}
                aria-label={dispatchActionLabel}
                title={dispatchActionLabel}
              >
                <DispatchActionIcon className="size-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-9 w-9"
                onClick={onOpenDeleteDialog}
                disabled={selectedOrdersSize === 0 || isDeletingOrders}
                aria-label={`${copy.deleteSelected} (${selectedOrdersSize})`}
                title={`${copy.deleteSelected} (${selectedOrdersSize})`}
              >
                {isDeletingOrders ? <span className="text-xs">{copy.loading}</span> : <Trash2 className="size-4" />}
              </Button>
              {selectedOrdersSize > 0 ? <Badge variant="secondary" className="h-7 px-2 text-xs">{selectedOrdersSize}</Badge> : null}
            </ResourceActionBar>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <TabEmptyState title={profileCopy.noOrdersFound} description={profileCopy.noOrdersFoundDescription} />
          ) : (
            <div className="rounded-md border">
              <OrdersTable
                orders={filteredOrders}
                selectedOrders={selectedOrders}
                onSelectOrder={onSelectOrder}
                onSelectAll={onSelectAll}
                onDeleteSelected={onOpenDeleteDialog}
                onViewOrder={onViewOrder}
                onEditOrder={onEditOrder}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
