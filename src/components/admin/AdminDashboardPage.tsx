'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAdminSettingsContext } from '@/contexts/AdminSettingsContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/icon-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  History,
  User,
  Plus,
  Trash2,
  Pause,
  Play,
  Save,
  RefreshCw,
  CalendarDays,
  MapPin,
  LocateFixed,
  Clock,
  Truck,
  CookingPot,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/LanguageContext'
import { ChangePasswordModal } from '@/components/admin/ChangePasswordModal'
import { SiteBuilderCard } from '@/components/admin/SiteBuilderCard'
import { CANONICAL_TABS, deriveVisibleTabs } from '@/components/admin/dashboard/tabs'
import { getSetGroupOptions } from '@/lib/menu/set-group-options'
import type { Client, MenuSetSummary, Order } from '@/components/admin/dashboard/types'
import { DesktopTabsNav } from '@/components/admin/dashboard/DesktopTabsNav'
import { MobileBottomTabsNav } from '@/components/admin/dashboard/MobileBottomTabsNav'
import { useDashboardData } from '@/components/admin/dashboard/useDashboardData'
import { AdminDashboardHeader } from '@/components/admin/dashboard/AdminDashboardHeader'
import { AdminsTab } from '@/components/admin/dashboard/tabs-content/AdminsTab'
import { StatisticsTab } from '@/components/admin/dashboard/tabs-content/StatisticsTab'
import { OrdersTab } from '@/components/admin/dashboard/tabs-content/OrdersTab'
import { DeletedClientsTable } from '@/components/admin/dashboard/tabs-content/DeletedClientsTable'
import { DeletedOrdersPanel } from '@/components/admin/dashboard/tabs-content/DeletedOrdersPanel'
import { ClientDirectoryTable } from '@/components/admin/dashboard/tabs-content/ClientDirectoryTable'
import { OrderModal } from '@/components/admin/dashboard/modals/OrderModal'
import { ClientEditorDialog } from '@/components/admin/dashboard/modals/ClientEditorDialog'
import { DispatchMapPanel } from '@/components/admin/orders/DispatchMapPanel'
import { ChatCenter } from '@/components/chat/ChatCenter'
import {
  expandShortMapsUrl,
  extractCoordsFromText,
  isShortGoogleMapsUrl,
  parseGoogleMapsUrl,
  type LatLng,
} from '@/lib/geo'

import { CalendarDateSelector } from '@/components/admin/dashboard/shared/CalendarDateSelector'
import { RefreshIconButton } from '@/components/admin/dashboard/shared/RefreshIconButton'
import { ResourceActionBar } from '@/components/admin/dashboard/shared/ResourceActionBar'
import { filterResources, reconcileResourceSelection } from '@/components/admin/dashboard/shared/resource-state'
import type { DateRange } from 'react-day-picker'
import {
  filterDeletedClients,
  filterDeletedOrders,
  hasActiveDispatchedOrder,
  parseClientFinanceProjections,
} from '@/components/admin/dashboard/projections'

const HistoryTable = dynamic(
  () => import('@/components/admin/HistoryTable').then((mod) => mod.HistoryTable),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading...</div> }
)
const WarehouseStartPointPickerMap = dynamic(
  () =>
    import('@/components/admin/dashboard/shared/WarehouseStartPointPickerMap').then(
      (mod) => mod.WarehouseStartPointPickerMap
    ),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse border bg-muted/30" /> }
)
const WarehouseTab = dynamic(
  () => import('@/components/admin/WarehouseTab').then((mod) => mod.WarehouseTab),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading...</div> }
)
const FinanceTab = dynamic(
  () => import('@/components/admin/FinanceTab').then((mod) => mod.FinanceTab),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading...</div> }
)
export type AdminDashboardMode = 'middle' | 'low'

const DASHBOARD_UI_STORAGE_PREFIX = 'autofood:dashboard-ui'

const DEFAULT_ORDER_FILTERS = {
  successful: false,
  failed: false,
  pending: false,
  inDelivery: false,
  prepaid: false,
  paid: false,
  unpaid: false,
  card: false,
  cash: false,
  daily: false,
  evenDay: false,
  oddDay: false,
  special: false,
  calories1200: false,
  calories1600: false,
  calories2000: false,
  calories2500: false,
  calories3000: false,
  singleItem: false,
  multiItem: false,
  autoOrders: false,
  manualOrders: false,
}

