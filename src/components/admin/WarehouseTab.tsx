'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Package,
    Calculator,
    ShoppingCart,
    ChefHat,
    Loader2,
    UtensilsCrossed,
    Plus,
    Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
    getTomorrowsMenuNumber,
    getTomorrowsMenu,
    getMenuNumber,
    calculateIngredientsForMenu,
    calculateShoppingList,
    scaleIngredients,
    MEAL_TYPES,
    type DailyMenu,
    type Dish,
} from '@/lib/menuData';

import { IngredientsManager } from './warehouse/IngredientsManager';
import { CookingManager } from './warehouse/CookingManager'; // Integrated
import { CalendarRangeSelector } from '@/components/admin/dashboard/shared/CalendarRangeSelector'
import { RefreshIconButton } from '@/components/admin/dashboard/shared/RefreshIconButton'
import type { DateRange } from 'react-day-picker'
import { useLanguage } from '@/contexts/LanguageContext';
import { getSetDayGroups } from '@/lib/menu/set-groups';
import { parseCookingDeliveryDays } from '@/lib/warehouse/cooking-data'
import { keepDateInRange, listLocalIsoDates, toLocalIsoDate } from '@/lib/warehouse/cooking-range'
;
import {
    parseCookingPlanAuditResponse,
    parseWarehouseClients,
    parseWarehouseOrders,
    parseWarehouseSets,
    type WarehouseClient,
    type WarehouseMenuSet,
    type WarehouseOrder,
} from '@/lib/warehouse/warehouse-data';
import { SetsTab } from './SetsTab';
import { TabEmptyState } from '@/components/admin/dashboard/shared/TabEmptyState';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface WarehouseTabProps {
    className?: string;
}

export function WarehouseTab({ className }: WarehouseTabProps) {
    const { t, language } = useLanguage();

    const dateLocale = useMemo(() => {
        if (language === 'ru') return 'ru-RU'
        if (language === 'uz') return 'uz-UZ'
        return 'en-US'
    }, [language])

    const calendarRangeUiText = useMemo(() => {
        if (language === 'ru') {
            return {
                calendar: 'Календарь',
                today: 'Сегодня',
                thisWeek: 'Эта неделя',
                thisMonth: 'Этот месяц',
                clearRange: 'Сбросить',
                allTime: 'За все время',
            }
        }
        if (language === 'uz') {
            return {
                calendar: 'Kalendar',
                today: 'Bugun',
                thisWeek: 'Shu hafta',
                thisMonth: 'Shu oy',
                clearRange: 'Tozalash',
                allTime: 'Barcha vaqt',
            }
        }
        return {
            calendar: 'Calendar',
            today: 'Today',
            thisWeek: 'This week',
            thisMonth: 'This month',
            clearRange: 'Clear',
            allTime: 'All time',
        }
    }, [language])

    const auditUiText = useMemo(() => {
        if (language === 'ru') {
            return {
                setsTab: 'Сеты',
                activeSet: 'Активный (авто)',
                refreshCookingPlans: 'Обновить планы готовки',
                planned: 'Запланировано',
                cooked: 'Приготовлено',
                remaining: 'Осталось',
                failedLoadCookingPlans: 'Не удалось загрузить планы готовки',
                loadedOrdersTomorrow: (count: number) => `Загружено ${count} заказов на завтра`,
                loadedActiveClients: (count: number) => `Загружено ${count} активных клиентов`,
                clientsLoadError: 'Ошибка загрузки данных клиентов',
                warehouseLoadError: 'Ошибка загрузки данных склада',
                menuCalcDone: (menu: number) => `Расчет для меню ${menu} выполнен`,
                selectDatesForCalc: 'Выберите даты для расчета',
                periodCalcDone: (count: number) => `Расчет для ${count} дней выполнен`,
            }
        }
        if (language === 'uz') {
            return {
                setsTab: 'Setlar',
                activeSet: 'Faol (avto)',
                planned: 'Reja',
                cooked: 'Pishirildi',
                remaining: 'Qoldi',
                failedLoadCookingPlans: 'Pishirish rejalari yuklanmadi',
                loadedOrdersTomorrow: (count: number) => `Ertangi kun uchun ${count} ta buyurtma yuklandi`,
                loadedActiveClients: (count: number) => `${count} ta faol mijoz yuklandi`,
                clientsLoadError: "Mijozlar ma'lumotini yuklashda xatolik",
                warehouseLoadError: "Ombor ma'lumotini yuklashda xatolik",
                menuCalcDone: (menu: number) => `${menu}-menyu uchun hisob-kitob bajarildi`,
                selectDatesForCalc: 'Hisoblash uchun sanalarni tanlang',
                periodCalcDone: (count: number) => `${count} kun uchun hisob-kitob bajarildi`,
            }
        }
        return {
            setsTab: 'Sets',
            activeSet: 'Active (auto)',
            planned: 'Planned',
            cooked: 'Cooked',
            remaining: 'Remaining',
            failedLoadCookingPlans: 'Failed to load cooking plans',
            loadedOrdersTomorrow: (count: number) => `Loaded ${count} orders for tomorrow`,
            loadedActiveClients: (count: number) => `Loaded ${count} active clients`,
            clientsLoadError: 'Failed to load client data',
            warehouseLoadError: 'Failed to load warehouse data',
            menuCalcDone: (menu: number) => `Calculation for menu ${menu} completed`,
            selectDatesForCalc: 'Select dates to calculate',
            periodCalcDone: (count: number) => `Calculation for ${count} days completed`,
        }
    }, [language])
    const [activeSubTab, setActiveSubTab] = useState('cooking');
    const [tomorrowMenu, setTomorrowMenu] = useState<DailyMenu | undefined>(undefined);
    const [tomorrowMenuNumber, setTomorrowMenuNumber] = useState<number>(0);
    const [dishQuantities, setDishQuantities] = useState<Record<number, number>>({});
    const [inventory, setInventory] = useState<Record<string, number>>({});
    const [clientsByCalorie, setClientsByCalorie] = useState<Record<number, number>>({
        1200: 0,
        1600: 0,
        2000: 0,
        2500: 0,
        3000: 0,
    });
    const [, setIsLoadingClients] = useState(false);
    const [activeSet, setActiveSet] = useState<WarehouseMenuSet | null>(null);
    const [allClients, setAllClients] = useState<WarehouseClient[]>([]);

    const [allOrders, setAllOrders] = useState<WarehouseOrder[]>([]);
    const [availableSets, setAvailableSets] = useState<WarehouseMenuSet[]>([]);

    // Calculation state
    const [calculatedIngredients, setCalculatedIngredients] = useState<Map<string, { amount: number; unit: string }>>(new Map());
    const [shoppingList, setShoppingList] = useState<Map<string, { amount: number; unit: string }>>(new Map());
    const [selectedShoppingItems, setSelectedShoppingItems] = useState<Set<string>>(new Set());
    const [boughtShoppingItems, setBoughtShoppingItems] = useState<Set<string>>(new Set());
    const [isBuyingSelected, setIsBuyingSelected] = useState(false);
    const [inventoryPriceMeta, setInventoryPriceMeta] = useState<Record<string, { pricePerUnit: number | null; priceUnit: string; kcalPerGram: number | null }>>({});
    const [shoppingEdits, setShoppingEdits] = useState<Record<string, { amount: string; unit: string; costPerUnit: string; kcalPerGram: string }>>({});
    const [customBuyItems, setCustomBuyItems] = useState<Array<{ id: string; name: string; amount: string; unit: string; costPerUnit: string; kcalPerGram: string }>>([]);
    const [selectedCustomBuyItems, setSelectedCustomBuyItems] = useState<Set<string>>(new Set());
    const [newBuyItem, setNewBuyItem] = useState({ name: '', amount: '', unit: 'kg', costPerUnit: '', kcalPerGram: '' });
    const [calcRange, setCalcRange] = useState<DateRange | undefined>(undefined)

    // Cooking audit state (period + per-day drilldown)
    const [cookingRange, setCookingRange] = useState<DateRange | undefined>(() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
        return { from: tomorrow, to: tomorrow }
    })
    const [selectedCookingDateISO, setSelectedCookingDateISO] = useState<string>(() => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)
        const yyyy = tomorrow.getFullYear()
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
        const dd = String(tomorrow.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
    })
    const [cookingPlans, setCookingPlans] = useState<ReturnType<typeof parseCookingPlanAuditResponse>>([])
    const [isCookingPlansLoading, setIsCookingPlansLoading] = useState(false)
    const [cookingPlansError, setCookingPlansError] = useState<string>('')
    const [cookingSelectedSetId, setCookingSelectedSetId] = useState<string>('active')

    const calcRangeDays = useMemo(
        () => listLocalIsoDates(calcRange?.from, calcRange?.to, 45),
        [calcRange],
    )

    const cookingRangeDays = useMemo(
        () => listLocalIsoDates(cookingRange?.from, cookingRange?.to, 31),
        [cookingRange],
    )

    useEffect(() => {
        if (!cookingRangeDays.length) return
        const nextDate = keepDateInRange(selectedCookingDateISO, cookingRangeDays)
        if (nextDate !== selectedCookingDateISO) setSelectedCookingDateISO(nextDate)
    }, [cookingRangeDays, selectedCookingDateISO])

    const refreshCookingPlansForRange = useCallback(async () => {
        if (!cookingRange?.from) {
            setCookingPlans([])
            return
        }

        const fromIso = toLocalIsoDate(cookingRange.from)
        const toIso = toLocalIsoDate(cookingRange.to ?? cookingRange.from)

        setIsCookingPlansLoading(true)
        setCookingPlansError('')
        try {
            const response = await fetch(`/api/admin/warehouse/cooking-plan?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                setCookingPlans([])
                setCookingPlansError(data?.error || auditUiText.failedLoadCookingPlans)
                return
            }

            setCookingPlans(parseCookingPlanAuditResponse(data))
        } catch (error) {
            setCookingPlans([])
            setCookingPlansError(error instanceof Error ? error.message : auditUiText.failedLoadCookingPlans)
        } finally {
            setIsCookingPlansLoading(false)
        }
    }, [cookingRange, auditUiText.failedLoadCookingPlans])

    useEffect(() => {
        void refreshCookingPlansForRange()
    }, [refreshCookingPlansForRange])

    const cookingTotals = useMemo(() => {
        const safeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

        let planned = 0
        let cooked = 0

        for (const plan of cookingPlans) {
            const dishes = plan?.dishes && typeof plan.dishes === 'object' ? plan.dishes : {}
            for (const qty of Object.values(dishes as Record<string, unknown>)) {
                planned += safeNumber(qty)
            }

            const cookedStats = plan?.cookedStats && typeof plan.cookedStats === 'object' ? plan.cookedStats : {}
            for (const dishStats of Object.values(cookedStats as Record<string, unknown>)) {
                if (!dishStats || typeof dishStats !== 'object') continue
                for (const qty of Object.values(dishStats as Record<string, unknown>)) {
                    cooked += safeNumber(qty)
                }
            }
        }

        const remaining = Math.max(0, planned - cooked)
        return { planned, cooked, remaining }
    }, [cookingPlans])

    const selectedCookingMenuNumber = useMemo(() => {
        try {
            const date = new Date(selectedCookingDateISO)
            if (Number.isNaN(date.getTime())) return tomorrowMenuNumber
            return getMenuNumber(date)
        } catch {
            return tomorrowMenuNumber
        }
    }, [selectedCookingDateISO, tomorrowMenuNumber])

    // Set default dish quantities based on total active clients
    useEffect(() => {
        if (!tomorrowMenu) return;
        const totalClients = Object.values(clientsByCalorie).reduce((sum, count) => sum + count, 0);

        // Only set quantities if clients have been loaded (totalClients > 0)
        // If totalClients is 0, either no clients exist or data hasn't loaded yet
        // In practice, this should update once fetchClientCalories completes
        if (totalClients === 0) return;

        const initialQuantities: Record<number, number> = {};
        tomorrowMenu.dishes.forEach(dish => {
            // Default to total clients, but user can adjust
            initialQuantities[dish.id] = totalClients;
        });
        setDishQuantities(initialQuantities);
    }, [tomorrowMenu, clientsByCalorie]);

    const getDistributionForDate = useCallback((date: Date) => {
        const distribution: Record<number, number> = {
            1200: 0,
            1600: 0,
            2000: 0,
            2500: 0,
            3000: 0,
        };

        const dateStr = toLocalIsoDate(date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // 1. Try to get distribution from ACTUAL ORDERS first (Source of Truth)
        const dayOrders = allOrders.filter(o => {
            const oDate = String(o.deliveryDate ?? '').slice(0, 10)
            return oDate === dateStr
        });

        if (dayOrders.length > 0) {
            dayOrders.forEach(order => {
                const cals = order.calories || 2000;
                // Map to nearest tier
                if (cals <= 1400) distribution[1200]++;
                else if (cals <= 1800) distribution[1600]++;
                else if (cals <= 2200) distribution[2000]++;
                else if (cals <= 2800) distribution[2500]++;
                else distribution[3000]++;
            });
            return distribution;
        }

        // 2. Fallback to Client Patterns if no orders exist for this day
        allClients.forEach((client) => {
            if (client.isActive !== false) {
                // Parse deliveryDays if it's a string
                let deliveryDays = client.deliveryDays;
                if (typeof deliveryDays === 'string') {
                    try { deliveryDays = JSON.parse(deliveryDays); } catch { deliveryDays = {}; }
                }

                // Filter by delivery day if available
                if (deliveryDays && deliveryDays[dayOfWeek] === false) {
                    return;
                }

                const calories = client.calories || 2000;
                // Map to nearest tier
                if (calories <= 1400) distribution[1200]++;
                else if (calories <= 1800) distribution[1600]++;
                else if (calories <= 2200) distribution[2000]++;
                else if (calories <= 2800) distribution[2500]++;
                else distribution[3000]++;
            }
        });

        return distribution;
    }, [allClients, allOrders]);

    // Fetch client calorie distribution from database
    const fetchClientCalories = useCallback(async () => {
        setIsLoadingClients(true);
        try {
            // Fetch clients and orders in parallel
            const [clientsResponse, ordersResponse] = await Promise.all([
                fetch('/api/admin/clients'),
                fetch('/api/orders')
            ]);

            let clients: WarehouseClient[] = [];
            let orders: WarehouseOrder[] = [];

            if (clientsResponse.ok) {
                clients = parseWarehouseClients(await clientsResponse.json().catch(() => null));
                setAllClients(clients);
            }

            if (ordersResponse.ok) {
                orders = parseWarehouseOrders(await ordersResponse.json().catch(() => null));
                setAllOrders(orders);
            }

            // Calculate tomorrow's distribution for CookingManager
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const distribution: Record<number, number> = {
                1200: 0, 1600: 0, 2000: 0, 2500: 0, 3000: 0,
            };
            const dayOfWeek = tomorrow.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const tomorrowDateStr = toLocalIsoDate(tomorrow);

            // Try using orders first (they're the source of truth)
            const tomorrowOrders = orders.filter((o) => {
                const oDate = String(o.deliveryDate ?? '').slice(0, 10)
                return oDate === tomorrowDateStr
            });

            if (tomorrowOrders.length > 0) {
                tomorrowOrders.forEach((order) => {
                    const cals = order.calories || 2000;
                    const qty = order.quantity || 1;
                    if (cals <= 1400) distribution[1200] += qty;
                    else if (cals <= 1800) distribution[1600] += qty;
                    else if (cals <= 2200) distribution[2000] += qty;
                    else if (cals <= 2800) distribution[2500] += qty;
                    else distribution[3000] += qty;
                });
                setClientsByCalorie(distribution);
                toast.success(auditUiText.loadedOrdersTomorrow(tomorrowOrders.length));
                return;
            }

            // Fallback to active client patterns if no orders for tomorrow
            clients.forEach((client) => {
                if (client.isActive !== false) {
                    const deliveryDays = parseCookingDeliveryDays(client.deliveryDays);
                    if (deliveryDays[dayOfWeek as keyof typeof deliveryDays] === false) return;

                    const calories = client.calories || 2000;
                    if (calories <= 1400) distribution[1200]++;
                    else if (calories <= 1800) distribution[1600]++;
                    else if (calories <= 2200) distribution[2000]++;
                    else if (calories <= 2800) distribution[2500]++;
                    else distribution[3000]++;
                }
            });

            setClientsByCalorie(distribution);
            const totalClients = Object.values(distribution).reduce((a, b) => a + b, 0);
            toast.success(auditUiText.loadedActiveClients(totalClients));
        } catch (error) {
            console.error('Error fetching client data:', error);
            toast.error(auditUiText.clientsLoadError);
        } finally {
            setIsLoadingClients(false);
        }
    }, [auditUiText]);

    useEffect(() => {
        fetchClientCalories();
    }, [fetchClientCalories]);

    const fetchInventory = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/warehouse/ingredients');
            if (response.ok) {
                const data = await response.json().catch(() => null);
                if (!Array.isArray(data)) return;
                // Convert array to record: { "Rice": 500, ... }
                const invRecord: Record<string, number> = {};
                data.forEach((item: { name: string, amount: number }) => {
                    invRecord[item.name] = item.amount;
                });
                setInventory(invRecord);
                const priceMeta: Record<string, { pricePerUnit: number | null; priceUnit: string; kcalPerGram: number | null }> = {};
                data.forEach((item: { name?: unknown; pricePerUnit?: unknown; priceUnit?: unknown; kcalPerGram?: unknown }) => {
                    const key = String(item?.name || '').trim().toLowerCase();
                    if (!key) return;
                    priceMeta[key] = {
                        pricePerUnit: typeof item?.pricePerUnit === 'number' && Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : null,
                        priceUnit: String(item?.priceUnit || 'kg').trim() || 'kg',
                        kcalPerGram: typeof item?.kcalPerGram === 'number' && Number.isFinite(item.kcalPerGram) ? item.kcalPerGram : null,
                    };
                });
                setInventoryPriceMeta(priceMeta);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            fetchInventory();


            // Fetch cooking plan for tomorrow (based on tomorrowMenuNumber and date)
            // We need the date for tomorrow. getTomorrowsMenuNumber() implies +1 day from today roughly, 
            // but let's be precise. The menu cycle starts Dec 4.
            // Actually, we can just save/load by date.
            // Let's assume tomorrow's date for the query.
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const dateStr = toLocalIsoDate(tomorrow);

            const planResponse = await fetch(`/api/admin/warehouse/cooking-plan?date=${dateStr}`);
            if (planResponse.ok) {
                const data = await planResponse.json();
                if (data.dishes) {
                    setDishQuantities(data.dishes);
                }
            }

            // Fetch active set
            const setsResponse = await fetch('/api/admin/sets');
            if (setsResponse.ok) {
                const rawSets = await setsResponse.json().catch(() => null);
                const sets = parseWarehouseSets(rawSets);
                setAvailableSets(sets);

                const active = sets.find((s) => s.isActive);
                if (active) {
                    setActiveSet(active);

                    // If active set has dishes for tomorrow, update tomorrowMenu
                    const dayData = getSetDayGroups(active.calorieGroups, tomorrowMenuNumber);
                    if (dayData.length > 0) {
                        const uniqueDishesMap = new Map<number, Dish>();
                        dayData.forEach((group) => {
                            (group.dishes ?? []).forEach((dish) => {
                                const dishId = typeof dish.dishId === 'number' ? dish.dishId : Number(dish.dishId);
                                if (!Number.isFinite(dishId) || uniqueDishesMap.has(dishId)) return;
                                const baseDish = getTomorrowsMenu()?.dishes.find((candidate) => candidate.id === dishId);
                                uniqueDishesMap.set(dishId, {
                                    id: dishId,
                                    name: dish.dishName?.trim() || baseDish?.name || String(dishId),
                                    mealType: (dish.mealType || baseDish?.mealType || 'UNKNOWN') as keyof typeof MEAL_TYPES,
                                    ingredients: baseDish?.ingredients ?? [],
                                });
                            });
                        });
                        if (uniqueDishesMap.size > 0) {
                            setTomorrowMenu({
                                menuNumber: tomorrowMenuNumber,
                                dishes: Array.from(uniqueDishesMap.values())
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
            toast.error(auditUiText.warehouseLoadError);
        }
    }, [auditUiText.warehouseLoadError, fetchInventory, tomorrowMenuNumber]);

    // Load tomorrow's menu on mount
    useEffect(() => {
        const menuNumber = getTomorrowsMenuNumber();
        setTomorrowMenuNumber(menuNumber);
        const menu = getTomorrowsMenu();
        setTomorrowMenu(menu);

        // Note: dish quantities will be set after clientsByCalorie is loaded
        // See the effect below that depends on both menu and clientsByCalorie

        // Fetch data from API
        void fetchData();
    }, [fetchData, tomorrowMenuNumber]);

    // updateInventory removed




    const calculateForTomorrow = () => {
        // Helper to map calories to tier
        const getTier = (c: number) => c <= 1400 ? 1200 : c <= 1800 ? 1600 : c <= 2200 ? 2000 : c <= 2800 ? 2500 : 3000;

        // 1. Calculate Split Distribution
        const standardStats: Record<number, number> = { 1200: 0, 1600: 0, 2000: 0, 2500: 0, 3000: 0 };
        const setStats: Record<string, Record<number, number>> = {};

        availableSets.forEach(s => {
            setStats[s.id] = { 1200: 0, 1600: 0, 2000: 0, 2500: 0, 3000: 0 };
        });

        // Determine target date (Tomorrow)
        const date = new Date();
        date.setDate(date.getDate() + 1);
        const dateStr = toLocalIsoDate(date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Filter valid orders
        const dayOrders = allOrders.filter(o => o.deliveryDate && o.deliveryDate.startsWith(dateStr));

        if (dayOrders.length > 0) {
            dayOrders.forEach(order => {
                const client = allClients.find(c => c.id === order.customerId);
                const tier = getTier(order.calories || 2000);

                // If client has assigned set, add to that set's stats
                if (client?.assignedSetId && setStats[client.assignedSetId]) {
                    setStats[client.assignedSetId][tier] = (setStats[client.assignedSetId][tier] || 0) + (order.quantity || 1);
                } else {
                    // Else add to standard stats (or Active Global Set if we treat 'assignedSetId=null' as Active Set)
                    // Logic: If assignedSetId is null, they get the "Active Global Set" effectively.
                    // But 'calculateIngredientsForMenu' without 'activeSet' arg calculates Standard Menu. 
                    // Does 'activeSet' state in this component represent the Global Active Set? YES.
                    // So if we pass 'activeSet' to calculateIngredientsForMenu, it uses it.
                    // If we pass NULL, it uses Standard.
                    // Correct Logic: 
                    // - Unassigned clients usage should be calculated using the `activeSet` state (Global Active).
                    // - Assigned clients usage should be calculated using their specific Set.

                    // Actually, if an Active Set exists, UNASSIGNED clients should use IT.
                    // If NO Active Set exists, they use Standard.
                    // So we accumulate them in 'standardStats', but we will calculate 'standardStats' ingredients using 'activeSet' (Global).
                    standardStats[tier] = (standardStats[tier] || 0) + (order.quantity || 1);
                }
            });
        } else {
            // Fallback to Clients
            allClients.forEach(client => {
                if (client.isActive !== false) {
                    let dDays = client.deliveryDays;
                    if (typeof dDays === 'string') {
                        try { dDays = JSON.parse(dDays); } catch { dDays = {}; }
                    }
                    if (dDays && dDays[dayOfWeek] === false) return;

                    const tier = getTier(client.calories || 2000);

                    if (client.assignedSetId && setStats[client.assignedSetId]) {
                        setStats[client.assignedSetId][tier]++;
                    } else {
                        standardStats[tier]++;
                    }
                }
            });
        }

        // 2. Aggregate Ingredients
        const totalIngredients = new Map<string, { amount: number; unit: string }>();

        const mergeIngredients = (source: Map<string, { amount: number; unit: string }>) => {
            for (const [name, { amount, unit }] of source) {
                const existing = totalIngredients.get(name);
                if (existing) {
                    existing.amount += amount;
                } else {
                    totalIngredients.set(name, { amount, unit });
                }
            }
        };

        // Calculate for Assigned Sets
        for (const set of availableSets) {
            // Skip if this is the active set (already handled in global?)
            // Wait: 'activeSet' passed above IS the object found in 'availableSets' with .isActive=true.
            // So if we iterate 'availableSets' again, we will double count the active set IF 'setStats' captured data for it.
            // BUT: 'setStats' is populated by `client.assignedSetId`. 
            // Does `client.assignedSetId` get set to the Active Set ID automatically? 
            // New clients have `assignedSetId: ''` or `null`.
            // If a client is Explicitly Assigned to the Active Set, they have `assignedSetId = 'id-of-active'`.
            // Those counts went into `setStats['id-of-active']`.
            // The `standardStats` captured clients with `assignedSetId = null`.

            // So: 
            // 1. `standardStats` (Unassigned) -> Use `activeSet`.
            // 2. `setStats['non-active-id']` -> Use that set.
            // 3. `setStats['active-id']` -> Use that set (Active Set).

            // Issue: If we use `activeSet` for StandardStats, and also calculate `setStats['active-id']` separately, 
            // using `calculateIngredientsForMenu(..., set)`, it works fine. They are just two batches of people using the same set.
            // Merging them implies summing ingredients.

            // HOWEVER, `calculateIngredientsForMenu` takes `dishQuantities`. 
            // `dishQuantities` is GLOBAL dish IDs.
            // If Set A and Set B share Dish ID 100, and we adjusted its quantity...
            // `calculateIngredientsForMenu` uses `dishQuantities` logic: 
            // `const dishQty = dishQuantities?.[dish.id] ?? totalClients;`.
            // If we iterate multiple times, `dishQuantities` (e.g. 50 portions) will be applied EACH TIME?
            // E.g. Set A uses Dish 100. Set B uses Dish 100.
            // We configured "Dish 100 = 50 portions".
            // Loop 1 (Set A): Uses 50 portions? 
            // Loop 2 (Set B): Uses 50 portions?
            // Total = 100? This is wrong if we meant 50 TOTAL.

            // BUT: `dishQuantities` in standard usage is "Total portions to cook".
            // If we are calculating ingredients based on CLIENT COUNT (Predictive), we usually IGNORE `dishQuantities` unless we are in "Manual Override" mode.
            // The logic in `calculateIngredientsForMenu` uses `dishQuantities` if present.
            // If `dishQuantities` is set, `portionsForTier` depends on it.

            // Warning: If usage of `dishQuantities` overrides client counts, then splitting calculation breaks the logic 
            // because "Dish Qty 50" means "50 total", but we apply it to "Subset A" then "Subset B".

            // If `dishQuantities` are derived from TOTAL clients (which they are in useEffect), then:
            // We should NOT use global `dishQuantities` when calculating subsets, 
            // OR we should split `dishQuantities` too.
            // OR we should rely on `clientsByCalorie` count which logic falls back to if `dishQuantities` is matching?

            // Let's check `calculateIngredientsForMenu`:
            // `const dishQty = dishQuantities?.[dish.id] ?? totalClients;`
            // `const portionsForTier = (dishQty / totalClients) * clientCount;`
            // It scales `dishQty` by `clientCount / totalClients`.
            // `totalClients` here is SUM of `clientsByCalorie` passed to function.

            // So: 
            // Call 1: `clientsByCalorie` = {1200: 5}. `totalClients` = 5.
            // `dishQty` = 50 (Global).
            // `portions` = (50 / 5) * 5 = 50.

            // Call 2: `clientsByCalorie` = {1200: 10}. `totalClients` = 10.
            // `dishQty` = 50 (Global).
            // `portions` = (50 / 10) * 10 = 50.

            // Total Ingredients = 50 portions + 50 portions = 100 portions!
            // Double counting!

            // Fix: We must NOT pass the global `dishQuantities` when doing split calculation, 
            // unless we can split `dishQuantities` per set.
            // Since we effectively want to calculate ingredients based on "Number of People", 
            // checks `dishQuantities` is risky.

            // However, `dishQuantities` defaults to `totalClients` if undefined.
            // If we pass `undefined` for `dishQuantities`, it uses `totalClients` (sum of subset).
            // This effectively calculates "Exact Ingredients for these clients".
            // This is what we want for "Calculator".

            // So: pass `undefined` (or empty object) as `dishQuantities` to `calculateIngredientsForMenu` 
            // to force it to use the `clientsByCalorie` count strictly.

            // Only issue: If user MANUALLY adjusted quantities in UI for "Extra portions", we lose that.
            // The UI `dishQuantities` reflects "Total planned to cook".
            // If we want to respect that, we need to handle it.
            // But traditionally, "Calculator" tells you "What you NEED to buy based on clients".
            // Manual adjustments are usually for "Cooking Plan".

            // I will pass `undefined` for `dishQuantities` to prioritize Client Count based calculation.
            // If the user wants to calculate based on `dishQuantities`, they assume global toggle?
            // Given the complexity, counting based on clients is stricter and safer for "Shopping List".

            const dist = setStats[set.id];
            const hasClients = Object.values(dist || {}).some(v => v > 0);
            if (!hasClients) continue;

            const setIng = calculateIngredientsForMenu(
                tomorrowMenuNumber,
                dist,
                undefined, // Ignore manual quantities, use client count
                set
            );
            mergeIngredients(setIng);
        }

        // Refine Global call:
        // Also pass undefined?
        // If I pass dishQuantities, I get the scaling issue.
        // So I will pass undefined to global too.

        // Re-do Global Call Logic inside this block
        const globalIngredients = calculateIngredientsForMenu(
            tomorrowMenuNumber,
            standardStats,
            undefined,
            activeSet
        );
        mergeIngredients(globalIngredients);

        setCalculatedIngredients(totalIngredients);

        const shopping = calculateShoppingList(totalIngredients, inventory);
        setShoppingList(shopping);
        setSelectedShoppingItems(new Set());
        setBoughtShoppingItems(new Set());

        toast.success(auditUiText.menuCalcDone(tomorrowMenuNumber));
    };

    const calculateForPeriod = (dates: string[]) => {
        if (dates.length === 0) {
            toast.error(auditUiText.selectDatesForCalc);
            return;
        }

        const totalIngredients = new Map<string, { amount: number; unit: string }>();

        for (const dateStr of dates) {
            const date = new Date(dateStr);
            const menuNumber = getMenuNumber(date);

            // DYNAMICALLY calculate distribution for this specific date
            const distributionForDate = getDistributionForDate(date);

            const menuIngredients = calculateIngredientsForMenu(
                menuNumber,
                distributionForDate,
                dishQuantities, // User overrides (usually for tomorrow)
                activeSet
            );

            for (const [name, { amount, unit }] of menuIngredients) {
                const existing = totalIngredients.get(name);
                if (existing) {
                    existing.amount = Math.round((existing.amount + amount) * 10) / 10;
                } else {
                    totalIngredients.set(name, { amount, unit });
                }
            }
        }

        setCalculatedIngredients(totalIngredients);
        const shopping = calculateShoppingList(totalIngredients, inventory);
        setShoppingList(shopping);
        setSelectedShoppingItems(new Set());
        setBoughtShoppingItems(new Set());

        toast.success(auditUiText.periodCalcDone(dates.length));
    };

    const convertToUnit = (amount: number, fromUnit: string, toUnit: string): number | null => {
        const from = (fromUnit || '').toLowerCase().trim();
        const to = (toUnit || '').toLowerCase().trim();
        if (!Number.isFinite(amount)) return null;
        if (from === to) return amount;
        const mass: Record<string, number> = { kg: 1000, g: 1, gr: 1, mg: 0.001 };
        const volume: Record<string, number> = { l: 1000, ml: 1 };
        const pcs: Record<string, number> = { pcs: 1, pc: 1, sht: 1, dona: 1 };
        if (mass[from] && mass[to]) return (amount * mass[from]) / mass[to];
        if (volume[from] && volume[to]) return (amount * volume[from]) / volume[to];
        if (pcs[from] && pcs[to]) return amount;
        return null;
    };

    const visibleShoppingEntries = useMemo(
        () => Array.from(shoppingList.entries()).filter(([name]) => !boughtShoppingItems.has(name)),
        [shoppingList, boughtShoppingItems]
    );
    const ingredientNameOptions = useMemo(() => {
        const names = new Set<string>();

        Object.keys(inventoryPriceMeta).forEach((key) => {
            if (key) names.add(key);
        });

        visibleShoppingEntries.forEach(([name]) => {
            if (name) names.add(name);
        });

        customBuyItems.forEach((item) => {
            const name = String(item.name || '').trim();
            if (name) names.add(name);
        });

        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [inventoryPriceMeta, visibleShoppingEntries, customBuyItems]);
    useEffect(() => {
        if (visibleShoppingEntries.length === 0) return;
        setShoppingEdits((prev) => {
            const next = { ...prev };
            for (const [name, { amount, unit }] of visibleShoppingEntries) {
                const key = name.toLowerCase();
                if (next[key]) continue;
                const meta = inventoryPriceMeta[key] || { pricePerUnit: null, priceUnit: unit || 'kg', kcalPerGram: null };
                next[key] = {
                    amount: String(amount),
                    unit: meta.priceUnit || unit || 'kg',
                    costPerUnit: String(meta.pricePerUnit ?? 0),
                    kcalPerGram: String(meta.kcalPerGram ?? ''),
                };
            }
            return next;
        });
    }, [visibleShoppingEntries, inventoryPriceMeta]);
    const selectedVisibleCount = useMemo(
        () => visibleShoppingEntries.filter(([name]) => selectedShoppingItems.has(name)).length,
        [visibleShoppingEntries, selectedShoppingItems]
    );
    const selectedCustomCount = useMemo(
        () => customBuyItems.filter((item) => selectedCustomBuyItems.has(item.id)).length,
        [customBuyItems, selectedCustomBuyItems]
    );
    const handleBuySelectedIngredients = async () => {
        const calcToBuy = visibleShoppingEntries.filter(([name]) => selectedShoppingItems.has(name));
        const customToBuy = customBuyItems.filter((item) => selectedCustomBuyItems.has(item.id));
        if (calcToBuy.length === 0 && customToBuy.length === 0) return;
        setIsBuyingSelected(true);
        try {
            const calcItems = calcToBuy.map(([name, fallback]) => {
                const key = name.toLowerCase();
                const edit = shoppingEdits[key];
                return {
                    name,
                    amount: Number(edit?.amount ?? fallback.amount),
                    unit: String(edit?.unit ?? fallback.unit ?? 'kg'),
                    costPerUnit: Number(edit?.costPerUnit ?? 0),
                    kcalPerGram: edit?.kcalPerGram !== '' && Number.isFinite(Number(edit?.kcalPerGram)) ? Number(edit?.kcalPerGram) : undefined,
                };
            });
            const customItems = customToBuy.map((item) => ({
                name: item.name.trim(),
                amount: Number(item.amount),
                unit: item.unit || 'kg',
                costPerUnit: Number(item.costPerUnit),
                kcalPerGram: item.kcalPerGram !== '' && Number.isFinite(Number(item.kcalPerGram)) ? Number(item.kcalPerGram) : undefined,
            }));
            const allItems = [...calcItems, ...customItems].filter(
                (item) =>
                    item.name &&
                    Number.isFinite(item.amount) &&
                    item.amount > 0 &&
                    Number.isFinite(item.costPerUnit) &&
                    item.costPerUnit >= 0
            );
            if (allItems.length === 0) {
                throw new Error('Check amount and price');
            }
            const items = allItems.map((item) => {
                const targetUnit = item.unit || 'kg';
                const converted = convertToUnit(item.amount, item.unit, targetUnit);
                return {
                    name: item.name,
                    amount: converted !== null ? converted : item.amount,
                    costPerUnit: item.costPerUnit,
                    unit: targetUnit,
                    kcalPerGram: typeof item.kcalPerGram === 'number' && Number.isFinite(item.kcalPerGram) ? item.kcalPerGram : undefined,
                };
            });
            const response = await fetch('/api/admin/finance/buy-ingredients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to buy selected ingredients');
            }
            const boughtNames = new Set(calcToBuy.map(([name]) => name));
            setBoughtShoppingItems((prev) => new Set([...prev, ...boughtNames]));
            setSelectedShoppingItems((prev) => {
                const next = new Set(prev);
                for (const name of boughtNames) next.delete(name);
                return next;
            });
            setCustomBuyItems((prev) => prev.filter((item) => !selectedCustomBuyItems.has(item.id)));
            setSelectedCustomBuyItems(new Set());
            toast.success(language === 'ru' ? 'Ингредиенты закуплены' : language === 'uz' ? 'Ingredientlar sotib olindi' : 'Ingredients purchased');
            await fetchInventory();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : (language === 'ru' ? 'Ошибка покупки' : language === 'uz' ? "Sotib olishda xatolik" : 'Purchase failed'));
        } finally {
            setIsBuyingSelected(false);
        }
    };
    const addCustomBuyItem = () => {
        const name = newBuyItem.name.trim();
        const amount = Number(newBuyItem.amount);
        const costPerUnit = Number(newBuyItem.costPerUnit);
        const kcalPerGram = newBuyItem.kcalPerGram.trim() === '' ? '' : String(Number(newBuyItem.kcalPerGram));
        if (!name || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(costPerUnit) || costPerUnit < 0) {
            toast.error(language === 'ru' ? 'Заполните название, количество и цену' : language === 'uz' ? "Nomi, miqdori va narxini to\'ldiring" : 'Fill name, amount, and price');
            return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCustomBuyItems((prev) => [...prev, { id, name, amount: String(amount), unit: newBuyItem.unit || 'kg', costPerUnit: String(costPerUnit), kcalPerGram }]);
        setNewBuyItem({ name: '', amount: '', unit: 'kg', costPerUnit: '', kcalPerGram: '' });
    };
    const _mealTypeIcons: Record<keyof typeof MEAL_TYPES, string> = {
        BREAKFAST: '🌅',
        SECOND_BREAKFAST: '🥐',
        LUNCH: '🍽️',
        SNACK: '🍎',
        DINNER: '🌙',
        SIXTH_MEAL: '🥗',
        UNKNOWN: '❓',
    };

    // Calculate required ingredients with CALORIE-SCALED amounts
    // For each dish, sum ingredients across all calorie tiers based on client distribution
    const _requiredIngredients = useMemo(() => {
        if (!tomorrowMenu) return new Map<string, { amount: number; unit: string }>();
        const required = new Map<string, { amount: number; unit: string }>();

        // For each dish, calculate total ingredients needed across all calorie tiers
        for (const dish of tomorrowMenu.dishes) {
            const dishQty = dishQuantities[dish.id] || 0;
            if (dishQty <= 0) continue;

            // Calculate proportionally based on client distribution
            // Example: 2 clients at 1200kcal, 1 at 2000kcal = 3 total
            // Each calorie tier gets its scaled ingredients
            const totalClients = Object.values(clientsByCalorie).reduce((sum, c) => sum + c, 0);

            if (totalClients === 0) continue;

            // For each calorie tier
            for (const [calorieStr, clientCount] of Object.entries(clientsByCalorie)) {
                if (clientCount <= 0) continue;

                const calories = parseInt(calorieStr);
                const mealType = dish.mealType as keyof typeof MEAL_TYPES;

                // Get scaled ingredients for this calorie tier
                const scaledIngredients = scaleIngredients(
                    dish.ingredients,
                    calories,
                    mealType,
                    1 // per portion
                );

                // Calculate how many portions for this tier
                // If dishQty matches totalClients, each tier gets clientCount portions
                // If user overrides dishQty, distribute proportionally
                const portionsForTier = Math.round((dishQty / totalClients) * clientCount);

                for (const ing of scaledIngredients) {
                    const existing = required.get(ing.name);
                    const amount = ing.amount * portionsForTier;
                    if (existing) {
                        existing.amount = Math.round((existing.amount + amount) * 10) / 10;
                    } else {
                        required.set(ing.name, { amount: Math.round(amount * 10) / 10, unit: ing.unit });
                    }
                }
            }
        }
        return required;
    }, [tomorrowMenu, dishQuantities, clientsByCalorie]);

    // Check which ingredients are insufficient
    // Inventory check disabled - handled by server
    // const insufficientIngredients = useMemo(() => { ... }, []);
    // const hasEnoughStock = true;
    const _totalDishesToCook = Object.values(dishQuantities).reduce((sum, qty) => sum + qty, 0);

    return (
        <div className={`space-y-6 ${className}`}>
            <Card className="border border-border bg-card">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Package className="w-5 h-5 text-primary" />
                                {t.warehouse.title}
                            </CardTitle>
                            <CardDescription>
                                {t.warehouse.description}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1 px-3 py-1.5 bg-primary/5">
                                <ChefHat className="w-4 h-4" />
                                <span>{t.warehouse.menuFor} {tomorrowMenuNumber}</span>
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                        <TabsList className="mb-6 grid w-full grid-cols-5 border border-border bg-muted">
                            <TabsTrigger
                                value="cooking"
                                aria-label={t.warehouse.cooking}
                                className="flex items-center gap-2"
                            >
                                <ChefHat className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.warehouse.cooking}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="sets"
                                aria-label={auditUiText.setsTab}
                                className="flex items-center gap-2"
                            >
                                <UtensilsCrossed className="w-4 h-4" />
                                <span className="hidden sm:inline">{auditUiText.setsTab}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="inventory"
                                aria-label={t.warehouse.inventory}
                                className="flex items-center gap-2"
                            >
                                <Package className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.warehouse.inventory}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="calculator"
                                aria-label={t.warehouse.calculator}
                                className="flex items-center gap-2"
                            >
                                <Calculator className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.warehouse.calculator}</span>
                            </TabsTrigger>

                        </TabsList>

                        {/* Cooking Tab - Dishes to prepare for tomorrow */}
                        <TabsContent value="cooking" className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <CalendarRangeSelector
                                        value={cookingRange}
                                        onChange={setCookingRange}
                                        uiText={{
                                            ...calendarRangeUiText,
                                            calendar: (() => {
                                                if (!cookingRange?.from) return 'Menu'
                                                const fromNum = getMenuNumber(cookingRange.from)
                                                const toNum = getMenuNumber(cookingRange.to ?? cookingRange.from)
                                                return fromNum === toNum ? `Menu ${fromNum}` : `Menu ${fromNum}-${toNum}`
                                            })(),
                                        }}
                                        locale={dateLocale}
                                        className="w-[240px] max-w-full min-w-0"
                                    />

                                    <Select value={cookingSelectedSetId} onValueChange={setCookingSelectedSetId}>
                                        <SelectTrigger className="h-9 w-[220px] max-w-full">
                                            <SelectValue placeholder={auditUiText.setsTab} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">{auditUiText.activeSet}</SelectItem>
                                            {availableSets.map((s) => (
                                                <SelectItem key={String(s.id)} value={String(s.id)}>
                                                    {s.name} {s.isActive ? '✓' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <RefreshIconButton
                                        label={auditUiText.refreshCookingPlans ?? 'Refresh'}
                                        onClick={() => {
                                            fetchData()
                                            void refreshCookingPlansForRange()
                                        }}
                                        isLoading={isCookingPlansLoading}
                                        iconSize="md"
                                    />
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{auditUiText.planned}: <span className="font-semibold text-foreground">{cookingTotals.planned}</span></span>
                                    <span>·</span>
                                    <span>{auditUiText.cooked}: <span className="font-semibold text-emerald-600">{cookingTotals.cooked}</span></span>
                                    <span>·</span>
                                    <span>{auditUiText.remaining}: <span className="font-semibold text-amber-600">{cookingTotals.remaining}</span></span>
                                    {isCookingPlansLoading ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : null}
                                </div>
                            </div>

                            {cookingPlansError ? (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                    {cookingPlansError}
                                </div>
                            ) : null}

                            {cookingRangeDays.length > 1 ? (
                                <div className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2">
                                    {cookingRangeDays.map((iso) => (
                                        <Button
                                            key={iso}
                                            type="button"
                                            onClick={() => setSelectedCookingDateISO(iso)}
                                            size="sm"
                                            variant={iso === selectedCookingDateISO ? 'default' : 'outline'}
                                            className="h-8 shrink-0 px-2.5 text-xs"
                                        >
                                            {iso}
                                        </Button>
                                    ))}
                                </div>
                            ) : null}

                            {/* NEW: Detailed Cooking Manager */}
                            <CookingManager
                                date={selectedCookingDateISO}
                                menuNumber={selectedCookingMenuNumber}
                                clientsByCalorie={clientsByCalorie}
                                clients={allClients}
                                orders={allOrders}
                                availableSets={availableSets}
                                selectedSetId={cookingSelectedSetId}
                                onSelectedSetIdChange={setCookingSelectedSetId}
                                selectedCalorieGroup="all"
                                onSelectedCalorieGroupChange={() => {}}
                                showHeader={false}
                                showContextInfo={false}
                                onCook={() => { fetchData(); void refreshCookingPlansForRange(); }} // Refresh inventory + audit summary on cook
                                orderInfo={{
                                    total: Object.values(clientsByCalorie).reduce((a, b) => a + b, 0),
                                    byCalorie: clientsByCalorie
                                }}
                            />
                        </TabsContent>

                        {/* Sets Tab */}
                        <TabsContent value="sets" className="space-y-4">
                            <SetsTab />
                        </TabsContent>

                        {/* Inventory Tab - Managed by IngredientsManager */}
                        <TabsContent value="inventory" className="space-y-4">
                            <div className="rounded-lg border border-border bg-card p-3 text-sm">
                                {t.warehouse.inventoryInfo}
                            </div>

                            <IngredientsManager onUpdate={fetchData} />
                        </TabsContent>

                        {/* Calculator Tab - Multi-day calculation */}
                        <TabsContent value="calculator" className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Date selection */}
                                <div className="space-y-4">
                                    <div className="rounded-lg border border-border bg-card p-3 text-sm">
                                        {t.warehouse.calcDaysInfo}
                                    </div>

                                    <CalendarRangeSelector
                                        value={calcRange}
                                        onChange={setCalcRange}
                                        uiText={{
                                            ...calendarRangeUiText,
                                            calendar: (() => {
                                                if (!calcRange?.from) return 'Menu'
                                                const fromNum = getMenuNumber(calcRange.from)
                                                const toNum = getMenuNumber(calcRange.to ?? calcRange.from)
                                                return fromNum === toNum ? `Menu ${fromNum}` : `Menu ${fromNum}-${toNum}`
                                            })(),
                                        }}
                                        locale={dateLocale}
                                        className="w-full min-w-0"
                                    />

                                    <Button
                                        onClick={() => {
                                            if (calcRangeDays.length > 0) calculateForPeriod(calcRangeDays)
                                            else calculateForTomorrow()
                                        }}
                                        className="w-full justify-center"
                                        variant="default"
                                    >
                                        <Calculator className="w-4 h-4" />
                                        <span>
                                            {calcRangeDays.length > 0
                                                ? t.warehouse.calcForDays.replace('{count}', calcRangeDays.length.toString())
                                                : t.warehouse.calcTomorrow.replace('{number}', tomorrowMenuNumber.toString())}
                                        </span>
                                    </Button>
                                </div>

                                {/* Right: Results */}
                                <div className="space-y-4">
                                    {calculatedIngredients.size > 0 && (
                                        <>
                                            <div>
                                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                                    <Package className="w-4 h-4" />
                                                    {t.warehouse.requiredIngredients}
                                                </h4>
                                                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">
                                                    {Array.from(calculatedIngredients.entries()).map(([name, { amount, unit }]) => (
                                                        <div key={name} className="flex justify-between p-2 border-b last:border-0 text-sm">
                                                            <span className="text-foreground">{name}</span>
                                                            <span className="font-medium">{amount} {unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="font-medium mb-2 flex items-center gap-2 text-orange-600">
                                                    <ShoppingCart className="w-4 h-4" />
                                                    {t.warehouse.shoppingListTitle}
                                                </h4>
                                                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card">
                                                    {visibleShoppingEntries.length > 0 ? (
                                                        visibleShoppingEntries.map(([name, fallback]) => {
                                                            const key = name.toLowerCase()
                                                            const edit = shoppingEdits[key] || {
                                                                amount: String(fallback.amount),
                                                                unit: fallback.unit || 'kg',
                                                                costPerUnit: '0',
                                                                kcalPerGram: '',
                                                            }
                                                            return (
                                                            <div key={name} className="grid grid-cols-12 items-center gap-2 w-full p-2 border-b border-border/60 last:border-0 text-sm">
                                                                <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                                    <Checkbox
                                                                        checked={selectedShoppingItems.has(name)}
                                                                        onCheckedChange={(checked) => {
                                                                            setSelectedShoppingItems((prev) => {
                                                                                const next = new Set(prev);
                                                                                if (checked) next.add(name);
                                                                                else next.delete(name);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                    />
                                                                    <span className="text-foreground truncate">{name}</span>
                                                                </div>
                                                                <Input
                                                                    className="col-span-2 h-8"
                                                                    type="number"
                                                                    value={edit.amount}
                                                                    onChange={(e) =>
                                                                        setShoppingEdits((prev) => ({
                                                                            ...prev,
                                                                            [key]: { ...edit, amount: e.target.value },
                                                                        }))
                                                                    }
                                                                />
                                                                <Select
                                                                    value={edit.unit}
                                                                    onValueChange={(value) =>
                                                                        setShoppingEdits((prev) => ({
                                                                            ...prev,
                                                                            [key]: { ...edit, unit: value },
                                                                        }))
                                                                    }
                                                                >
                                                                    <SelectTrigger className="col-span-2 h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="kg">kg</SelectItem>
                                                                        <SelectItem value="gr">gr</SelectItem>
                                                                        <SelectItem value="ml">ml</SelectItem>
                                                                        <SelectItem value="l">l</SelectItem>
                                                                        <SelectItem value="pcs">pcs</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Input
                                                                    className="col-span-2 h-8"
                                                                    type="number"
                                                                    value={edit.kcalPerGram}
                                                                    onChange={(e) =>
                                                                        setShoppingEdits((prev) => ({
                                                                            ...prev,
                                                                            [key]: { ...edit, kcalPerGram: e.target.value },
                                                                        }))
                                                                    }
                                                                    placeholder="kcal/gr"
                                                                />
                                                                <Input
                                                                    className="col-span-2 h-8"
                                                                    type="number"
                                                                    value={edit.costPerUnit}
                                                                    onChange={(e) =>
                                                                        setShoppingEdits((prev) => ({
                                                                            ...prev,
                                                                            [key]: { ...edit, costPerUnit: e.target.value },
                                                                        }))
                                                                    }
                                                                    placeholder="price/unit"
                                                                />
                                                            </div>
                                                        )})
                                                    ) : (
                                                        <div className="p-4 text-center text-green-600 text-sm">
                                                            {t.warehouse.allGood}
                                                        </div>
                                                    )}
                                                    {customBuyItems.map((item) => (
                                                        <div key={item.id} className="grid grid-cols-12 items-center gap-2 w-full p-2 border-b border-border/60 text-sm">
                                                            <div className="col-span-4 flex items-center gap-2 min-w-0">
                                                                <Checkbox
                                                                    checked={selectedCustomBuyItems.has(item.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        setSelectedCustomBuyItems((prev) => {
                                                                            const next = new Set(prev);
                                                                            if (checked) next.add(item.id);
                                                                            else next.delete(item.id);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                />
                                                                <Input
                                                                  className="h-8"
                                                                  list="warehouse-calculator-ingredients"
                                                                  value={item.name}
                                                                  onChange={(e) => setCustomBuyItems((prev) => prev.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x))}
                                                                />
                                                            </div>
                                                            <Input className="col-span-2 h-8" type="number" value={item.amount} onChange={(e) => setCustomBuyItems((prev) => prev.map((x) => x.id === item.id ? { ...x, amount: e.target.value } : x))} />
                                                            <Select value={item.unit} onValueChange={(value) => setCustomBuyItems((prev) => prev.map((x) => x.id === item.id ? { ...x, unit: value } : x))}>
                                                                <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="kg">kg</SelectItem>
                                                                    <SelectItem value="gr">gr</SelectItem>
                                                                    <SelectItem value="ml">ml</SelectItem>
                                                                    <SelectItem value="l">l</SelectItem>
                                                                    <SelectItem value="pcs">pcs</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <div className="col-span-2">
                                                                <Input className="h-8" type="number" value={item.kcalPerGram} onChange={(e) => setCustomBuyItems((prev) => prev.map((x) => x.id === item.id ? { ...x, kcalPerGram: e.target.value } : x))} placeholder="kcal/gr" />
                                                            </div>
                                                            <div className="col-span-1">
                                                                <Input className="h-8" type="number" value={item.costPerUnit} onChange={(e) => setCustomBuyItems((prev) => prev.map((x) => x.id === item.id ? { ...x, costPerUnit: e.target.value } : x))} />
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => setCustomBuyItems((prev) => prev.filter((x) => x.id !== item.id))}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <datalist id="warehouse-calculator-ingredients">
                                                    {ingredientNameOptions.map((name) => (
                                                        <option key={name} value={name} />
                                                    ))}
                                                </datalist>
                                                <div className="mt-2 grid grid-cols-12 items-center gap-2">
                                                    <Input className="col-span-4 h-8" list="warehouse-calculator-ingredients" placeholder="Ingredient name" value={newBuyItem.name} onChange={(e) => setNewBuyItem((prev) => ({ ...prev, name: e.target.value }))} />
                                                    <Input className="col-span-2 h-8" type="number" placeholder="Amount" value={newBuyItem.amount} onChange={(e) => setNewBuyItem((prev) => ({ ...prev, amount: e.target.value }))} />
                                                    <Select value={newBuyItem.unit} onValueChange={(value) => setNewBuyItem((prev) => ({ ...prev, unit: value }))}>
                                                        <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="kg">kg</SelectItem>
                                                            <SelectItem value="gr">gr</SelectItem>
                                                            <SelectItem value="ml">ml</SelectItem>
                                                            <SelectItem value="l">l</SelectItem>
                                                            <SelectItem value="pcs">pcs</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input className="col-span-2 h-8" type="number" placeholder="kcal/gr" value={newBuyItem.kcalPerGram} onChange={(e) => setNewBuyItem((prev) => ({ ...prev, kcalPerGram: e.target.value }))} />
                                                    <Input className="col-span-1 h-8" type="number" placeholder="Price/unit" value={newBuyItem.costPerUnit} onChange={(e) => setNewBuyItem((prev) => ({ ...prev, costPerUnit: e.target.value }))} />
                                                    <Button type="button" variant="outline" className="col-span-1 h-8 w-8 p-0" onClick={addCustomBuyItem}>
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                {(visibleShoppingEntries.length > 0 || customBuyItems.length > 0) ? (
                                                    <Button
                                                        className="mt-3 w-full"
                                                        onClick={() => void handleBuySelectedIngredients()}
                                                        disabled={(selectedVisibleCount + selectedCustomCount) === 0 || isBuyingSelected}
                                                    >
                                                        {isBuyingSelected
                                                            ? (language === 'ru' ? 'Покупка...' : language === 'uz' ? 'Sotib olinmoqda...' : 'Buying...')
                                                            : (language === 'ru'
                                                                ? `Купить выбранные (${selectedVisibleCount + selectedCustomCount})`
                                                                : language === 'uz'
                                                                    ? `Tanlanganlarni sotib olish (${selectedVisibleCount + selectedCustomCount})`
                                                                    : `Buy selected (${selectedVisibleCount + selectedCustomCount})`)}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </>
                                    )}
                                    {calculatedIngredients.size === 0 && (
                                        <TabEmptyState
                                            title={t.warehouse.clickToCalc}
                                            description={t.warehouse.calcDaysInfo}
                                            icon={<Calculator className="mx-auto mb-3 size-6 text-muted-foreground" />}
                                        />
                                    )}
                                </div>
                            </div>
                        </TabsContent>



                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}