export function AdminDashboardPage({ mode }: { mode: AdminDashboardMode }) {
  const { t, language } = useLanguage()
  const { settings: adminSettings, updateSettings: updateAdminSettings } =
    useAdminSettingsContext()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState(() => (mode === 'middle' ? 'orders' : 'statistics'))
  const [currentDate, setCurrentDate] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => (mode === 'middle' ? new Date() : null))
  const [selectedPeriod, setSelectedPeriod] = useState<DateRange | undefined>(() => {
    if (mode !== 'middle') return undefined
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return { from: today, to: today }
  })
  const [, setDateCursor] = useState<Date>(() => new Date())
  const [isUiStateHydrated, setIsUiStateHydrated] = useState(false)
  const [isDispatchOpen, setIsDispatchOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [clientFinanceById, setClientFinanceById] = useState<Record<string, { balance: number; dailyPrice: number }>>(
    {}
  )
  const [isClientFinanceLoading, setIsClientFinanceLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [isDeleteOrdersDialogOpen, setIsDeleteOrdersDialogOpen] = useState(false)
  const [isDeleteClientsDialogOpen, setIsDeleteClientsDialogOpen] = useState(false)
  const [isPauseClientsDialogOpen, setIsPauseClientsDialogOpen] = useState(false)
  const [isResumeClientsDialogOpen, setIsResumeClientsDialogOpen] = useState(false)
  const [isDeletingOrders, setIsDeletingOrders] = useState(false)
  const [isMutatingClients, setIsMutatingClients] = useState(false)
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false)
  const [isCreateCourierModalOpen, setIsCreateCourierModalOpen] = useState(false)
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false)
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedOrderTimeline, setSelectedOrderTimeline] = useState<
    Array<{
      id: string
      eventType: string
      occurredAt: string
      actorName?: string
      message?: string
      previousStatus?: string | null
      nextStatus?: string | null
    }>
  >([])
  const [isOrderTimelineLoading, setIsOrderTimelineLoading] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const tabsCopy = {
    orders: t.admin.orders,
    clients: t.admin.clients,
    admins: t.admin.admins,
    bin: t.admin.bin,
    statistics: t.admin.statistics,
    history: t.admin.history,
    warehouse: t.warehouse.title,
    finance: t.finance.title,
    interface: t.admin.interface,
  }
  const [courierFormData, setCourierFormData] = useState({
    name: '',
    email: '',
    password: '',
    salary: ''
  })
  const [clientFormData, setClientFormData] = useState({
    name: '',
    nickName: '',
    phone: '',
    address: '',
    calories: 1200,
    planType: 'CLASSIC' as 'CLASSIC' | 'INDIVIDUAL' | 'DIABETIC',
    dailyPrice: 84000,
    notes: '',
    specialFeatures: '',
    deliveryDays: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    autoOrdersEnabled: true,
    isActive: true,
    defaultCourierId: '',
    googleMapsLink: '',
    latitude: null as number | null,
    longitude: null as number | null,
    assignedSetId: ''
  })
  const [clientSelectedGroupId, setClientSelectedGroupId] = useState<string>('')
  const [orderFormData, setOrderFormData] = useState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryTime: '',
    quantity: 1,
    calories: 1200,
    specialFeatures: '',
    paymentStatus: 'UNPAID',
    paymentMethod: 'CASH',
    isPrepaid: false,
    amountReceived: null as number | null,
    selectedClientId: '',
    latitude: null as number | null,
    longitude: null as number | null,
    courierId: '',
    assignedSetId: ''
  })
  const [_parsedCoords, setParsedCoords] = useState<{ lat: number, lng: number } | null>(null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [isCreatingCourier, setIsCreatingCourier] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const handledDashboardQueryRef = useRef<string>('')
  const [warehousePoint, setWarehousePoint] = useState<LatLng | null>(null)
  const [warehouseInput, setWarehouseInput] = useState('')
  const [warehousePreview, setWarehousePreview] = useState<LatLng | null>(null)
  const [isWarehouseLoading, setIsWarehouseLoading] = useState(false)
  const [isWarehouseSaving, setIsWarehouseSaving] = useState(false)
  const [isWarehouseGeoLocating, setIsWarehouseGeoLocating] = useState(false)
  // Set current date on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))
  }, [])
  const [courierError, setCourierError] = useState('')
  const [clientError, setClientError] = useState('')
  const filters = DEFAULT_ORDER_FILTERS
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBinClients, setSelectedBinClients] = useState<Set<string>>(new Set())
  const [binOrdersSearch, setBinOrdersSearch] = useState('')
  const [binClientsSearch, setBinClientsSearch] = useState('')
  const [isBinOrdersRefreshing, setIsBinOrdersRefreshing] = useState(false)
  const [isBinClientsRefreshing, setIsBinClientsRefreshing] = useState(false)

  const {
    meRole,
    allowedTabs,
    isLoading,
    lowAdmins,
    orders,
    clients,
    couriers,
    availableSets,
    stats,
    binClients,
    binOrders,
    refreshAll,
    refreshBinClients,
    refreshBinOrders,
  } = useDashboardData({ selectedPeriod, filters })

  const fetchData = useCallback(() => refreshAll(), [refreshAll])
  const fetchBinClients = useCallback(() => refreshBinClients(), [refreshBinClients])
  const fetchBinOrders = useCallback(() => refreshBinOrders(), [refreshBinOrders])

  const clientAssignedSet = useMemo(() => {
    const id = clientFormData.assignedSetId
    if (!id) return null
    return (availableSets || []).find((set: MenuSetSummary) => set.id === id) ?? null
  }, [availableSets, clientFormData.assignedSetId])

  const clientGroupOptions = useMemo(
    () => getSetGroupOptions(clientAssignedSet?.calorieGroups ?? clientAssignedSet?.groups),
    [clientAssignedSet]
  )

  const clientSelectedGroup = useMemo(() => {
    return clientGroupOptions.find((g) => g.id === clientSelectedGroupId) ?? null
  }, [clientGroupOptions, clientSelectedGroupId])

  useEffect(() => {
    if (!clientSelectedGroupId) return
    if (clientGroupOptions.some((g) => g.id === clientSelectedGroupId)) return
    setClientSelectedGroupId('')
  }, [clientGroupOptions, clientSelectedGroupId])

  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false)
  const handleRefreshAll = useCallback(async () => {
    setIsDashboardRefreshing(true)
    try {
      await Promise.resolve(refreshAll())
    } finally {
      setIsDashboardRefreshing(false)
    }
  }, [refreshAll])

  const visibleBinOrders = useMemo(() => {
    const q = binOrdersSearch.trim().toLowerCase()
    if (!q) return binOrders
    return filterDeletedOrders(binOrders, q)
  }, [binOrders, binOrdersSearch])

  const visibleBinClients = useMemo(() => {
    const q = binClientsSearch.trim().toLowerCase()
    if (!q) return binClients
    return filterDeletedClients(binClients, q)
  }, [binClients, binClientsSearch])

  useEffect(() => {
    setSelectedBinClients((selected) => reconcileResourceSelection(selected, binClients, (client) => client.id))
  }, [binClients])

  const handleRefreshBinOrders = useCallback(async () => {
    setIsBinOrdersRefreshing(true)
    try {
      await Promise.resolve(fetchBinOrders())
    } finally {
      setIsBinOrdersRefreshing(false)
    }
  }, [fetchBinOrders])

  const handleRefreshBinClients = useCallback(async () => {
    setIsBinClientsRefreshing(true)
    try {
      await Promise.resolve(fetchBinClients())
    } finally {
      setIsBinClientsRefreshing(false)
    }
  }, [fetchBinClients])

  useEffect(() => {
    if (activeTab !== 'clients') return
    if (typeof window === 'undefined') return

    const controller = new AbortController()
    setIsClientFinanceLoading(true)

    void fetch('/api/admin/finance/clients?filter=all', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(data)) return
        setClientFinanceById(parseClientFinanceProjections(data))
      })
      .catch(() => null)
      .finally(() => {
        if (!controller.signal.aborted) setIsClientFinanceLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [activeTab, clients.length])

  const isMiddleAdminView = mode === 'middle' || meRole === 'MIDDLE_ADMIN'
  const isLowAdminView = mode === 'low' || meRole === 'LOW_ADMIN'

  const visibleTabs = useMemo(() => {
    const derivedTabs = Array.isArray(allowedTabs)
      ? deriveVisibleTabs(allowedTabs)
      : [...(CANONICAL_TABS as unknown as string[])]

    const withoutInterface = derivedTabs.filter((tab) => tab !== 'interface')
    return isMiddleAdminView ? withoutInterface.filter((tab) => tab !== 'statistics') : withoutInterface
  }, [allowedTabs, isMiddleAdminView])
  const uiStateStorageKey = useMemo(() => `${DASHBOARD_UI_STORAGE_PREFIX}:${mode}`, [mode])
  const isWarehouseReadOnly = isLowAdminView
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!searchParams) return

    // Allow other pages (e.g. /middle-admin/database) to deep-link into quick sheets.
    const key = searchParams.toString()
    if (!key || handledDashboardQueryRef.current === key) return
    handledDashboardQueryRef.current = key

    if (searchParams.get('settings') === '1') setIsSettingsOpen(true)
    if (searchParams.get('chat') === '1') setIsChatOpen(true)
  }, [searchParams])

  // Use local (calendar) dates for matching `deliveryDate` (stored as YYYY-MM-DD).
  // Avoid `toISOString()` here, because timezone offsets can shift the day.
  const toLocalIsoDate = useCallback((d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])

  const parseLocalIsoDate = useCallback((iso: string) => {
    const parts = iso.split('-')
    if (parts.length !== 3) return null
    const yyyy = Number(parts[0])
    const mm = Number(parts[1])
    const dd = Number(parts[2])
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
    const dt = new Date(yyyy, mm - 1, dd)
    dt.setHours(0, 0, 0, 0)
    return Number.isNaN(dt.getTime()) ? null : dt
  }, [])

  const isSelectedDateToday = useMemo(() => {
    if (!selectedDate) return false
    const todayISO = toLocalIsoDate(new Date())
    const selectedISO = toLocalIsoDate(selectedDate)
    return selectedISO === todayISO
  }, [selectedDate, toLocalIsoDate])

  const selectedDayIsActive = useMemo(() => {
    if (!selectedDate) return null
    return hasActiveDispatchedOrder(orders, isSelectedDateToday)
  }, [isSelectedDateToday, orders, selectedDate])

  const dateLocale = language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US'
  const profileUiText = useMemo(() => {
    if (language === 'ru') {
      return {
        database: 'База данных',
        noDateSelected: 'Дата не выбрана',
        allOrders: 'Все заказы',
        profileCenter: 'Профиль',
        profileCenterDescription: 'Безопасность, контекст аккаунта и быстрая навигация в одном месте',
        role: 'Роль',
        visibleTabs: 'Видимые вкладки',
        dispatchDate: 'Дата распределения',
        dispatchChooseDate: 'Выбрать дату',
        dispatchSave: 'Сохранить',
        dispatchStart: 'Начать',
        security: 'Безопасность',
        securityDescription: 'Защитите доступ к аккаунту и быстро завершайте сессии.',
        changePassword: 'Сменить пароль',
        quickNavigation: 'Быстрая навигация',
        warehouseStartPoint: 'Стартовая точка склада',
        warehouseStartPointDescription: 'Используется для построения и сортировки маршрутов всех курьеров.',
        warehouseInputLabel: 'Ссылка Google Maps или координаты (lat,lng)',
        readOnly: '(только чтение)',
        warehousePlaceholder: 'Пример: 41.311081,69.240562',
        current: 'Текущая',
        notConfigured: 'не настроено',
        preview: 'Предпросмотр',
        refresh: 'Обновить',
        saving: 'Сохранение...',
        saveLocation: 'Сохранить точку',
        useMyLocation: 'Моё местоположение',
        geolocationUnsupported: 'Геолокация не поддерживается в этом браузере.',
        geolocationDenied: 'Доступ к геолокации запрещён.',
        geolocationFailed: 'Не удалось получить текущее местоположение.',
        geolocationSet: 'Точка установлена по геолокации.',
        messages: 'Сообщения',
        messagesDescription: 'Командные диалоги и быстрая координация.',
        ordersBin: 'Корзина заказов',
        clientsBin: 'Корзина клиентов',
        autoSet: 'Авто (активный глобальный набор)',
        active: '(Активный)',
        enableAutoOrderCreation: 'Включить автоматическое создание заказов',
        searchClientPlaceholder: 'Поиск клиента...',
        searchClientsAria: 'Поиск клиентов',
        clear: 'Очистить',
        calendar: 'Календарь',
        today: 'Сегодня',
        clearDate: 'Очистить дату',
        allTime: 'За все время',
        thisWeek: 'Эта неделя',
        thisMonth: 'Этот месяц',
        next: 'Далее',
        yesterday: 'Вчера',
        tomorrow: 'Завтра',
        searchOrdersPlaceholder: 'Поиск по имени, адресу или номеру заказа...',
        searchOrdersAria: 'Поиск заказов',
        rows: 'строк',
        filters: 'фильтров',
        resetFilters: 'Сбросить фильтры',
        noOrdersFound: 'Заказы не найдены',
        noOrdersFoundDescription: 'Измените фильтры или поисковый запрос.',
        showing: 'Показано',
        of: 'из',
        statusFilter: 'Фильтр статуса',
        allClients: 'Все клиенты',
        activeOnly: 'Только активные',
        pausedOnly: 'Только приостановленные',
        bin: 'Корзина',
        createClient: 'Создать клиента',
        editClient: 'Редактировать клиента',
        updateClientDetails: 'Обновите данные клиента.',
        createClientDescription: 'Создайте нового клиента в системе.',
        nickname: 'Псевдоним',
        nicknamePlaceholder: 'Пример: Офис, Дом... (необязательно)',
        mapLink: 'Ссылка на карту',
        map: 'Карта',
        mapHint: 'Кликните по карте, чтобы выбрать точку (можно также перетаскивать маркер).',
        phoneFormat: 'Формат: +998 XX XXX XX XX',
        balance: 'Баланс',
        days: 'Дни',
        daysShort: 'дн.',
      }
    }

    if (language === 'uz') {
      return {
        database: 'MaÊ¼lumotlar bazasi',
        noDateSelected: 'Sana tanlanmagan',
        allOrders: 'Barcha buyurtmalar',
        profileCenter: 'Profil markazi',
        profileCenterDescription: 'Xavfsizlik, akkaunt holati va tezkor navigatsiya bir joyda',
        role: 'Rol',
        visibleTabs: 'Ko‘rinadigan tablar',
        dispatchDate: 'Jo‘natish sanasi',
        dispatchChooseDate: 'Sanani tanlang',
        dispatchSave: 'Saqlash',
        dispatchStart: 'Boshlash',
        security: 'Xavfsizlik',
        securityDescription: 'Akkauntga kirishni himoya qiling va sessiyalarni tez yakunlang.',
        changePassword: 'Parolni o‘zgartirish',
        quickNavigation: 'Tezkor navigatsiya',
        warehouseStartPoint: 'Ombor boshlang‘ich nuqtasi',
        warehouseStartPointDescription: 'Barcha kuryerlar uchun marshrut qurish va saralashda ishlatiladi.',
        warehouseInputLabel: 'Google Maps havolasi yoki koordinatalar (lat,lng)',
        readOnly: '(faqat o‘qish)',
        warehousePlaceholder: 'Misol: 41.311081,69.240562',
        current: 'Joriy',
        notConfigured: 'sozlanmagan',
        preview: 'Ko‘rib chiqish',
        refresh: 'Yangilash',
        saving: 'Saqlanmoqda...',
        saveLocation: 'Joylashuvni saqlash',
        useMyLocation: 'Mening joylashuvim',
        geolocationUnsupported: 'Geolokatsiya ushbu brauzerda qo‘llab-quvvatlanmaydi.',
        geolocationDenied: 'Geolokatsiyaga ruxsat berilmadi.',
        geolocationFailed: 'Joriy joylashuvni aniqlab bo‘lmadi.',
        geolocationSet: 'Nuqta geolokatsiya orqali o‘rnatildi.',
        messages: 'Xabarlar',
        messagesDescription: 'Jamoa suhbatlari va tezkor muvofiqlashtirish.',
        ordersBin: 'Buyurtmalar savati',
        clientsBin: 'Mijozlar savati',
        autoSet: 'Avto (faol global to‘plam)',
        active: '(Faol)',
        enableAutoOrderCreation: 'Buyurtmalarni avtomatik yaratishni yoqish',
        searchClientPlaceholder: 'Mijozni qidirish...',
        searchClientsAria: 'Mijozlarni qidirish',
        clear: 'Tozalash',
        calendar: 'Kalendar',
        today: 'Bugun',
        clearDate: 'Sanani tozalash',
        allTime: 'Barcha vaqt',
        thisWeek: 'Shu hafta',
        thisMonth: 'Shu oy',
        next: 'Keyingi',
        yesterday: 'Kecha',
        tomorrow: 'Ertaga',
        searchOrdersPlaceholder: 'Ism, manzil yoki buyurtma raqami bo‘yicha qidirish...',
        searchOrdersAria: 'Buyurtmalarni qidirish',
        rows: 'qator',
        filters: 'filtr',
        resetFilters: 'Filtrlarni tozalash',
        noOrdersFound: 'Buyurtmalar topilmadi',
        noOrdersFoundDescription: 'Filtrlar yoki qidiruv so‘rovini o‘zgartiring.',
        showing: 'Ko‘rsatilmoqda',
        of: 'dan',
        statusFilter: 'Holat filtri',
        allClients: 'Barcha mijozlar',
        activeOnly: 'Faqat faol',
        pausedOnly: 'Faqat to‘xtatilgan',
        bin: 'Savat',
        createClient: 'Mijoz yaratish',
        editClient: 'Mijozni tahrirlash',
        updateClientDetails: 'Mijoz maÊ¼lumotlarini yangilang.',
        createClientDescription: 'Tizimda yangi mijoz yarating.',
        nickname: 'Laqab',
        nicknamePlaceholder: 'Misol: Ofis, Uy... (ixtiyoriy)',
        mapLink: 'Xarita havolasi',
        map: 'Xarita',
        mapHint: 'Nuqtani tanlash uchun xaritaga bosing (marker-ni sudrab ham bo‘ladi).',
        phoneFormat: 'Format: +998 XX XXX XX XX',
        balance: 'Balans',
        days: 'Kunlar',
        daysShort: 'kun',
      }
    }

    return {
      database: 'Database',
      noDateSelected: 'No date selected',
      allOrders: 'All orders',
      profileCenter: 'Profile center',
      profileCenterDescription: 'Security, account context, and quick navigation from one place',
      role: 'Role',
      visibleTabs: 'Visible tabs',
      dispatchDate: 'Dispatch date',
      dispatchChooseDate: 'Choose date',
      dispatchSave: 'Save',
      dispatchStart: 'Start',
      security: 'Security',
      securityDescription: 'Protect account access and end sessions quickly.',
      changePassword: 'Change password',
      quickNavigation: 'Quick navigation',
      warehouseStartPoint: 'Warehouse start point',
      warehouseStartPointDescription: 'Used for route generation and sorting for all couriers.',
      warehouseInputLabel: 'Google Maps URL or coordinates (lat,lng)',
      readOnly: '(read only)',
      warehousePlaceholder: 'Example: 41.311081,69.240562',
      current: 'Current',
      notConfigured: 'not configured',
      preview: 'Preview',
      refresh: 'Refresh',
      saving: 'Saving...',
      saveLocation: 'Save location',
      useMyLocation: 'Use my location',
      geolocationUnsupported: 'Geolocation is not supported by this browser.',
      geolocationDenied: 'Geolocation permission denied.',
      geolocationFailed: 'Failed to get current location.',
      geolocationSet: 'Location set from device.',
      messages: 'Messages',
      messagesDescription: 'Team conversations and quick coordination.',
      ordersBin: 'Orders bin',
      clientsBin: 'Clients bin',
      autoSet: 'Auto (active global set)',
      active: '(Active)',
      enableAutoOrderCreation: 'Enable automatic order creation',
      searchClientPlaceholder: 'Search client...',
      searchClientsAria: 'Search clients',
      clear: 'Clear',
        calendar: 'Calendar',
        today: 'Today',
        clearDate: 'Clear date',
        allTime: 'All time',
        thisWeek: 'This week',
        thisMonth: 'This month',
        next: 'Next',
        yesterday: 'Yesterday',
        tomorrow: 'Tomorrow',
      searchOrdersPlaceholder: 'Search by name, address, or order number...',
      searchOrdersAria: 'Search orders',
      rows: 'rows',
      filters: 'filters',
      resetFilters: 'Reset filters',
      noOrdersFound: 'No orders found',
      noOrdersFoundDescription: 'Adjust the filters or search query.',
      showing: 'Showing',
      of: 'of',
      statusFilter: 'Status filter',
      allClients: 'All clients',
      activeOnly: 'Active only',
      pausedOnly: 'Paused only',
      bin: 'Bin',
      createClient: 'Create client',
      editClient: 'Edit client',
      updateClientDetails: 'Update the client details.',
      createClientDescription: 'Create a new client in the system.',
      nickname: 'Nickname',
      nicknamePlaceholder: 'Example: Office, Home... (optional)',
      mapLink: 'Map link',
      map: 'Map',
      mapHint: 'Click the map to pick a point (you can also drag the marker).',
      phoneFormat: 'Format: +998 XX XXX XX XX',
      balance: 'Balance',
      days: 'Days',
      daysShort: 'd',
    }
  }, [language])
  const selectedDateISO = selectedDate ? toLocalIsoDate(selectedDate) : ''
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString(dateLocale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    : profileUiText.noDateSelected

  const selectedPeriodLabel = useMemo(() => {
    if (!selectedPeriod?.from) return profileUiText.allTime ?? profileUiText.noDateSelected

    const from = selectedPeriod.from
    const to = selectedPeriod.to ?? selectedPeriod.from
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    const fromLabel = from.toLocaleDateString(dateLocale, opts)
    const toLabel = to.toLocaleDateString(dateLocale, opts)
    return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`
  }, [dateLocale, profileUiText.allTime, profileUiText.noDateSelected, selectedPeriod])

  const dispatchOrders = useMemo(() => {
    if (!selectedDateISO) return []
    if (!Array.isArray(orders) || orders.length === 0) return []
    return orders.filter((order: Order) => String(order.deliveryDate ?? '') === selectedDateISO)
  }, [orders, selectedDateISO])

  const applySelectedDate = useCallback((nextDate: Date | null) => {
    if (!nextDate) {
      setSelectedDate(null)
      setSelectedPeriod(undefined)
      return
    }

    const normalizedDate = new Date(nextDate)
    normalizedDate.setHours(0, 0, 0, 0)

    if (!Number.isNaN(normalizedDate.getTime())) {
      setSelectedDate(normalizedDate)
      setSelectedPeriod({ from: normalizedDate, to: normalizedDate })
      setDateCursor(normalizedDate)
    }
  }, [])

  const applySelectedPeriod = useCallback((nextPeriod: DateRange | undefined) => {
    if (!nextPeriod?.from) {
      setSelectedPeriod(undefined)
      setSelectedDate(null)
      setDateCursor(new Date())
      return
    }

    const from = new Date(nextPeriod.from)
    from.setHours(0, 0, 0, 0)
    const to = nextPeriod.to ? new Date(nextPeriod.to) : new Date(from)
    to.setHours(0, 0, 0, 0)

    setSelectedPeriod({ from, to })

    const fromIso = toLocalIsoDate(from)
    const toIso = toLocalIsoDate(to)
    if (fromIso === toIso) {
      setSelectedDate(from)
      setDateCursor(from)
    } else {
      setSelectedDate(null)
      setDateCursor(from)
    }
  }, [toLocalIsoDate])

  const shiftSelectedDate = useCallback((days: number) => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date()
    baseDate.setDate(baseDate.getDate() + days)
    applySelectedDate(baseDate)
  }, [applySelectedDate, selectedDate])

  const normalizedOrdersForSelectedDate = useMemo(() => {
    if (!selectedDate) return orders
    if (isSelectedDateToday) return orders
    if (!Array.isArray(orders) || orders.length === 0) return orders

    return orders.map((o) => {
      const status = String(o.orderStatus ?? '')
      if (status === 'PENDING' || status === 'IN_DELIVERY' || status === 'PAUSED') {
        return { ...o, orderStatus: 'NEW' }
      }
      return o
    })
  }, [isSelectedDateToday, orders, selectedDate])

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return normalizedOrdersForSelectedDate

    return normalizedOrdersForSelectedDate.filter((order) => {
      const customerName = (order.customer?.name || order.customerName || '').toLowerCase()
      const deliveryAddress = (order.deliveryAddress || '').toLowerCase()
      const orderNumber = String(order.orderNumber ?? '')

      return (
        customerName.includes(normalizedSearch) ||
        deliveryAddress.includes(normalizedSearch) ||
        orderNumber.includes(normalizedSearch)
      )
    })
  }, [normalizedOrdersForSelectedDate, searchTerm])

  const filteredClients = useMemo(() => filterResources(
    clients,
    clientSearchTerm,
    [
      { id: 'name', getValue: (client: Client) => client.name },
      { id: 'nickname', getValue: (client: Client) => client.nickName },
      { id: 'phone', getValue: (client: Client) => client.phone },
      { id: 'address', getValue: (client: Client) => client.address },
    ],
  ), [clientSearchTerm, clients])

  useEffect(() => {
    setSelectedClients((selected) => {
      const reconciled = reconcileResourceSelection(selected, clients, (client) => client.id)
      if (reconciled.size === selected.size && [...reconciled].every((id) => selected.has(id))) return selected
      return reconciled
    })
  }, [clients])

  const selectedClientsSnapshot = useMemo(
    () => clients.filter((client) => selectedClients.has(client.id)),
    [clients, selectedClients]
  )
  const shouldPauseSelectedClients =
    selectedClientsSnapshot.length > 0 && selectedClientsSnapshot.every((client) => client.isActive)

  const refreshWarehousePoint = async () => {
    setIsWarehouseLoading(true)
    try {
      const res = await fetch('/api/admin/warehouse')
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      const lat = data && typeof data.lat === 'number' ? data.lat : null
      const lng = data && typeof data.lng === 'number' ? data.lng : null
      const point = lat != null && lng != null ? ({ lat, lng } as LatLng) : null
      setWarehousePoint(point)
      setWarehousePreview(point)
      setWarehouseInput(point ? `${lat},${lng}` : '')
    } catch (error) {
      console.error('Error loading warehouse point:', error)
    } finally {
      setIsWarehouseLoading(false)
    }
  }

  useEffect(() => {
    void refreshWarehousePoint()
  }, [])

  useEffect(() => {
    if (!isUiStateHydrated || activeTab !== 'orders') return
    // Ensure future days remain drafts (server-side normalization for legacy data)
    void fetch('/api/admin/dispatch/normalize-drafts', { method: 'POST' }).catch(() => null)
  }, [activeTab, isUiStateHydrated])

  // Add effect to reset selected clients when filter changes
  useEffect(() => {
    setSelectedClients(new Set())
  }, [clientSearchTerm])

  useEffect(() => {
    if (!isOrderDetailsModalOpen || !selectedOrder?.id) {
      setSelectedOrderTimeline([])
      return
    }

    let cancelled = false
    setIsOrderTimelineLoading(true)

    void fetch(`/api/admin/orders/${selectedOrder.id}/timeline`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return
        const events = Array.isArray(data?.events) ? data.events : []
        setSelectedOrderTimeline(events)
      })
      .catch(() => {
        if (!cancelled) setSelectedOrderTimeline([])
      })
      .finally(() => {
        if (!cancelled) setIsOrderTimelineLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOrderDetailsModalOpen, selectedOrder?.id])

  useEffect(() => {
    if (isUiStateHydrated || typeof window === 'undefined') return

    try {
      const rawState = localStorage.getItem(uiStateStorageKey)
      if (!rawState) {
        setIsUiStateHydrated(true)
        return
      }

      const state = JSON.parse(rawState) as {
        activeTab?: string
        selectedDateISO?: string | null
        selectedPeriodISO?: { from: string; to: string } | null
        showFilters?: boolean
        searchTerm?: string
        clientSearchTerm?: string
      }

      if (typeof state.activeTab === 'string') setActiveTab(state.activeTab)
      if (typeof state.showFilters === 'boolean') setShowFilters(state.showFilters)
      if (typeof state.searchTerm === 'string') setSearchTerm(state.searchTerm.slice(0, 160))
      if (typeof state.clientSearchTerm === 'string') setClientSearchTerm(state.clientSearchTerm.slice(0, 160))
      if (state.selectedPeriodISO === null || state.selectedDateISO === null) {
        setSelectedPeriod(undefined)
        setSelectedDate(null)
        setDateCursor(new Date())
      } else if (state.selectedPeriodISO && typeof state.selectedPeriodISO === 'object') {
        const restoredFrom = parseLocalIsoDate(state.selectedPeriodISO.from)
        const restoredTo = parseLocalIsoDate(state.selectedPeriodISO.to)
        if (restoredFrom && restoredTo) {
          applySelectedPeriod({ from: restoredFrom, to: restoredTo })
        }
      } else if (typeof state.selectedDateISO === 'string') {
        const restoredDate = parseLocalIsoDate(state.selectedDateISO)
        if (restoredDate) {
          applySelectedPeriod({ from: restoredDate, to: restoredDate })
        }
      }
    } catch (error) {
      console.error('Unable to restore dashboard UI state:', error)
    } finally {
      setIsUiStateHydrated(true)
    }
  }, [applySelectedPeriod, isUiStateHydrated, parseLocalIsoDate, uiStateStorageKey])

  useEffect(() => {
    if (!isUiStateHydrated || typeof window === 'undefined') return

    localStorage.setItem(
      uiStateStorageKey,
      JSON.stringify({
        activeTab,
        selectedPeriodISO: selectedPeriod?.from
          ? {
              from: toLocalIsoDate(selectedPeriod.from),
              to: toLocalIsoDate(selectedPeriod.to ?? selectedPeriod.from),
            }
          : null,
        showFilters,
        searchTerm,
        clientSearchTerm,
      })
    )
  }, [
    activeTab,
    clientSearchTerm,
    isUiStateHydrated,
    searchTerm,
    selectedPeriod,
    showFilters,
    toLocalIsoDate,
    uiStateStorageKey,
  ])

  useEffect(() => {
    if (selectedPeriod?.from) setDateCursor(selectedPeriod.from)
  }, [selectedPeriod])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isEditable = !!target && (target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT')

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && activeTab === 'orders') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      if (event.key === '/' && !isEditable && activeTab === 'orders') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === 'Escape') {
        if (showFilters) {
          setShowFilters(false)
          event.preventDefault()
          return
        }
        if (activeTab === 'orders' && searchTerm) {
          setSearchTerm('')
          event.preventDefault()
        }
      }

      if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey && /^[1-9]$/.test(event.key)) {
        const tab = visibleTabs[Number(event.key) - 1]
        if (tab) {
          event.preventDefault()
          setActiveTab(tab)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTab, searchTerm, showFilters, visibleTabs])

  useEffect(() => {
    if (visibleTabs.length === 0) return
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [activeTab, visibleTabs])

  const handleLogout = async () => {
    // Clear localStorage (for backward compatibility)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    // Sign out from NextAuth (clears session cookies)
    await signOut({ callbackUrl: '/', redirect: true })
  }

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleSelectAllOrders = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)))
    }
  }

  const handleDeleteSelectedOrders = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (selectedOrders.size === 0) {
      toast.error('Пожалуйста, выберите заказы для удаления')
      return
    }

    if (!skipConfirm) {
      setIsDeleteOrdersDialogOpen(true)
      return
    }

    try {
      setIsDeletingOrders(true)
      const response = await fetch('/api/admin/orders/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Успешно удалено ${data.deletedCount} заказ(ов)`)
        setSelectedOrders(new Set())
        setIsDeleteOrdersDialogOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка удаления заказов'}`)
      }
    } catch (error) {
      console.error('Delete orders error:', error)
      toast.error('Ошибка соединения с сервером')
    } finally {
      setIsDeletingOrders(false)
    }
  }

  const handlePermanentDeleteOrders = async () => {
    if (isLowAdminView) {
      toast.error('Not allowed')
      return
    }
    if (selectedOrders.size === 0) {
      toast.error('Пожалуйста, выберите заказы для удаления')
      return
    }

    const confirmMessage = `⚠️ ВНИМАНИЕ! Вы уверены, что хотите НАВСЕГДА удалить ${selectedOrders.size} заказ(ов)?\n\nЭто действие НЕЛЬЗЯ отменить!`
    if (!confirm(confirmMessage)) {
      return
    }

    const doubleConfirm = confirm('Подтвердите еще раз: вы действительно хотите удалить эти заказы навсегда?')
    if (!doubleConfirm) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/permanent-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Успешно удалено навсегда ${data.deletedCount} заказ(ов)`)
        setSelectedOrders(new Set())
        fetchBinOrders()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка удаления заказов'}`)
      }
    } catch (error) {
      console.error('Permanent delete orders error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const handleRestoreSelectedOrders = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Пожалуйста, выберите заказы для восстановления')
      return
    }

    if (!confirm(`Вы уверены, что хотите восстановить ${selectedOrders.size} заказ(ов)?`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || `Успешно восстановлено ${data.updatedCount} заказ(ов)`)
        setSelectedOrders(new Set())
        fetchBinOrders()
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка восстановления заказов'}`)
      }
    } catch (error) {
      console.error('Restore orders error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const handleSelectAllBinOrders = () => {
    const visibleIds = visibleBinOrders.map((order: Order) => order.id).filter(Boolean)
    if (visibleIds.length === 0) return

    const allVisibleSelected = visibleIds.every((id) => selectedOrders.has(id))
    setSelectedOrders((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handlePermanentDeleteClients = async () => {
    if (isLowAdminView) {
      toast.error('Not allowed')
      return
    }
    if (selectedBinClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для удаления')
      return
    }

    const confirmMessage = `⚠️ ВНИМАНИЕ! Вы уверены, что хотите НАВСЕГДА удалить ${selectedBinClients.size} клиент(ов)?\n\nВместе с клиентами будут удалены ВСЕ их заказы и история.\n\nЭто действие НЕЛЬЗЯ отменить!`
    if (!confirm(confirmMessage)) {
      return
    }

    const doubleConfirm = confirm('Подтвердите еще раз: вы действительно хотите удалить этих клиентов навсегда?')
    if (!doubleConfirm) {
      return
    }

    try {
      const response = await fetch('/api/admin/clients/permanent-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientIds: Array.from(selectedBinClients) })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || `Успешно удалено навсегда ${data.deletedClients} клиент(ов)`)
        setSelectedBinClients(new Set())
        fetchBinClients()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка удаления клиентов'}`)
      }
    } catch (error) {
      console.error('Permanent delete clients error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const handleWarehouseInputChange = useCallback((value: string) => {
    setWarehouseInput(value)
    const coords = extractCoordsFromText(value)
    setWarehousePreview(coords)
  }, [])

  const handleWarehouseInputBlur = async () => {
    if (!warehouseInput || warehousePreview) return
    if (!isShortGoogleMapsUrl(warehouseInput)) return

    try {
      const expanded = await expandShortMapsUrl(warehouseInput)
      if (!expanded) return
      const coords = extractCoordsFromText(expanded)
      if (coords) setWarehousePreview(coords)
    } catch (error) {
      console.error('Error expanding warehouse url:', error)
    }
  }

  const formatWarehousePoint = useCallback((point: LatLng) => {
    return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`
  }, [])

  const handleWarehouseMapPick = useCallback(
    (point: LatLng) => {
      handleWarehouseInputChange(formatWarehousePoint(point))
    },
    [formatWarehousePoint, handleWarehouseInputChange]
  )

  const handleUseMyLocation = useCallback(() => {
    if (isWarehouseReadOnly) return
    if (typeof window === 'undefined') return

    if (!navigator.geolocation) {
      toast.error(profileUiText.geolocationUnsupported)
      return
    }

    setIsWarehouseGeoLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        handleWarehouseInputChange(formatWarehousePoint(point))
        toast.success(profileUiText.geolocationSet)
        setIsWarehouseGeoLocating(false)
      },
      (err) => {
        if (err && 'code' in err && err.code === 1) {
          toast.error(profileUiText.geolocationDenied)
        } else {
          toast.error(profileUiText.geolocationFailed)
        }
        setIsWarehouseGeoLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [formatWarehousePoint, handleWarehouseInputChange, isWarehouseReadOnly, profileUiText])

  const handleSaveWarehousePoint = async () => {
    if (isWarehouseReadOnly) return
    if (!warehouseInput.trim()) {
      toast.error('Укажите ссылку Google Maps или координаты')
      return
    }

    setIsWarehouseSaving(true)
    try {
      const res = await fetch('/api/admin/warehouse', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMapsLink: warehouseInput.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error((data && data.error) || 'Ошибка сохранения склада')
      }

      const lat = data && typeof data.lat === 'number' ? data.lat : null
      const lng = data && typeof data.lng === 'number' ? data.lng : null
      const point = lat != null && lng != null ? ({ lat, lng } as LatLng) : null
      setWarehousePoint(point)
      setWarehousePreview(point)
      setWarehouseInput(point ? `${lat},${lng}` : '')

      toast.success('Склад сохранён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения склада')
    } finally {
      setIsWarehouseSaving(false)
    }
  }

  const handleAddressChange = async (value: string) => {
    setOrderFormData(prev => ({ ...prev, deliveryAddress: value }))

    const parsed = await parseGoogleMapsUrl(value)
    setParsedCoords(parsed)
    setOrderFormData(prev => ({
      ...prev,
      latitude: parsed?.lat ?? null,
      longitude: parsed?.lng ?? null
    }))
  }

  const handleClientAddressChange = async (value: string) => {
    setClientFormData(prev => ({ ...prev, googleMapsLink: value }))

    if (!value) {
      setClientFormData(prev => ({
        ...prev,
        latitude: null,
        longitude: null
      }))
      return
    }

    const parsed = await parseGoogleMapsUrl(value)
    if (parsed) {
      setClientFormData(prev => ({
        ...prev,
        latitude: parsed.lat,
        longitude: parsed.lng
      }))
    } else {
      setClientFormData(prev => ({
        ...prev,
        latitude: null,
        longitude: null
      }))
    }
  }



  const handleDeleteSelectedClients = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (selectedClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для удаления')
      return
    }

    if (!skipConfirm) {
      setIsDeleteClientsDialogOpen(true)
      return
    }

    try {
      setIsMutatingClients(true)
      const response = await fetch('/api/admin/clients/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedClients),
          deleteOrders: true,
          daysBack: 30
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Успешно удалено:\n- ${data.deletedClients} клиент(ов)\n- ${data.deletedOrders} заказ(ов)`)
        setSelectedClients(new Set())
        setIsDeleteClientsDialogOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка удаления клиентов'}`)
      }
    } catch (error) {
      console.error('Delete clients error:', error)
      toast.error('Ошибка соединения с сервером')
    } finally {
      setIsMutatingClients(false)
    }
  }

  const handleClientSelect = (clientId: string) => {
    if (clientId && clientId !== "manual") {
      const selectedClient = clients.find(client => client.id === clientId)
      if (selectedClient) {
        setOrderFormData(prev => ({
          ...prev,
          selectedClientId: clientId,
          customerName: selectedClient.name,
          customerPhone: selectedClient.phone,
          deliveryAddress: selectedClient.address,
          calories: selectedClient.calories,
          specialFeatures: selectedClient.specialFeatures,
          assignedSetId: selectedClient.assignedSetId || ''
        }))

        void parseGoogleMapsUrl(selectedClient.address).then(parsed => {
          setParsedCoords(parsed)
        })
      }
    } else {
      // Если клиент не выбран или выбран ручной ввод, очищаем поля но оставляем значения по умолчанию
      setOrderFormData(prev => ({
        ...prev,
        selectedClientId: clientId === "manual" ? "manual" : '',
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        calories: 1200,
        specialFeatures: '',
        assignedSetId: ''
      }))
      setParsedCoords(null)
    }
  }



  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingOrder(true)
    setOrderError('')

    try {
      const parsedCoordinates = await parseGoogleMapsUrl(orderFormData.deliveryAddress)

      const latitude = parsedCoordinates?.lat ?? null
      const longitude = parsedCoordinates?.lng ?? null

      // Add coordinates and date to order data, but keep original address
      const effectiveOrderDate = toLocalIsoDate(selectedDate ?? new Date())

      const orderDataWithCoords = {
        ...orderFormData,
        // Keep the original deliveryAddress, don't overwrite with coordinates
        latitude,
        longitude,
        date: effectiveOrderDate
      }

      let response;
      if (editingOrderId) {
        // Update existing order
        // We need to use a different endpoint or method for full update
        // Currently we only have PATCH for status/courier actions
        // Let's assume we can use the same POST endpoint but with an ID or a new PUT endpoint
        // But bulk update is limited.
        // Let's use a new action 'update_details' on the [id] route or create a new route.
        // For now, let's use the [id] route with a custom action.
        response = await fetch(`/api/orders/${editingOrderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'update_details',
            ...orderDataWithCoords
          })
        })
      } else {
        // Create new order
        response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderDataWithCoords)
        })
      }

      const data = await response.json()

      if (response.ok) {
        setIsCreateOrderModalOpen(false)
        setParsedCoords(null)
        setOrderFormData({
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryTime: '',
          quantity: 1,
          calories: 1200,
          specialFeatures: '',
          paymentStatus: 'UNPAID',
          paymentMethod: 'CASH',
          isPrepaid: false,
          amountReceived: null,
          selectedClientId: '',
          latitude: null,
          longitude: null,
          courierId: '',
          assignedSetId: ''
        })
        setEditingOrderId(null)
        fetchData()
      } else {
        setOrderError(data.error || 'Ошибка сохранения заказа')
      }
    } catch {
      setOrderError('Ошибка соединения с сервером')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handleEditOrder = (order: Order) => {
    setEditingOrderId(order.id)
    const inferredAssignedSetId =
      order.customer.assignedSetId ||
      (clients.find(c => c.phone === order.customer.phone)?.assignedSetId ?? '')
    setOrderFormData({
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      deliveryAddress: order.deliveryAddress,
      deliveryTime: order.deliveryTime,
      quantity: order.quantity,
      calories: order.calories,
      specialFeatures: order.specialFeatures || '',
      paymentStatus: order.paymentStatus as string,
      paymentMethod: order.paymentMethod as string,
      isPrepaid: order.isPrepaid,
      amountReceived: typeof order.amountReceived === 'number' ? order.amountReceived : null,
      selectedClientId: '', // We don't link back to client selection for now to avoid overwriting
      latitude: order.latitude || null,
      longitude: order.longitude || null,
      courierId: order.courierId || '',
      assignedSetId: inferredAssignedSetId
    })
    setIsCreateOrderModalOpen(true)
  }

  const handleCreateCourier = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingCourier(true)
    setCourierError('')

    try {
      const response = await fetch('/api/admin/couriers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...courierFormData,
          role: 'COURIER'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setIsCreateCourierModalOpen(false)
        setCourierFormData({ name: '', email: '', password: '', salary: '' })
        fetchData()
        toast.success('Курьер успешно создан')
      } else {
        setCourierError(data.error || 'Ошибка создания курьера')
      }
    } catch {
      setCourierError('Ошибка соединения с сервером')
    } finally {
      setIsCreatingCourier(false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingClient(true)
    setClientError('')

    try {
      const url = editingClientId
        ? `/api/admin/clients/${editingClientId}`
        : '/api/admin/clients'

      const method = editingClientId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clientFormData)
      })

      const data = await response.json()

      if (response.ok) {
        setIsCreateClientModalOpen(false)
        setClientSelectedGroupId('')
        setClientFormData({
          name: '',
          nickName: '',
          phone: '',
          address: '',
          calories: 1200,
          planType: 'CLASSIC',
          dailyPrice: 84000,
          notes: '',
          specialFeatures: '',
          deliveryDays: {
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false,
            sunday: false
          },
          autoOrdersEnabled: true,
          isActive: true,
          defaultCourierId: '',
          googleMapsLink: '',
          latitude: null,
          longitude: null,
          assignedSetId: ''
        })
        setEditingClientId(null)

        // Show success message
        const action = editingClientId ? 'обновлен' : 'создан'
        const message = `Клиент "${data.client?.name || clientFormData.name}" успешно ${action}!`
        let description = ''
        if (!editingClientId && data.autoOrdersCreated && data.autoOrdersCreated > 0) {
          description = `Автоматически создано заказов: ${data.autoOrdersCreated} (на следующие 30 дней)`
        }

        toast.success(message, { description })
        fetchData()
      } else {
        const errorMessage = data.error || `Ошибка ${editingClientId ? 'обновления' : 'создания'} клиента`
        const errorDetails = data.details ? `\n${data.details}` : ''
        setClientError(`${errorMessage}${errorDetails}`)
        toast.error(errorMessage, { description: data.details })
      }
    } catch {
      setClientError('Ошибка соединения с сервером')
    } finally {
      setIsCreatingClient(false)
    }
  }



  // Mobile View Helper - Removed duplicates from here



  const handleEditClient = (client: Client) => {
    setClientSelectedGroupId('')
    setClientFormData({
      name: client.name,
      nickName: client.nickName || '',
      phone: client.phone,
      address: client.address,
      calories: client.calories,
      planType: client.planType || 'CLASSIC',
      dailyPrice: client.dailyPrice || 84000,
      notes: client.notes || '',
      specialFeatures: client.specialFeatures || '',
      deliveryDays: client.deliveryDays || {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      },
      autoOrdersEnabled: client.autoOrdersEnabled,
      isActive: client.isActive,
      defaultCourierId: client.defaultCourierId || '',
      googleMapsLink: client.googleMapsLink || '',
      latitude: client.latitude || null,
      longitude: client.longitude || null,
      assignedSetId: client.assignedSetId || ''
    })
    setEditingClientId(client.id)
    setIsCreateClientModalOpen(true)
  }

  const handleToggleClientStatus = async (clientId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/clients/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientIds: [clientId], isActive: !currentStatus })
      })

      if (response.ok) {
        toast.success(`Клиент ${!currentStatus ? 'активирован' : 'приостановлен'}`)
        fetchData()
      } else {
        toast.error('Не удалось изменить статус клиента')
      }
    } catch (error) {
      console.error('Error toggling client status:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const _handleDeleteClient = async (clientId: string) => {
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
        }
      })

      if (response.ok) {
        fetchData()
      } else {
        const data = await response.json()
        console.error('Error deleting client:', data.error)
      }
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  const handleToggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clientId)) {
        newSet.delete(clientId)
      } else {
        newSet.add(clientId)
      }
      return newSet
    })
  }

  const handlePauseSelectedClients = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (selectedClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для приостановки')
      return
    }

    if (!skipConfirm) {
      setIsPauseClientsDialogOpen(true)
      return
    }

    try {
      setIsMutatingClients(true)
      const response = await fetch('/api/admin/clients/toggle-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedClients),
          isActive: false
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Успешно приостановлено клиентов: ${data.updatedCount}`)
        setSelectedClients(new Set())
        setIsPauseClientsDialogOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка приостановки клиентов'}`)
      }
    } catch (error) {
      console.error('Error pausing clients:', error)
      toast.error('Ошибка соединения с сервером. Пожалуйста, попробуйте еще раз.')
    } finally {
      setIsMutatingClients(false)
    }
  }

  const handleResumeSelectedClients = async ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
    if (selectedClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для возобновления')
      return
    }

    if (!skipConfirm) {
      setIsResumeClientsDialogOpen(true)
      return
    }

    try {
      setIsMutatingClients(true)
      const response = await fetch('/api/admin/clients/toggle-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedClients),
          isActive: true
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Успешно возобновлено клиентов: ${data.updatedCount}`)
        setSelectedClients(new Set())
        setIsResumeClientsDialogOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка возобновления клиентов'}`)
      }
    } catch (error) {
      console.error('Error resuming clients:', error)
      toast.error('Ошибка соединения с сервером. Пожалуйста, попробуйте еще раз.')
    } finally {
      setIsMutatingClients(false)
    }
  }

  const handleRestoreSelectedClients = async () => {
    if (selectedBinClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для восстановления')
      return
    }

    const selectedClientsList = Array.from(selectedBinClients).map(id =>
      binClients.find(c => c.id === id)?.name || 'Неизвестный клиент'
    ).join(', ')

    const hasActiveClients = binClients.some(c => selectedBinClients.has(c.id) && c.isActive)
    const confirmMessage = `Вы уверены, что хотите восстановить следующих клиентов:\n\n${selectedClientsList}\n\n${hasActiveClients ? 'Автоматические заказы будут созданы для активных клиентов.' : ''}`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch('/api/admin/clients/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedBinClients)
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || `Успешно восстановлено: ${data.restoredClients} клиентов`)
        setSelectedBinClients(new Set())
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка восстановления клиентов'}`)
      }
    } catch (error) {
      console.error('Restore clients error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const _handlePermanentDeleteSelected = async () => {
    if (selectedBinClients.size === 0) {
      toast.error('Пожалуйста, выберите клиентов для окончательного удаления')
      return
    }

    const selectedClientsList = Array.from(selectedBinClients).map(id =>
      binClients.find(c => c.id === id)?.name || 'Неизвестный клиент'
    ).join(', ')

    const confirmMessage = `⚠️ ВНИМАНИЕ! Вы уверены, что хотите НАВСЕГДА удалить следующих клиентов:\n\n${selectedClientsList}\n\nВсе данные и заказы этих клиентов будут удалены безвозвратно.\n\nЭто действие НЕЛЬЗЯ отменить!`

    if (!confirm(confirmMessage)) {
      return
    }

    const doubleConfirm = confirm('Подтвердите еще раз: вы действительно хотите удалить навсегда?')
    if (!doubleConfirm) {
      return
    }

    try {
      const response = await fetch('/api/admin/clients/permanent-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientIds: Array.from(selectedBinClients)
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || `Успешно удалено навсегда: ${data.deletedClients} клиентов`)
        setSelectedBinClients(new Set())
        fetchData()
      } else {
        const data = await response.json()
        toast.error(`Ошибка: ${data.error || 'Ошибка удаления клиентов'}`)
      }
    } catch (error) {
      console.error('Permanent delete error:', error)
      toast.error('Ошибка соединения с сервером')
    }
  }

  const _handleToggleBinClientSelection = (clientId: string) => {
    setSelectedBinClients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clientId)) {
        newSet.delete(clientId)
      } else {
        newSet.add(clientId)
      }
      return newSet
    })
  }

  const handleDeliveryDayChange = (day: string, checked: boolean) => {
    setClientFormData(prev => ({
      ...prev,
      deliveryDays: {
        ...prev.deliveryDays,
        [day]: checked
      }
    }))
  }

  const _handleOpenOrder = (orderId: string) => {
    // Find the order
    const order = orders.find(o => o.id === orderId)
    if (order) {
      setSelectedOrder(order)
      setIsOrderDetailsModalOpen(true)
    }
  }

  const _handleOpenRoute = (orderId: string) => {
    // Find the order
    const order = orders.find(o => o.id === orderId)
    if (order) {
      // For now, we'll open Google Maps with the address
      // In a real app, this could integrate with a mapping service
      const encodedAddress = encodeURIComponent(order.deliveryAddress)
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank')
    }
  }

  const DispatchActionIcon = !selectedDate
    ? CalendarDays
    : selectedDayIsActive
      ? Save
      : Play
  const dispatchActionLabel = !selectedDate
    ? profileUiText.dispatchChooseDate
    : selectedDayIsActive
      ? profileUiText.dispatchSave
      : profileUiText.dispatchStart

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-app-paper">
        <p className="text-xs tracking-wide text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-app-paper">
      <AdminDashboardHeader
        title={t.admin.dashboard}
        currentDate={currentDate}
        theme={adminSettings.theme}
        themeLabel={t.admin.theme}
        systemLabel={t.admin.system}
        darkLabel={t.admin.dark}
        lightLabel={t.admin.light}
        databaseLabel={profileUiText.database}
        messagesLabel={profileUiText.messages}
        settingsLabel={t.admin.settings}
        logoutLabel={t.common.logout}
        isMiddleAdminView={isMiddleAdminView}
        onThemeChange={(theme) => updateAdminSettings({ theme })}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={() => { void handleLogout() }}
      />

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        {/* Mobile PWA: full-screen dialog (like dispatch panel). Desktop: centered large modal. */}
        <DialogContent className="!left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !max-w-none h-[100svh] !rounded-none !border-0 gap-0 !p-0 sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:h-[min(98dvh,1560px)] sm:max-w-[min(96vw,1600px)] md:h-[min(98dvh,1800px)] md:max-w-[min(98vw,1800px)] sm:!rounded-3xl sm:!border">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-background px-4 py-3">
              <DialogTitle>{profileUiText.messages}</DialogTitle>
              <DialogDescription>{profileUiText.messagesDescription}</DialogDescription>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatCenter />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        {/* Mobile PWA: full-screen dialog. Desktop: centered large modal. */}
        <DialogContent className="!left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !max-w-none h-[100svh] !rounded-none !border-0 gap-0 !p-0 sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:h-[min(98dvh,1560px)] sm:max-w-[min(96vw,1600px)] md:h-[min(98dvh,1800px)] md:max-w-[min(98vw,1800px)] sm:!rounded-3xl sm:!border">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-background px-4 py-3">
              <DialogTitle>{t.admin.settings}</DialogTitle>
              <DialogDescription>
                {profileUiText.warehouseStartPoint} / {profileUiText.database}
              </DialogDescription>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-6">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <IconButton
                  label={profileUiText.changePassword}
                  onClick={() => setIsChangePasswordOpen(true)}
                  variant="outline"
                  iconSize="md"
                >
                  <User className="h-4 w-4" />
                </IconButton>
              </div>

              {!isLowAdminView && <SiteBuilderCard />}

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>{profileUiText.warehouseStartPoint}</CardTitle>
                  <CardDescription>{profileUiText.warehouseStartPointDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="warehousePointSettings">
                      {profileUiText.warehouseInputLabel}
                      {isWarehouseReadOnly && (
                        <span className="ml-2 text-xs text-muted-foreground">{profileUiText.readOnly}</span>
                      )}
                    </Label>
                    <Input
                      id="warehousePointSettings"
                      value={warehouseInput}
                      onChange={(event) => handleWarehouseInputChange(event.target.value)}
                      onBlur={() => void handleWarehouseInputBlur()}
                      placeholder={profileUiText.warehousePlaceholder}
                      disabled={isWarehouseReadOnly || isWarehouseLoading || isWarehouseSaving}
                    />
                    <div className="text-xs text-muted-foreground">
                      {warehousePoint
                        ? `${profileUiText.current}: ${warehousePoint.lat.toFixed(6)}, ${warehousePoint.lng.toFixed(6)}`
                        : `${profileUiText.current}: ${profileUiText.notConfigured}`}
                      {warehousePreview && (
                        <span className="ml-2 text-muted-foreground/80">
                          {profileUiText.preview}: {warehousePreview.lat.toFixed(6)}, {warehousePreview.lng.toFixed(6)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-48 w-full overflow-hidden rounded-md border bg-muted/20">
                    <WarehouseStartPointPickerMap
                      value={warehousePreview ?? warehousePoint}
                      disabled={isWarehouseReadOnly || isWarehouseLoading || isWarehouseSaving}
                      onChange={handleWarehouseMapPick}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <IconButton
                      label={profileUiText.refresh}
                      variant="outline"
                      iconSize="md"
                      onClick={() => void refreshWarehousePoint()}
                      disabled={isWarehouseLoading || isWarehouseSaving}
                    >
                      <RefreshCw className={isWarehouseLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </IconButton>
                    <IconButton
                      label={profileUiText.useMyLocation}
                      variant="outline"
                      iconSize="md"
                      onClick={handleUseMyLocation}
                      disabled={isWarehouseReadOnly || isWarehouseSaving || isWarehouseLoading || isWarehouseGeoLocating}
                    >
                      <LocateFixed className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={isWarehouseSaving ? profileUiText.saving : profileUiText.saveLocation}
                      iconSize="md"
                      onClick={() => void handleSaveWarehousePoint()}
                      disabled={isWarehouseReadOnly || isWarehouseSaving || isWarehouseLoading || !warehouseInput.trim()}
                    >
                      <Save className="h-4 w-4" />
                    </IconButton>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

            <div className="flex flex-col md:flex-row flex-1 py-3 md:py-6 px-2 md:px-4 gap-3 md:gap-5 pb-24 md:pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row flex-1 w-full gap-3 md:gap-5">
          <DesktopTabsNav
            visibleTabs={visibleTabs}
            copy={tabsCopy}
          />
          <MobileBottomTabsNav
            visibleTabs={visibleTabs}
            copy={tabsCopy}
          />

          <main className="flex-1 min-w-0">
            <div className="content-card h-full flex flex-col gap-4 md:gap-6 relative overflow-hidden px-3 md:px-8 py-4 md:py-6 bg-gourmet-cream dark:bg-dark-surface rounded-[30px] md:rounded-[40px] shadow-2xl border-none transition-colors duration-300">
              {/* Background Watermark */}
              <div className="absolute top-10 right-10 opacity-5 dark:opacity-10 pointer-events-none">
                <CookingPot className="w-64 h-64 text-gourmet-ink dark:text-dark-text" />
              </div>

          {!isMiddleAdminView && (
            <>
              <StatisticsTab
                stats={stats}
                copy={t.admin.stats}
              />
            </>
          )}

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <OrdersTab
              copy={{
                title: t.admin.manageOrders,
                description: t.admin.manageOrdersDesc,
                createOrder: t.admin.createOrder,
                deleteSelected: t.admin.deleteSelected,
                loading: t.common.loading,
              }}
              profileCopy={{
                calendar: profileUiText.calendar,
                today: profileUiText.today,
                clearDate: profileUiText.clearDate,
                yesterday: profileUiText.yesterday,
                tomorrow: profileUiText.tomorrow,
                thisWeek: profileUiText.thisWeek,
                thisMonth: profileUiText.thisMonth,
                allTime: profileUiText.allTime,
                refresh: profileUiText.refresh,
                searchOrdersPlaceholder: profileUiText.searchOrdersPlaceholder,
                noOrdersFound: profileUiText.noOrdersFound,
                noOrdersFoundDescription: profileUiText.noOrdersFoundDescription,
              }}
              dateLocale={dateLocale}
              selectedDate={selectedDate}
              selectedDateLabel={selectedPeriodLabel}
              selectedPeriod={selectedPeriod}
              applySelectedDate={applySelectedDate}
              shiftSelectedDate={shiftSelectedDate}
              applySelectedPeriod={applySelectedPeriod}
              onRefresh={() => void handleRefreshAll()}
              isLoading={isLoading}
              isDashboardRefreshing={isDashboardRefreshing}
              onCreateOrder={() => setIsCreateOrderModalOpen(true)}
              onOpenDispatch={() => setIsDispatchOpen(true)}
              dispatchActionLabel={dispatchActionLabel}
              dispatchIcon={DispatchActionIcon}
              selectedDateAvailable={Boolean(selectedDate)}
              selectedOrdersSize={selectedOrders.size}
              isDeletingOrders={isDeletingOrders}
              onOpenDeleteDialog={() => setIsDeleteOrdersDialogOpen(true)}
              onClearSelection={() => setSelectedOrders(new Set())}
              searchInputRef={searchInputRef}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              filteredOrders={filteredOrders}
              selectedOrders={selectedOrders}
              onSelectOrder={handleOrderSelect}
              onSelectAll={handleSelectAllOrders}
              onEditOrder={handleEditOrder}
              onViewOrder={(order) => {
                setSelectedOrder(order)
                setIsOrderDetailsModalOpen(true)
              }}
            />
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <Card className="border bg-card">
              <CardHeader className="space-y-4 pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle>{t.admin.manageClients}</CardTitle>
                    <CardDescription>
                      {t.admin.manageClientsDesc}
                    </CardDescription>
                  </div>
                  <ResourceActionBar
                    searchValue={clientSearchTerm}
                    onSearchChange={setClientSearchTerm}
                    searchPlaceholder={profileUiText.searchClientPlaceholder}
                    selectedCount={selectedClients.size}
                    onClearSelection={() => setSelectedClients(new Set())}
                    className="w-full border-0 pb-0 sm:w-auto sm:flex-1 sm:border-0 sm:pb-0"
                  >
                    <CalendarDateSelector
                      selectedDate={selectedDate}
                      applySelectedDate={applySelectedDate}
                      shiftSelectedDate={shiftSelectedDate}
                      selectedDateLabel={selectedPeriodLabel}
                      selectedPeriod={selectedPeriod}
                      applySelectedPeriod={applySelectedPeriod}
                      locale={dateLocale}
                      profileUiText={profileUiText}
                    />
                    <RefreshIconButton
                      label={profileUiText.refresh}
                      onClick={() => void handleRefreshAll()}
                      isLoading={isLoading || isDashboardRefreshing}
                      iconSize="md"
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setEditingClientId(null)
                        setClientSelectedGroupId('')
                        setClientFormData({
                          name: '',
                          nickName: '',
                          phone: '',
                          address: '',
                          calories: 1200,
                          planType: 'CLASSIC',
                          dailyPrice: 84000,
                          notes: '',
                          specialFeatures: '',
                          deliveryDays: {
                            monday: false,
                            tuesday: false,
                            wednesday: false,
                            thursday: false,
                            friday: false,
                            saturday: false,
                            sunday: false,
                          },
                          autoOrdersEnabled: true,
                          isActive: true,
                          defaultCourierId: '',
                          googleMapsLink: '',
                          latitude: null,
                          longitude: null,
                          assignedSetId: '',
                        })
                        setClientError('')
                        setIsCreateClientModalOpen(true)
                      }}
                      aria-label={profileUiText.createClient}
                      data-testid="client-create-button"
                      title={profileUiText.createClient}
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        shouldPauseSelectedClients
                          ? setIsPauseClientsDialogOpen(true)
                          : setIsResumeClientsDialogOpen(true)
                      }
                      disabled={selectedClients.size === 0 || isMutatingClients}
                      aria-label={shouldPauseSelectedClients ? t.admin.pause : t.admin.resume}
                      title={shouldPauseSelectedClients ? t.admin.pause : t.admin.resume}
                    >
                      {shouldPauseSelectedClients ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setIsDeleteClientsDialogOpen(true)}
                      disabled={selectedClients.size === 0 || isMutatingClients}
                      aria-label={`${t.admin.deleteSelected} (${selectedClients.size})`}
                      title={`${t.admin.deleteSelected} (${selectedClients.size})`}
                    >
                      {isMutatingClients ? (
                        <span className="text-xs">{t.common.loading}</span>
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                    {selectedClients.size > 0 && (
                      <Badge variant="secondary" className="h-7 px-2 text-xs">
                        {selectedClients.size}
                      </Badge>
                    )}
                  </ResourceActionBar>
                </div>
                <ClientEditorDialog
                      open={isCreateClientModalOpen}
                      onOpenChange={setIsCreateClientModalOpen}
                      editingClientId={editingClientId}
                      clientFormData={clientFormData}
                      setClientFormData={setClientFormData}
                      clientSelectedGroupId={clientSelectedGroupId}
                      setClientSelectedGroupId={setClientSelectedGroupId}
                      clientGroupOptions={clientGroupOptions}
                      clientSelectedGroup={clientSelectedGroup}
                      availableSets={availableSets}
                      couriers={couriers}
                      clientError={clientError}
                      isCreatingClient={isCreatingClient}
                      texts={{
                        createTitle: profileUiText.createClient,
                        editTitle: profileUiText.editClient,
                        createDescription: profileUiText.createClientDescription,
                        editDescription: profileUiText.updateClientDetails,
                        nickname: profileUiText.nickname,
                        nicknamePlaceholder: profileUiText.nicknamePlaceholder,
                        phoneFormat: profileUiText.phoneFormat,
                        mapLink: profileUiText.mapLink,
                        map: profileUiText.map,
                        mapHint: profileUiText.mapHint,
                        autoSet: profileUiText.autoSet,
                        active: profileUiText.active,
                        enableAutoOrderCreation: profileUiText.enableAutoOrderCreation,
                        saving: profileUiText.saving,
                        cancel: t.common.cancel,
                        save: t.common.save,
                        create: t.admin.create,
                      }}
                      onSubmit={handleCreateClient}
                      onAddressChange={handleClientAddressChange}
                      onDeliveryDayChange={handleDeliveryDayChange}
                    />
              </CardHeader>
              <CardContent>
                <ClientDirectoryTable
                  clients={filteredClients}
                  orders={orders}
                  selectedClientIds={selectedClients}
                  clientFinanceById={clientFinanceById}
                  isClientFinanceLoading={isClientFinanceLoading}
                  dateLocale={dateLocale}
                  labels={{
                    name: t.common.name,
                    nickname: profileUiText.nickname,
                    phone: t.common.phone,
                    balance: profileUiText.balance,
                    days: profileUiText.days,
                    address: t.common.address,
                    status: t.common.status,
                    actions: t.admin.table.actions,
                    active: t.admin.table.active,
                    paused: t.admin.table.paused,
                    calories: 'Calories',
                    orders: 'Orders',
                    deliveryDays: 'Delivery days',
                    notes: 'Notes',
                    created: 'Created',
                    emptyTitle: 'Клиенты не найдены',
                    emptyDescription: 'Измените фильтры или поисковый запрос.',
                  }}
                  onSelectAll={(selected) => setSelectedClients(selected ? new Set(filteredClients.map((client) => client.id)) : new Set())}
                  onToggleSelection={handleToggleClientSelection}
                  onToggleStatus={handleToggleClientStatus}
                  onEdit={handleEditClient}
                />
              </CardContent>
            </Card>
          </TabsContent >

          {isDispatchOpen && (
            <DispatchMapPanel
              open={isDispatchOpen}
              onOpenChange={setIsDispatchOpen}
              orders={dispatchOrders}
              couriers={couriers}
              selectedDateLabel={selectedDate ? selectedDateLabel : profileUiText.allOrders}
              selectedDateISO={selectedDateISO || undefined}
              warehousePoint={warehousePoint}
              onSaved={fetchData}
            />
          )}

          {/* Admins Tab */}
          <AdminsTab 
            lowAdmins={lowAdmins} 
            isLowAdminView={isLowAdminView} 
            onRefresh={fetchData} 
            tabsCopy={tabsCopy} 
            orders={orders}
            selectedDate={selectedDate}
            applySelectedDate={applySelectedDate}
            shiftSelectedDate={shiftSelectedDate}
            selectedDateLabel={selectedPeriodLabel}
            selectedPeriod={selectedPeriod}
            applySelectedPeriod={applySelectedPeriod}
            selectedPeriodLabel={selectedPeriodLabel}
            profileUiText={profileUiText}
          />

          {/* History Tab */}
          <TabsContent value="history" className="space-y-5 animate-fade-in">
            <div className="glass-card rounded-base border-2 border-border bg-background/35 p-3 shadow-shadow backdrop-blur-md sm:p-4">
              <HistoryTable
                role={meRole || 'MIDDLE_ADMIN'}
                limit={50}
                selectedDate={selectedDate}
                applySelectedDate={applySelectedDate}
                shiftSelectedDate={shiftSelectedDate}
                selectedDateLabel={selectedPeriodLabel}
                selectedPeriod={selectedPeriod}
                applySelectedPeriod={applySelectedPeriod}
                selectedPeriodLabel={selectedPeriodLabel}
                profileUiText={profileUiText}
              />
            </div>
          </TabsContent>

          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
          />

          <TabsContent value="bin" className="space-y-4">
            <Tabs defaultValue="orders" className="w-full">
              <TabsList>
                <TabsTrigger value="orders">{t.admin.deletedOrders}</TabsTrigger>
                <TabsTrigger value="clients">{t.admin.deletedClients}</TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="space-y-4">
                <DeletedOrdersPanel
                  title={profileUiText.ordersBin}
                  deleteLabel={t.admin.deleteSelected}
                  restoreLabel={t.admin.restoreSelected}
                  refreshLabel={profileUiText.refresh}
                  searchPlaceholder={t.admin.searchPlaceholder}
                  orders={visibleBinOrders}
                  selectedOrders={selectedOrders}
                  onDeleteSelected={handlePermanentDeleteOrders}
                  onRestoreSelected={handleRestoreSelectedOrders}
                  onRefresh={() => void handleRefreshBinOrders()}
                  isRefreshing={isBinOrdersRefreshing}
                  searchValue={binOrdersSearch}
                  onSearchChange={setBinOrdersSearch}
                  onSelectOrder={handleOrderSelect}
                  onSelectAll={handleSelectAllBinOrders}
                  onViewOrder={(order) => {
                    setSelectedOrder(order)
                    setIsOrderDetailsModalOpen(true)
                  }}
                />
              </TabsContent>

              <TabsContent value="clients" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold tracking-tight">{profileUiText.clientsBin}</h2>
                  {/* Orders-tab style: wrap on mobile so actions never disappear off-screen. */}
                  <ResourceActionBar
                    searchValue={binClientsSearch}
                    onSearchChange={setBinClientsSearch}
                    searchPlaceholder={t.admin.searchPlaceholder}
                    selectedCount={selectedBinClients.size}
                    onClearSelection={() => setSelectedBinClients(new Set())}
                    className="w-full border-0 pb-0 sm:w-auto sm:flex-1 sm:border-0 sm:pb-0"
                  >
                    <IconButton
                      label={t.admin.deleteSelected}
                      onClick={handlePermanentDeleteClients}
                      variant="destructive"
                      disabled={selectedBinClients.size === 0}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t.admin.restoreSelected}
                      onClick={handleRestoreSelectedClients}
                      variant="outline"
                      disabled={selectedBinClients.size === 0}
                    >
                      <History className="size-4" />
                    </IconButton>
                    <RefreshIconButton
                      label={profileUiText.refresh}
                      onClick={() => void handleRefreshBinClients()}
                      isLoading={isBinClientsRefreshing}
                      iconSize="md"
                    />
                  </ResourceActionBar>
                </div>

                <div className="rounded-md border">
                  <DeletedClientsTable
                  clients={visibleBinClients}
                  selectedClients={selectedBinClients}
                  onToggleAll={(checked) => {
                    if (checked) {
                      setSelectedBinClients((current) => new Set([
                        ...Array.from(current),
                        ...visibleBinClients.map((client) => client.id),
                      ]))
                    } else {
                      setSelectedBinClients((current) => {
                        const next = new Set(current)
                        visibleBinClients.forEach((client) => next.delete(client.id))
                        return next
                      })
                    }
                  }}
                  onToggleClient={(clientId, checked) => {
                    const next = new Set(selectedBinClients)
                    if (checked) next.add(clientId)
                    else next.delete(clientId)
                    setSelectedBinClients(next)
                  }}
                  labels={{
                    name: t.admin.table.name,
                    phone: t.admin.table.phone,
                    address: t.admin.table.address,
                    date: t.common.date,
                    role: t.admin.table.role,
                    empty: t.finance.noClients,
                  }}
                  locale={language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US'}
                />
                </div>
              </TabsContent>
            </Tabs>

          </TabsContent>

          {/* Warehouse Tab */}
          <TabsContent value="warehouse" className="space-y-4">
            <WarehouseTab />
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance" className="space-y-4">
            <FinanceTab
              selectedDate={selectedDate}
              applySelectedDate={applySelectedDate}
              shiftSelectedDate={shiftSelectedDate}
              selectedDateLabel={selectedPeriodLabel}
              selectedPeriod={selectedPeriod}
              applySelectedPeriod={applySelectedPeriod}
              selectedPeriodLabel={selectedPeriodLabel}
              profileUiText={profileUiText}
            />
          </TabsContent>


        
      {/* Bulk edit modals intentionally removed for compact CRM layout */}

      <AlertDialog open={isDeleteOrdersDialogOpen} onOpenChange={setIsDeleteOrdersDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные заказы?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено заказов: {selectedOrders.size}. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOrders}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingOrders}
              onClick={() => void handleDeleteSelectedOrders({ skipConfirm: true })}
            >
              {isDeletingOrders ? t.common.loading : t.admin.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isPauseClientsDialogOpen} onOpenChange={setIsPauseClientsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Приостановить выбранных клиентов?</AlertDialogTitle>
            <AlertDialogDescription>
              Клиентов: {selectedClients.size}. Они не будут получать автоматические заказы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingClients}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutatingClients}
              onClick={() => void handlePauseSelectedClients({ skipConfirm: true })}
            >
              {isMutatingClients ? t.common.loading : 'Приостановить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResumeClientsDialogOpen} onOpenChange={setIsResumeClientsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Возобновить выбранных клиентов?</AlertDialogTitle>
            <AlertDialogDescription>
              Клиентов: {selectedClients.size}. Автоматические заказы снова будут включены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingClients}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutatingClients}
              onClick={() => void handleResumeSelectedClients({ skipConfirm: true })}
            >
              {isMutatingClients ? t.common.loading : 'Возобновить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteClientsDialogOpen} onOpenChange={setIsDeleteClientsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранных клиентов?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены клиенты: {selectedClients.size}, а также связанные авто-заказы за последние 30 дней.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutatingClients}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutatingClients}
              onClick={() => void handleDeleteSelectedClients({ skipConfirm: true })}
            >
              {isMutatingClients ? t.common.loading : t.admin.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Details Modal */}
      < Dialog open={isOrderDetailsModalOpen} onOpenChange={setIsOrderDetailsModalOpen} >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Детали заказа #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Полная информация о заказе и клиенте
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {selectedOrder && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Статус:</span>
                    <Badge
                      className={
                        selectedOrder.orderStatus === 'DELIVERED'
                          ? "bg-green-100 text-green-800"
                          : selectedOrder.orderStatus === 'IN_DELIVERY'
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                      }
                    >
                      {selectedOrder.orderStatus === 'DELIVERED'
                        ? "Доставлен"
                        : selectedOrder.orderStatus === 'IN_DELIVERY'
                          ? "В доставке"
                          : "Ожидает"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Оплата:</span>
                    <Badge
                      variant={selectedOrder.paymentStatus === 'PAID' ? "default" : "destructive"}
                      className={selectedOrder.paymentStatus === 'PAID' ? "bg-green-100 text-green-800" : ""}
                    >
                      {selectedOrder.paymentStatus === 'PAID' ? "Оплачен" : "Не оплачен"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Метод:</span>
                    <span className="text-sm">{selectedOrder.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Количество:</span>
                    <span className="text-sm font-bold">{selectedOrder.quantity} порц.</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Калории:</span>
                    <span className="text-sm">{selectedOrder.calories} ккал</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold text-sm">Операционные детали</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-slate-500">Priority</span>
                    <span>{selectedOrder.priority ?? 3}</span>
                    <span className="text-slate-500">ETA</span>
                    <span>{selectedOrder.etaMinutes ? `${selectedOrder.etaMinutes} мин` : '-'}</span>
                    <span className="text-slate-500">Последнее изменение</span>
                    <span>
                      {selectedOrder.statusChangedAt
                        ? new Date(selectedOrder.statusChangedAt).toLocaleString('ru-RU')
                        : '-'}
                    </span>
                    <span className="text-slate-500">Назначен курьер</span>
                    <span>{selectedOrder.assignedAt ? new Date(selectedOrder.assignedAt).toLocaleString('ru-RU') : '-'}</span>
                    <span className="text-slate-500">Старт доставки</span>
                    <span>{selectedOrder.pickedUpAt ? new Date(selectedOrder.pickedUpAt).toLocaleString('ru-RU') : '-'}</span>
                    <span className="text-slate-500">Пауза</span>
                    <span>{selectedOrder.pausedAt ? new Date(selectedOrder.pausedAt).toLocaleString('ru-RU') : '-'}</span>
                    <span className="text-slate-500">Завершен</span>
                    <span>{selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleString('ru-RU') : '-'}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold text-sm">Клиент</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selectedOrder.customerName || selectedOrder.customer?.name}</p>
                      <p className="text-xs text-slate-500">{selectedOrder.customer?.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="font-semibold text-sm">Доставка</h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                      <p className="text-sm">{selectedOrder.deliveryAddress}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <p className="text-sm">{selectedOrder.deliveryTime}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      <p className="text-sm">
                        {selectedOrder.deliveryDate && new Date(selectedOrder.deliveryDate).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <h4 className="font-semibold text-sm">Timeline</h4>
                  {isOrderTimelineLoading ? (
                    <p className="text-xs text-muted-foreground">Loading timeline...</p>
                  ) : selectedOrderTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No events yet</p>
                  ) : (
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded border bg-muted/20 p-2">
                      {selectedOrderTimeline.map((event) => (
                        <div key={event.id} className="grid grid-cols-[140px_1fr] gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {new Date(event.occurredAt).toLocaleString('ru-RU')}
                          </span>
                          <span>
                            <span className="font-medium">{event.actorName || 'System'}</span>
                            {' - '}
                            {event.message || event.eventType}
                            {event.previousStatus || event.nextStatus
                              ? ` (${event.previousStatus || '-'} → ${event.nextStatus || '-'})`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedOrder.specialFeatures && (
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-semibold text-sm">Особенности</h4>
                    <p className="text-sm bg-orange-50 p-2 rounded border border-orange-100 text-orange-800">
                      {selectedOrder.specialFeatures}
                    </p>
                  </div>
                )}

                {selectedOrder.courierName && (
                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-semibold text-sm">Курьер</h4>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-sm">{selectedOrder.courierName}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderDetailsModalOpen(false)}>
              Закрыть
            </Button>
            {selectedOrder && (
              <Button onClick={() => {
                setIsOrderDetailsModalOpen(false)
                handleEditOrder(selectedOrder)
              }}>
                Редактировать
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Create Order Modal */}
      <OrderModal
        open={isCreateOrderModalOpen}
        onOpenChange={setIsCreateOrderModalOpen}
        editingOrderId={editingOrderId}
        setEditingOrderId={setEditingOrderId}
        orderFormData={orderFormData}
        setOrderFormData={setOrderFormData}
        clients={clients}
        couriers={couriers}
        availableSets={availableSets}
        orderError={orderError}
        isCreatingOrder={isCreatingOrder}
        onSubmit={handleCreateOrder}
        onClientSelect={handleClientSelect}
        onAddressChange={handleAddressChange}
      />

      {/* Create Courier Modal */}
      < Dialog open={isCreateCourierModalOpen} onOpenChange={setIsCreateCourierModalOpen} >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Создать Курьера</DialogTitle>
            <DialogDescription>
              Создайте новый аккаунт для курьера
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCourier}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="courierName" className="text-right">
                  Имя
                </Label>
                <Input
                  id="courierName"
                  value={courierFormData.name}
                  onChange={(e) => setCourierFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="courierEmail" className="text-right">
                  Email
                </Label>
                <Input
                  id="courierEmail"
                  type="email"
                  value={courierFormData.email}
                  onChange={(e) => setCourierFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <Label htmlFor="courierPassword" className="text-right">
                  Пароль
                </Label>
                <Input
                  id="courierPassword"
                  type="password"
                  value={courierFormData.password}
                  onChange={(e) => setCourierFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="col-span-3"
                  required
                />
              </div>
            </div>
            {courierError && (
              <Alert className="mb-4">
                <AlertDescription>{courierError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateCourierModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isCreatingCourier}>
                {isCreatingCourier ? 'Создание...' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
            </div>{/* end content-card */}
          </main>
        </Tabs>
      </div>{/* end flex container */}
    </div>
  )
}

export default AdminDashboardPage





