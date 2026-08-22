'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Plus,
    Trash2,
    Edit,
    UtensilsCrossed,
    Flame,
    Copy,
    Scale,
    ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { SearchPanel } from '@/components/ui/search-panel';
import { IconButton } from '@/components/ui/icon-button';
import { useLanguage } from '@/contexts/LanguageContext';
import { MENUS, MEAL_TYPES, type Dish, type Ingredient } from '@/lib/menuData';
import type { DateRange } from 'react-day-picker';
import { CalendarRangeSelector } from '@/components/admin/dashboard/shared/CalendarRangeSelector';
import { ResourceActionBar } from '@/components/admin/dashboard/shared/ResourceActionBar';
import { parseDishDraft, type DishDraft } from '@/lib/menu/dish-draft';

// Types for custom sets
// Types for custom sets
interface SetDish {
    dishId: string | number; // Support CUIDs from DB and legacy numeric IDs
    dishName: string;
    mealType: string;
    mealIndex?: number | null;
    customIngredients?: Ingredient[];
}

interface CalorieGroup {
    id?: string; // stable key inside JSON
    name?: string;
    price?: number | null;
    calories?: number;
    dishes: SetDish[];
}

// Map day number (string) to array of calorie groups
type DayConfig = Record<string, CalorieGroup[]>;

type CalorieGroupsMeta = {
    dayOrder?: string[];
    groupOrder?: string[];
    assignedPeriod?: {
        from: string;
        to: string;
    };
};

function attachGroupsMeta(groups: DayConfig, meta: CalorieGroupsMeta): DayConfig {
    Object.defineProperty(groups, '_meta', {
        configurable: true,
        enumerable: true,
        value: meta,
        writable: true,
    });
    return groups;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface MenuSet {
    id: string;
    name: string;
    description?: string;
    menuNumber: number; // Ignored/0 for global sets
    calorieGroups: DayConfig; // Changed structure!
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

function getMeta(set: MenuSet | null): CalorieGroupsMeta {
    const base = set?.calorieGroups;
    if (!base || typeof base !== 'object' || Array.isArray(base)) return {};
    const meta = base._meta;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
    return meta as CalorieGroupsMeta;
}

function getAssignedPeriodRange(set: MenuSet | null): DateRange | undefined {
    const assignedPeriod = getMeta(set).assignedPeriod;
    const fromRaw = assignedPeriod?.from;
    if (!fromRaw) return undefined;

    const from = new Date(fromRaw);
    if (Number.isNaN(from.getTime())) return undefined;

    const to = new Date(assignedPeriod?.to ?? fromRaw);
    if (Number.isNaN(to.getTime())) return undefined;

    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return { from, to };
}

function resolveDayKeyForDate(date: Date, set: MenuSet | null, fallbackDay = '1') {
    const assigned = getAssignedPeriodRange(set);
    const anchor = new Date(assigned?.from ?? date);
    anchor.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diff = Math.floor((target.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
    const dayNumber = diff + 1;
    if (!Number.isFinite(dayNumber) || dayNumber < 1) return fallbackDay;
    return String(dayNumber);
}

type WarehouseItem = {
    name: string;
    unit?: string;
    kcalPerGram?: number | null;
    pricePerUnit?: number | null;
    priceUnit?: string;
};

type WarehouseItemMeta = {
    kcalPerGram: number | null;
    pricePerUnit: number | null;
    priceUnit: string;
};

function getOriginalIngredients(dishId: string | number, availableDishes: Dish[]): Ingredient[] {
    let dish = availableDishes.find((candidate) => candidate.id == dishId);
    if (!dish && MENUS) {
        for (const menu of MENUS) {
            const found = menu.dishes.find((candidate) => candidate.id == dishId);
            if (found) {
                dish = found;
                break;
            }
        }
    }
    return dish?.ingredients || [];
}

function toGrams(amount: number, unit: string) {
    const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    const normalizedUnit = (unit || '').toLowerCase().trim();
    if (!value) return 0;
    if (normalizedUnit === 'kg') return value * 1000;
    if (normalizedUnit === 'g' || normalizedUnit === 'gr' || normalizedUnit === 'гр') return value;
    if (normalizedUnit === 'mg') return value / 1000;
    return value;
}

function convertUnitAmount(amount: number, fromUnit: string, toUnit: string): number | null {
    const from = (fromUnit || '').toLowerCase().trim();
    const to = (toUnit || '').toLowerCase().trim();
    if (!Number.isFinite(amount)) return null;
    if (from === to) return amount;

    const mass: Record<string, number> = { kg: 1000, g: 1, gr: 1, mg: 0.001 };
    const volume: Record<string, number> = { l: 1000, ml: 1 };
    const pieces: Record<string, number> = { pcs: 1, pc: 1, sht: 1, dona: 1 };

    if (mass[from] && mass[to]) return (amount * mass[from]) / mass[to];
    if (volume[from] && volume[to]) return (amount * volume[from]) / volume[to];
    if (pieces[from] && pieces[to]) return amount;
    return null;
}

function getDraftIngredientCost(ingredient: Ingredient, warehouseByName: Map<string, WarehouseItemMeta>) {
    if (typeof ingredient?.pricePerUnit === 'number' && Number.isFinite(ingredient.pricePerUnit)) {
        const priceUnit = String(ingredient.priceUnit || ingredient.unit || 'gr');
        const converted = convertUnitAmount(Number(ingredient.amount) || 0, String(ingredient.unit || 'gr'), priceUnit);
        if (converted !== null) return converted * ingredient.pricePerUnit;
    }

    const item = warehouseByName.get(String(ingredient.name || '').trim().toLowerCase());
    if (!item || item.pricePerUnit === null) return null;
    const converted = convertUnitAmount(Number(ingredient.amount) || 0, String(ingredient.unit || 'gr'), item.priceUnit);
    return converted === null ? null : converted * item.pricePerUnit;
}

function getDishCalories(dish: SetDish, availableDishes: Dish[], kcalByName: Map<string, number>) {
    const ingredients = dish.customIngredients ?? getOriginalIngredients(dish.dishId, availableDishes);
    let total = 0;
    for (const ingredient of ingredients) {
        const nameKey = (ingredient.name || '').trim().toLowerCase();
        const kcalPerGram =
            (typeof ingredient.kcalPerGram === 'number' && Number.isFinite(ingredient.kcalPerGram) ? ingredient.kcalPerGram : null)
            ?? (kcalByName.get(nameKey) ?? 0);
        total += toGrams(Number(ingredient.amount), String(ingredient.unit)) * kcalPerGram;
    }
    return Number.isFinite(total) ? total : 0;
}

function getDishPrice(dish: SetDish, availableDishes: Dish[], warehouseByName: Map<string, WarehouseItemMeta>) {
    const ingredients = dish.customIngredients ?? getOriginalIngredients(dish.dishId, availableDishes);
    let total = 0;
    for (const ingredient of ingredients) {
        const cost = getDraftIngredientCost(ingredient, warehouseByName);
        if (cost !== null && Number.isFinite(cost)) total += cost;
    }
    return Number.isFinite(total) ? total : 0;
}

const MEAL_TYPE_ORDER: Array<keyof typeof MEAL_TYPES> = [
    'BREAKFAST',
    'SECOND_BREAKFAST',
    'LUNCH',
    'SNACK',
    'DINNER',
    'SIXTH_MEAL',
];
const UNIT_OPTIONS = ['kg', 'gr', 'ml', 'l', 'pcs'];

function getMealIndex(mealType: string) {
    const normalizedMealType = mealType as keyof typeof MEAL_TYPES;
    const idx = MEAL_TYPE_ORDER.indexOf(normalizedMealType);
    return idx >= 0 ? idx + 1 : null;
}

export function SetsTab() {
    const { language } = useLanguage();

    const uiText = useMemo(() => {
        if (language === 'uz') {
            return {
                title: 'Setlar',
                subtitle: 'Menuni kunlar bo‘yicha sozlash',
                newSet: 'Yangi set',
                newDish: 'Yangi taom',
                setsList: 'Setlar ro‘yxati',
                updatedAt: 'Yangilandi',
                search: 'Qidirish',
                selectSetHint: 'Tahrirlashni boshlash uchun setni tanlang',
                days: 'Kunlar',
                dayMenuTitle: (day: string) => `Kun ${day} menyusi`,
                noDayDataTitle: 'Bu kun uchun menyu yo‘q',
                noDayDataDesc: (day: string) => `Siz bo‘shdan boshlashingiz yoki ${day}-kun uchun standart menyuni nusxalashingiz mumkin.`,
                copyStandard: (day: string) => `Standart menyuni nusxalash (Kun ${day})`,
                copiedDay: (day: string) => `Kun ${day} menyusi nusxalandi`,
                confirmDeleteSet: 'Ushbu setni o‘chirasizmi?',
                deleted: 'O‘chirildi',
                delete: 'O‘chirish',
                saveError: 'Saqlashda xatolik',
                loadSetsError: 'Setlarni yuklashda xatolik',
                loadDishesError: 'Taomlarni yuklashda xatolik',
                setNameRequired: 'Set nomini kiriting',
                confirmDeleteDay: (day: string) => `Kun ${day} ni oâ€˜chirasizmi?`,
                confirmDeleteGroup: 'Ushbu guruhni oâ€˜chirasizmi?',
                cantDeleteLastDay: 'Oxirgi kunni oâ€˜chirib boâ€˜lmaydi',
                create: 'Yaratish',
                cancel: 'Bekor qilish',
                setName: 'Set nomi',
                mealName: 'Taom nomi',
                mealNamePlaceholder: 'Taom nomini yozing...',
                mealNameRequired: 'Taom nomini kiriting',
                dish: 'Taom',
                meal: 'Ovqat',
                addMeal: 'Taom qo‘shish',
                editMeal: 'Taomni tahrirlash',
                noDishes: 'Taomlar yo‘q',
                customWeight: 'Moslashtirilgan vazn',
                standard: 'Standart',
                addIngredient: 'Ingredient qo‘shish',
                selectIngredient: 'Ingredient tanlang...',
                ingredients: 'Ingredientlar',
                ingredientsDesc: 'Bu taom uchun ingredientlar tarkibini va og‘irligini sozlang.',
                tableName: 'Nomi',
                tableAmount: 'Miqdor',
                tableUnit: 'Birlik',
                noIngredients: 'Ingredient yo‘q',
                ingredientAlreadyAdded: 'Ingredient allaqachon qo‘shilgan',
                saveChanges: 'O‘zgarishlarni saqlash',
                groups: 'Guruhlar',
                group: 'Guruh',
                newGroup: 'Yangi guruh',
                groupName: 'Guruh nomi',
                groupCalories: 'Kaloriya (kcal)',
                groupPrice: 'Narx',
                dishesLabel: 'Taomlar',
                caloriesLabel: 'Kaloriya',
                priceLabel: 'Narx (UZS)',
                mealLabel: (n: number) => `${n}-taom`,
                menuDay: (day: string) => `Menyu ${day}`,
                addDay: 'Kun qo‘shish',
                maxDaysReached: (n: number) => `Maksimal kunlar: ${n}`,
            };
        }

        if (language === 'ru') {
            return {
                title: 'Сеты',
                subtitle: 'Настройка меню по дням',
                newSet: 'Новый сет',
                newDish: 'Новое блюдо',
                setsList: 'Список сетов',
                updatedAt: 'Обновлено',
                search: 'Поиск',
                selectSetHint: 'Выберите сет, чтобы начать редактирование',
                days: 'Дни',
                dayMenuTitle: (day: string) => `Меню на День ${day}`,
                noDayDataTitle: 'Нет меню для этого дня',
                noDayDataDesc: (day: string) => `Вы можете начать с чистого листа или скопировать стандартное меню для Дня ${day}.`,
                copyStandard: (day: string) => `Скопировать стандартное меню (День ${day})`,
                copiedDay: (day: string) => `Меню дня ${day} скопировано`,
                confirmDeleteSet: 'Удалить этот сет?',
                deleted: 'Удалено',
                delete: 'Удалить',
                saveError: 'Ошибка сохранения',
                loadSetsError: 'Ошибка загрузки сетов',
                loadDishesError: 'Ошибка загрузки блюд',
                setNameRequired: 'Введите название сета',
                confirmDeleteDay: (day: string) => `Удалить День ${day}?`,
                confirmDeleteGroup: 'Удалить эту группу?',
                cantDeleteLastDay: 'Нельзя удалить последний день',
                create: 'Создать',
                cancel: 'Отмена',
                setName: 'Название сета',
                mealName: 'Название блюда',
                mealNamePlaceholder: 'Введите название блюда...',
                mealNameRequired: 'Введите название блюда',
                dish: 'Блюдо',
                meal: 'Приём пищи',
                addMeal: 'Добавить блюдо',
                editMeal: 'Редактировать блюдо',
                noDishes: 'Нет блюд',
                customWeight: 'Кастомный вес',
                standard: 'Стандарт',
                addIngredient: 'Добавить ингредиент',
                selectIngredient: 'Выберите ингредиент...',
                ingredients: 'Ингредиенты',
                ingredientsDesc: 'Настройте состав и вес ингредиентов для этого блюда в рамках сета.',
                tableName: 'Название',
                tableAmount: 'Кол-во',
                tableUnit: 'Ед.',
                noIngredients: 'Нет ингредиентов',
                ingredientAlreadyAdded: 'Ингредиент уже добавлен',
                saveChanges: 'Сохранить изменения',
                groups: 'Группы',
                group: 'Группа',
                newGroup: 'Новая группа',
                groupName: 'Название группы',
                groupCalories: 'Калории (kcal)',
                groupPrice: 'Цена',
                dishesLabel: 'Блюда',
                caloriesLabel: 'Калории',
                priceLabel: 'Цена (UZS)',
                mealLabel: (n: number) => `Приём ${n}`,
                menuDay: (day: string) => `Меню ${day}`,
                addDay: 'Добавить день',
                maxDaysReached: (n: number) => `Максимум дней: ${n}`,
            };
        }

        return {
            title: 'Sets',
            subtitle: 'Configure menus by day',
            newSet: 'New set',
            newDish: 'New dish',
            setsList: 'Sets list',
            updatedAt: 'Updated',
            search: 'Search',
            selectSetHint: 'Select a set to start editing',
            days: 'Days',
            dayMenuTitle: (day: string) => `Day ${day} menu`,
            noDayDataTitle: 'No menu for this day',
            noDayDataDesc: (day: string) => `Start from scratch or copy the standard menu for Day ${day}.`,
            copyStandard: (day: string) => `Copy standard menu (Day ${day})`,
            copiedDay: (day: string) => `Copied menu for Day ${day}`,
            confirmDeleteSet: 'Delete this set?',
            deleted: 'Deleted',
            delete: 'Delete',
            saveError: 'Save error',
            loadSetsError: 'Failed to load sets',
            loadDishesError: 'Failed to load dishes',
             setNameRequired: 'Enter set name',
             confirmDeleteDay: (day: string) => `Delete Day ${day}?`,
             confirmDeleteGroup: 'Delete this group?',
             cantDeleteLastDay: 'Cannot delete the last day',
             create: 'Create',
             cancel: 'Cancel',
             setName: 'Set name',
            mealName: 'Meal name',
            mealNamePlaceholder: 'Type a meal name...',
            mealNameRequired: 'Enter meal name',
            dish: 'Dish',
            meal: 'Meal',
            addMeal: 'Add meal',
            editMeal: 'Edit meal',
            noDishes: 'No dishes',
            customWeight: 'Custom weight',
            standard: 'Standard',
            addIngredient: 'Add ingredient',
            selectIngredient: 'Select an ingredient...',
            ingredients: 'Ingredients',
            ingredientsDesc: 'Adjust ingredients and amounts for this meal inside the set.',
            tableName: 'Name',
            tableAmount: 'Qty',
            tableUnit: 'Unit',
            noIngredients: 'No ingredients',
            ingredientAlreadyAdded: 'Ingredient already added',
            saveChanges: 'Save changes',
            groups: 'Groups',
            group: 'Group',
            newGroup: 'New group',
            groupName: 'Group name',
            groupCalories: 'Calories (kcal)',
            groupPrice: 'Price',
            dishesLabel: 'Dishes',
            caloriesLabel: 'Calories',
            priceLabel: 'Price (UZS)',
            mealLabel: (n: number) => `Meal ${n}`,
            menuDay: (day: string) => `Menu ${day}`,
            addDay: 'Add day',
            maxDaysReached: (n: number) => `Max days: ${n}`,
        };
    }, [language]);

    // Keep Sets + Days selector rows visually consistent.
    const rowIconBtnClass = "h-9 w-9";
    const rowIconBtnGhostClass = `${rowIconBtnClass} border-2 border-transparent text-main-foreground hover:border-border hover:bg-secondary-background`;
    const rowIconBtnDeleteClass = `${rowIconBtnClass} border-2 border-border bg-secondary-background text-foreground hover:bg-main`;

    const [sets, setSets] = useState<MenuSet[]>([]);
    const [selectedSet, setSelectedSet] = useState<MenuSet | null>(null);
    const [activeDay, setActiveDay] = useState<string>("1"); // Current day being edited (1-21)
    const [availableDishes, setAvailableDishes] = useState<Dish[]>([]);
    const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
    const [setSearch, setSetSearch] = useState('');
    const [periodRange, setPeriodRange] = useState<DateRange | undefined>(undefined);

    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddDishModalOpen, setIsAddDishModalOpen] = useState(false);
    const [isEditDishModalOpen, setIsEditDishModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Edit State
    const [activeGroupTab, setActiveGroupTab] = useState('');
    const [addDishTarget, setAddDishTarget] = useState<{ calorieIndex: number } | null>(null);
    const [selectedDishToAdd, setSelectedDishToAdd] = useState<string>('');
    const [mealNameToAdd, setMealNameToAdd] = useState('');
    const [draftMealIngredients, setDraftMealIngredients] = useState<Ingredient[]>([]);
    const [customDraftIngredient, setCustomDraftIngredient] = useState({
        name: '',
        amount: '',
        unit: 'gr',
        kcalPerGram: '',
        pricePerUnit: '',
        priceUnit: 'kg',
    });
    const [customEditIngredient, setCustomEditIngredient] = useState({
        name: '',
        amount: '',
        unit: 'gr',
        kcalPerGram: '',
        pricePerUnit: '',
        priceUnit: 'kg',
    });
    const [editingDish, setEditingDish] = useState<{ setId: string; calorieIndex: number; dishIndex: number; dish: SetDish } | null>(null);
    const [editingGroup, setEditingGroup] = useState<{ groupIndex: number; group: CalorieGroup } | null>(null);
    const [selectedSetIdForPeriod, setSelectedSetIdForPeriod] = useState<string | null>(null);

    // Form state for new set
    const [newSetForm, setNewSetForm] = useState({
        name: '',
        description: ''
    });

    const [groupForm, setGroupForm] = useState<{ name: string; price: string }>({
        name: '',
        price: '',
    });

    const [setsOrder, setSetsOrder] = useState<string[]>([]);
    const fetchSetsRef = useRef<() => Promise<void>>(async () => {});
    const fetchDishesRef = useRef<() => Promise<void>>(async () => {});
    const fetchWarehouseItemsRef = useRef<() => Promise<void>>(async () => {});

    useEffect(() => {
        try {
            const raw = localStorage.getItem('warehouse_sets_order_v1');
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setSetsOrder(parsed.filter((v) => typeof v === 'string'));
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!sets || sets.length === 0) return;
        setSetsOrder((prev) => {
            const known = new Set(prev);
            const next = [...prev];
            for (const s of sets) {
                if (!known.has(s.id)) next.push(s.id);
            }
            try {
                localStorage.setItem('warehouse_sets_order_v1', JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, [sets]);

    const getBaseGroups = (set: MenuSet | null): DayConfig => set?.calorieGroups ?? {};

    const getDayKeysFromGroups = (groups: unknown) => {
        if (!isRecord(groups)) return [];
        return Object.keys(groups)
            .filter((k) => /^\d+$/.test(k))
            .map((k) => String(parseInt(k, 10)))
            .filter((k) => k !== 'NaN' && Number(k) > 0);
    };

    const fetchSets = async () => {
        try {
            const response = await fetch('/api/admin/sets');
            if (response.ok) {
                const data = await response.json();

                if (data.length === 0) {
                    await createDefaultSet();
                } else {
                    setSets(data);
                    if (!selectedSet) {
                        setSelectedSet(data[0]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching sets:', error);
            toast.error(uiText.loadSetsError);
        }
    };

    const createDefaultSet = async () => {
        try {
            const defaultName =
                language === 'ru' ? 'Стандартный сет' :
                    language === 'uz' ? 'Standart set' :
                        'Default set';
            const defaultDesc =
                language === 'ru' ? 'Автоматически созданный сет' :
                    language === 'uz' ? 'Avtomatik yaratilgan set' :
                        'Auto-created default set';
            const response = await fetch('/api/admin/sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: defaultName,
                    description: defaultDesc
                })
            });

            if (response.ok) {
                const newSet = await response.json();
                setSets([newSet]);
                setSelectedSet(newSet);
                toast.success(defaultName);
            }
        } catch (e) {
            console.error('Failed to create default set', e);
        }
    };

    const fetchDishes = async () => {
        try {
            const response = await fetch('/api/admin/warehouse/dishes');
            if (response.ok) {
                const data = await response.json();
                // Ensure IDs are strings to match our selection state naturally, or keep as is.
                // The DB returns objects. id might be string or number (if we seeded as "1").
                // Let's use them as is but treat IDs flexibly.
                setAvailableDishes(data);
            }
        } catch (error) {
            console.error('Error fetching dishes:', error);
            toast.error(uiText.loadDishesError);
        }
    };

    const fetchWarehouseItems = async () => {
        try {
            const response = await fetch('/api/admin/warehouse/ingredients');
            if (response.ok) {
                const data = await response.json();
                setWarehouseItems(Array.isArray(data) ? data : []);
            }
        } catch {
            // calorie totals are best-effort; ignore loading failures here
            setWarehouseItems([]);
        }
    };

    useEffect(() => {
        fetchSetsRef.current = fetchSets;
        fetchDishesRef.current = fetchDishes;
        fetchWarehouseItemsRef.current = fetchWarehouseItems;
    });

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchSetsRef.current(),
                fetchDishesRef.current(),
                fetchWarehouseItemsRef.current(),
            ]);
            setIsLoading(false);
        };
        void init();
    }, []);

    const normalizeName = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

    const normalizeIngredients = (raw: unknown): Ingredient[] => {
        if (!Array.isArray(raw)) return [];
        const toOptionalNumber = (value: unknown): number | undefined => {
            const n = typeof value === 'number' ? value : Number(value);
            return Number.isFinite(n) ? n : undefined;
        };
        return raw
            .map((value) => {
                const i = isRecord(value) ? value : {};
                return {
                    name: typeof i.name === 'string' ? i.name : '',
                    amount: typeof i.amount === 'number' && Number.isFinite(i.amount) ? i.amount : Number(i.amount) || 0,
                    unit: typeof i.unit === 'string' ? i.unit : 'gr',
                    kcalPerGram: toOptionalNumber(i.kcalPerGram),
                    pricePerUnit: toOptionalNumber(i.pricePerUnit),
                    priceUnit: typeof i.priceUnit === 'string' && i.priceUnit.trim().length > 0 ? i.priceUnit : undefined,
                };
            })
            .filter((i) => i.name.trim().length > 0);
    };

    const resetAddMealDraft = () => {
        setSelectedDishToAdd('');
        setMealNameToAdd('');
        setDraftMealIngredients([]);
        setCustomDraftIngredient({ name: '', amount: '', unit: 'gr', kcalPerGram: '', pricePerUnit: '', priceUnit: 'kg' });
    };

    const selectDishForAdd = (dish: Dish) => {
        setSelectedDishToAdd(String(dish?.id ?? ''));
        setMealNameToAdd(String(dish?.name ?? ''));
        setDraftMealIngredients(normalizeIngredients(dish?.ingredients));
    };

    const addDraftIngredient = (name: string) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        if (draftMealIngredients.find((i) => normalizeName(i.name) === normalizeName(trimmed))) {
            toast.error(uiText.ingredientAlreadyAdded);
            return;
        }
        const found = getAllUniqueIngredients().find((i) => i.name === trimmed);
        setDraftMealIngredients((prev) => [
            ...prev,
            { name: trimmed, amount: 0, unit: found?.unit || 'gr' },
        ]);
    };

    const addCustomDraftIngredient = () => {
        const name = customDraftIngredient.name.trim();
        const amount = Number(customDraftIngredient.amount);
        const kcalPerGram = customDraftIngredient.kcalPerGram.trim() === '' ? undefined : Number(customDraftIngredient.kcalPerGram);
        const pricePerUnit = customDraftIngredient.pricePerUnit.trim() === '' ? undefined : Number(customDraftIngredient.pricePerUnit);
        if (!name || !Number.isFinite(amount) || amount <= 0) {
            toast.error(uiText.addIngredient);
            return;
        }
        if (draftMealIngredients.find((i) => normalizeName(i.name) === normalizeName(name))) {
            toast.error(uiText.ingredientAlreadyAdded);
            return;
        }
        setDraftMealIngredients((prev) => [
            ...prev,
            {
                name,
                amount,
                unit: customDraftIngredient.unit || 'gr',
                kcalPerGram: Number.isFinite(kcalPerGram as number) ? (kcalPerGram as number) : undefined,
                pricePerUnit: Number.isFinite(pricePerUnit as number) ? (pricePerUnit as number) : undefined,
                priceUnit: customDraftIngredient.priceUnit || customDraftIngredient.unit || 'kg',
            }
        ]);
        setCustomDraftIngredient({ name: '', amount: '', unit: 'gr', kcalPerGram: '', pricePerUnit: '', priceUnit: 'kg' });
    };

    const removeDraftIngredient = (index: number) => {
        setDraftMealIngredients((prev) => prev.filter((_, i) => i !== index));
    };

    const updateDraftIngredientAmount = (index: number, amount: number) => {
        setDraftMealIngredients((prev) =>
            prev.map((ing, i) => (i === index ? { ...ing, amount } : ing))
        );
    };

    const updateDraftIngredient = (index: number, patch: Partial<Ingredient>) => {
        setDraftMealIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
    };

    const createSet = async () => {
        if (!newSetForm.name.trim()) {
            toast.error(uiText.setNameRequired);
            return;
        }

        try {
            const response = await fetch('/api/admin/sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSetForm.name,
                    description: newSetForm.description
                })
            });

            if (response.ok) {
                const newSet = await response.json();
                setSets(prev => [newSet, ...prev]);
                setSelectedSet(newSet);
                setIsCreateModalOpen(false);
                setNewSetForm({ name: '', description: '' });
                toast.success(uiText.create);
            } else {
                toast.error(uiText.saveError);
            }
        } catch {
            toast.error(uiText.saveError);
        }
    };

    // Helper: Get data for current day, or init default
    const getCurrentDayData = (): CalorieGroup[] => {
        if (!selectedSet) return [];

        // Safety check for legacy data
        if (Array.isArray(selectedSet.calorieGroups)) return [];

        // Check if data exists for this day
        const dayData = selectedSet.calorieGroups[activeDay];

        if (dayData) return dayData;

        return [];
    };

    // Copy standard menu to current day
    const buildStandardDayData = (dayNum: number): CalorieGroup[] | null => {
        const menuNumber = ((dayNum - 1) % 21) + 1;
        const menuData = MENUS.find(m => m.menuNumber === menuNumber);
        if (!menuData) return null;

        return [
            {
                id: 'group-1',
                calories: 0,
                name: '1',
                price: null,
                dishes: menuData.dishes.map((dish) => ({
                    dishId: dish.id,
                    dishName: dish.name,
                    mealType: dish.mealType,
                    customIngredients: undefined,
                })),
            },
        ];
    };

    const copyStandardMenuToDay = async () => {
        if (!selectedSet) return;

        const dayNum = parseInt(activeDay);
        const newDayData = buildStandardDayData(dayNum);

        if (!newDayData) {
            toast.error(uiText.noDayDataTitle);
            return;
        }

        const updatedGroups = {
            ...(selectedSet.calorieGroups || {}),
            [activeDay]: newDayData
        };

        const updatedSet = { ...selectedSet, calorieGroups: updatedGroups };

        // Optimistic
        setSelectedSet(updatedSet);
        setSets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));

        // Save
        await saveSet(updatedSet);
        toast.success(uiText.copiedDay(activeDay));
    };

    const saveSet = async (setToSave: MenuSet) => {
        try {
            const response = await fetch(`/api/admin/sets/${setToSave.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ calorieGroups: setToSave.calorieGroups })
            });
            if (!response.ok) {
                throw new Error(`save_set_failed_${response.status}`);
            }
        } catch (e) {
            console.error(e);
            toast.error(uiText.saveError);
        }
    };

    useEffect(() => {
        if (!isGroupModalOpen) return;

        if (editingGroup) {
            setGroupForm({
                name: editingGroup.group.name || '',
                price: typeof editingGroup.group.price === 'number' ? String(editingGroup.group.price) : '',
            });
            return;
        }

        setGroupForm({ name: '', price: '' });
    }, [editingGroup, isGroupModalOpen]);

    const makeGroupId = () => {
        try {
            const id = globalThis.crypto?.randomUUID?.();
            if (typeof id === 'string' && id.length > 0) return id;
        } catch {
            // ignore
        }
        return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    };

    const upsertGroup = async () => {
        if (!selectedSet) return;

        const baseGroups = getBaseGroups(selectedSet);
        const meta = getMeta(selectedSet);

        const dayGroups = Array.isArray(baseGroups[String(activeDay)]) ? baseGroups[String(activeDay)] : [];
        const defaultNumberName = editingGroup ? String(editingGroup.groupIndex + 1) : String(dayGroups.length + 1);
        const name = (groupForm.name || '').trim() || defaultNumberName;
        const rawPrice = String(groupForm.price || '').trim();
        let price: number | null = null;
        if (rawPrice !== '') {
            const normalized = rawPrice.replace(/\s+/g, '').replace(',', '.');
            const parsed = Number(normalized);
            if (!Number.isFinite(parsed) || parsed < 0) {
                toast.error(uiText.saveError);
                return;
            }
            price = parsed;
        }

        const nextId = editingGroup?.group?.id || makeGroupId();

        const dayKeys = getDayKeysFromGroups(baseGroups);
        const ensuredKeys = dayKeys.length > 0 ? dayKeys : Array.from({ length: 21 }, (_, i) => String(i + 1));

        const nextGroups: DayConfig = {};
        for (const dayKey of ensuredKeys) {
            const dayArr: CalorieGroup[] = Array.isArray(baseGroups[dayKey]) ? baseGroups[dayKey] : [];

            if (editingGroup) {
                nextGroups[dayKey] = dayArr.map((g) => (g.id === nextId ? { ...g, id: nextId, name, price, dishes: g.dishes || [] } : g));
            } else {
                nextGroups[dayKey] = [
                    ...dayArr,
                    { id: nextId, name, price, dishes: [] },
                ];
            }
        }
        attachGroupsMeta(nextGroups, {
            ...meta,
            groupOrder: (() => {
                const existing = Array.isArray(meta.groupOrder) ? meta.groupOrder.map(String) : [];
                if (existing.includes(String(nextId))) return existing;
                return [...existing, String(nextId)];
            })(),
        });

        const updatedSet = { ...selectedSet, calorieGroups: nextGroups };
        setSelectedSet(updatedSet);
        setSets((prev) => prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)));
        setIsGroupModalOpen(false);
        setEditingGroup(null);
        await saveSet(updatedSet);
        toast.success(uiText.saveChanges);
    };

    // CRUD Operations for Dishes (similar to before but aware of Day structure)

    // Ingredient Management
    const getAllUniqueIngredients = () => {
        const ingredients = new Map<string, string>(); // name -> unit
        availableDishes.forEach(d => {
            d.ingredients?.forEach(i => ingredients.set(i.name, i.unit));
        });
        // Also include warehouse items so managers can add any newly created ingredient.
        warehouseItems.forEach((item) => {
            const name = typeof item?.name === 'string' ? item.name.trim() : '';
            if (!name) return;
            ingredients.set(name, item.unit || 'gr');
        });
        return Array.from(ingredients.entries()).map(([name, unit]) => ({ name, unit })).sort((a, b) => a.name.localeCompare(b.name));
    };

    const removeIngredient = (index: number) => {
        if (!editingDish) return;
        const currentIngredients = editingDish.dish.customIngredients
            ? [...editingDish.dish.customIngredients]
            : [...getOriginalIngredients(editingDish.dish.dishId, availableDishes)];

        currentIngredients.splice(index, 1);

        setEditingDish({
            ...editingDish,
            dish: { ...editingDish.dish, customIngredients: currentIngredients }
        });
    };

    const updateEditingIngredient = (index: number, patch: Partial<Ingredient>) => {
        if (!editingDish) return;
        const currentIngredients = editingDish.dish.customIngredients
            ? [...editingDish.dish.customIngredients]
            : [...getOriginalIngredients(editingDish.dish.dishId, availableDishes)];
        currentIngredients[index] = { ...currentIngredients[index], ...patch };
        setEditingDish({
            ...editingDish,
            dish: { ...editingDish.dish, customIngredients: currentIngredients }
        });
    };

    const addCustomIngredientToEditingDish = () => {
        if (!editingDish) return;
        const name = customEditIngredient.name.trim();
        const amount = Number(customEditIngredient.amount);
        const kcalPerGram = customEditIngredient.kcalPerGram.trim() === '' ? undefined : Number(customEditIngredient.kcalPerGram);
        const pricePerUnit = customEditIngredient.pricePerUnit.trim() === '' ? undefined : Number(customEditIngredient.pricePerUnit);
        if (!name || !Number.isFinite(amount) || amount <= 0) {
            toast.error(uiText.addIngredient);
            return;
        }
        const currentIngredients = editingDish.dish.customIngredients
            ? [...editingDish.dish.customIngredients]
            : [...getOriginalIngredients(editingDish.dish.dishId, availableDishes)];
        if (currentIngredients.find(i => normalizeName(i.name) === normalizeName(name))) {
            toast.error(uiText.ingredientAlreadyAdded);
            return;
        }
        const existing = getAllUniqueIngredients().find((i) => normalizeName(i.name) === normalizeName(name));
        const warehouseMeta = warehouseItemByName.get(normalizeName(name));
        const resolvedUnit = customEditIngredient.unit || existing?.unit || 'gr';
        const resolvedKcal =
            Number.isFinite(kcalPerGram as number)
                ? (kcalPerGram as number)
                : (typeof warehouseMeta?.kcalPerGram === 'number' ? warehouseMeta.kcalPerGram : undefined);
        const resolvedPrice =
            Number.isFinite(pricePerUnit as number)
                ? (pricePerUnit as number)
                : (typeof warehouseMeta?.pricePerUnit === 'number' ? warehouseMeta.pricePerUnit : undefined);
        currentIngredients.push({
            name,
            amount,
            unit: resolvedUnit,
            kcalPerGram: resolvedKcal,
            pricePerUnit: resolvedPrice,
            priceUnit: customEditIngredient.priceUnit || resolvedUnit || 'kg',
        });
        setEditingDish({
            ...editingDish,
            dish: { ...editingDish.dish, customIngredients: currentIngredients }
        });
        setCustomEditIngredient({ name: '', amount: '', unit: 'gr', kcalPerGram: '', pricePerUnit: '', priceUnit: 'kg' });
    };

    const updateEditingDish = async () => {
        if (!editingDish || !selectedSet) return;

        const currentData = getCurrentDayData();
        const updatedDayData = [...currentData];

        // Ensure structure exists
        if (!updatedDayData[editingDish.calorieIndex]) return;

        updatedDayData[editingDish.calorieIndex].dishes[editingDish.dishIndex] = editingDish.dish;

        const updatedGroups = {
            ...(selectedSet.calorieGroups || {}),
            [activeDay]: updatedDayData
        };

        const updatedSet = { ...selectedSet, calorieGroups: updatedGroups };

        setSelectedSet(updatedSet);
        setSets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));
        setIsEditDishModalOpen(false);
        setEditingDish(null);

        await saveSet(updatedSet);
        toast.success(uiText.saveChanges);
    };

    const deleteDishFromGroup = async (calorieIndex: number, dishIndex: number) => {
        if (!selectedSet) return;

        const currentData = getCurrentDayData();
        const updatedDayData = [...currentData]; // Shallow copy of array

        // Deep copy of dishes array to modify it
        updatedDayData[calorieIndex] = {
            ...updatedDayData[calorieIndex],
            dishes: [...updatedDayData[calorieIndex].dishes]
        };

        updatedDayData[calorieIndex].dishes.splice(dishIndex, 1);

        const updatedGroups = {
            ...(selectedSet.calorieGroups || {}),
            [activeDay]: updatedDayData
        };
        const updatedSet = { ...selectedSet, calorieGroups: updatedGroups };

        setSelectedSet(updatedSet);
        setSets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));
        await saveSet(updatedSet);
    };

    const addDishToGroup = async () => {
        if (!selectedSet || !addDishTarget) return;

        const enteredName = mealNameToAdd.trim();
        if (!enteredName) {
            toast.error(uiText.mealNameRequired);
            return;
        }

        // Prefer explicitly selected dish; fallback to exact-name match.
        let dishObj: DishDraft | null =
            selectedDishToAdd
                ? availableDishes.find((dish) => String(dish.id) === selectedDishToAdd) ?? null
                : availableDishes.find((dish) => normalizeName(dish.name) === normalizeName(enteredName)) ?? null;

        const ingredientsToUse =
            draftMealIngredients.length > 0
                ? draftMealIngredients
                : (dishObj ? normalizeIngredients(dishObj.ingredients) : []);

        if (!dishObj) {
            try {
                const response = await fetch('/api/admin/warehouse/dishes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: enteredName,
                        description: '',
                        mealType: 'CUSTOM',
                        ingredients: ingredientsToUse,
                        menuNumbers: [],
                    }),
                });

                if (!response.ok) {
                    toast.error(uiText.saveError);
                    return;
                }

                dishObj = parseDishDraft(await response.json().catch(() => null));
                await fetchDishes();
            } catch {
                toast.error(uiText.saveError);
                return;
            }
        }

        if (!dishObj) {
            toast.error(uiText.saveError);
            return;
        }

        const currentData = getCurrentDayData();

        // If empty, init it first? But copyStandardMenuToDay handles bulk init.
        // Assuming array exists if we are adding via button which is inside tab content

        const updatedDayData = [...currentData];
        if (updatedDayData.length === 0) {
            // Edge case: empty day, user clicks add manually without copying
            // Initialize structure
            updatedDayData.push({ id: 'group-1', calories: 0, name: '1', price: null, dishes: [] });
        }

        updatedDayData[addDishTarget.calorieIndex] = {
            ...updatedDayData[addDishTarget.calorieIndex],
            dishes: [...updatedDayData[addDishTarget.calorieIndex].dishes]
        };

        const dishesArr = updatedDayData[addDishTarget.calorieIndex].dishes;
        const maxMealIndex = dishesArr.reduce((acc, dish) => {
            const n = typeof dish.mealIndex === 'number' ? dish.mealIndex : 0;
            return Math.max(acc, Number.isFinite(n) ? n : 0);
        }, 0);
        const mealIndex = maxMealIndex + 1;

        dishesArr.push({
            dishId: dishObj.id,
            dishName: dishObj.name?.trim() || enteredName,
            mealType: dishObj.mealType || 'CUSTOM',
            mealIndex,
            customIngredients: ingredientsToUse.length > 0 ? [...ingredientsToUse] : undefined
        });

        const updatedGroups = {
            ...(selectedSet.calorieGroups || {}),
            [activeDay]: updatedDayData
        };

        const updatedSet = { ...selectedSet, calorieGroups: updatedGroups };
        setSelectedSet(updatedSet);
        setSets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));

        setIsAddDishModalOpen(false);
        setAddDishTarget(null);
        resetAddMealDraft();

        await saveSet(updatedSet);
        toast.success(uiText.addMeal);
    };

    const deleteSet = async (id: string) => {
        if (!confirm(uiText.confirmDeleteSet)) return;
        await fetch(`/api/admin/sets/${id}`, { method: 'DELETE' });
        setSets((prev) => {
            const next = prev.filter((s) => s.id !== id);
            if (selectedSet?.id === id) {
                setSelectedSet(next[0] || null);
                setActiveDay('1');
                setActiveGroupTab('');
            }
            return next;
        });
        toast.success(uiText.deleted);
    };

    const kcalPerGramByName = useMemo(() => {
        const m = new Map<string, number>();
        for (const item of warehouseItems) {
            const name = typeof item?.name === 'string' ? item.name.trim().toLowerCase() : '';
            const kcal = typeof item?.kcalPerGram === 'number' && Number.isFinite(item.kcalPerGram) ? item.kcalPerGram : null;
            if (!name || kcal === null) continue;
            m.set(name, kcal);
        }
        return m;
    }, [warehouseItems]);

    const formatUzs = (value: number) => {
        const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
        return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v));
    };

    // Compact format for tight labels (e.g. group tabs): 84000 -> "84k".
    const formatUzsCompact = (value: number) => {
        const v = typeof value === 'number' && Number.isFinite(value) ? value : 0;
        if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
        return String(Math.round(v));
    };

    const getGroupDisplayName = (group: CalorieGroup, index: number) => {
        const raw = String(group?.name || '').trim();
        if (!raw) return String(index + 1);
        return raw;
    };

    const warehouseItemByName = useMemo(() => {
        const map = new Map<string, { kcalPerGram: number | null; pricePerUnit: number | null; priceUnit: string }>();
        for (const item of warehouseItems) {
            const key = String(item?.name || '').trim().toLowerCase();
            if (!key) continue;
            map.set(key, {
                kcalPerGram: typeof item?.kcalPerGram === 'number' && Number.isFinite(item.kcalPerGram) ? item.kcalPerGram : null,
                pricePerUnit: typeof item?.pricePerUnit === 'number' && Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : null,
                priceUnit: String(item?.priceUnit || item?.unit || 'kg').trim() || 'kg',
            });
        }
        return map;
    }, [warehouseItems]);

    const visibleSets = useMemo(() => {
        const q = setSearch.trim().toLowerCase();
        const filtered = !q ? sets : sets.filter((s) => (s.name || '').toLowerCase().includes(q));

        if (!setsOrder || setsOrder.length === 0) return filtered;
        const idx = new Map<string, number>();
        setsOrder.forEach((id, i) => idx.set(id, i));
        return filtered.slice().sort((a, b) => {
            const aI = idx.has(a.id) ? (idx.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
            const bI = idx.has(b.id) ? (idx.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
            if (aI !== bI) return aI - bI;
            // Stable fallback: keep API order (createdAt desc)
            return 0;
        });
    }, [setSearch, sets, setsOrder]);

    const currentDayDataRaw = getCurrentDayData();
    const currentDayData = useMemo(() => {
        return (currentDayDataRaw || []).map((g, idx) => ({
            ...g,
            id: g.id || `group-${idx + 1}`,
            price: typeof g.price === 'number' ? g.price : (g.price ?? null),
        }));
    }, [currentDayDataRaw]);
    const visibleDayGroups = useMemo(() => {
        return currentDayData.filter((g) => {
            const rawName = String(g?.name || '').trim();
            const isNumericLabel = /^\d+$/.test(rawName);
            const hasPrice = typeof g?.price === 'number' && Number.isFinite(g.price);
            const hasDishes = Array.isArray(g?.dishes) && g.dishes.length > 0;
            // Ignore day-like placeholders from legacy structures (e.g. 1..22 with no dishes/price).
            return !isNumericLabel || hasPrice || hasDishes;
        });
    }, [currentDayData]);
    const hasDataForDay = visibleDayGroups.length > 0;

    const dayKeys = useMemo(() => {
        if (!selectedSet || !selectedSet.calorieGroups || Array.isArray(selectedSet.calorieGroups)) {
            return Array.from({ length: 21 }, (_, i) => String(i + 1));
        }

        const base = getBaseGroups(selectedSet);
        const meta = getMeta(selectedSet);
        const existing = getDayKeysFromGroups(base).sort((a, b) => Number(a) - Number(b));
        if (existing.length === 0) return Array.from({ length: 21 }, (_, i) => String(i + 1));

        const order = Array.isArray(meta.dayOrder) ? meta.dayOrder.map(String) : [];
        if (order.length === 0) return existing;

        // Keep only existing keys, preserve order, then append any missing.
        const existingSet = new Set(existing);
        const next: string[] = [];
        for (const k of order) if (existingSet.has(k)) next.push(k);
        for (const k of existing) if (!next.includes(k)) next.push(k);
        return next;
    }, [selectedSet]);

    const selectedSummaryDayKeys = useMemo(() => {
        if (dayKeys.length === 0) return [] as string[];
        if (!periodRange?.from) return [activeDay];

        const start = new Date(periodRange.from);
        start.setHours(0, 0, 0, 0);
        const end = new Date(periodRange.to ?? periodRange.from);
        end.setHours(0, 0, 0, 0);

        const assigned = getAssignedPeriodRange(selectedSet);
        const anchor = new Date(assigned?.from ?? start);
        anchor.setHours(0, 0, 0, 0);

        const result: string[] = [];
        const maxSpan = 62;
        const cursor = new Date(start);

        while (cursor.getTime() <= end.getTime() && result.length < maxSpan) {
            const dayNumber = Math.floor((cursor.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const key = String(dayNumber);
            if (dayKeys.includes(key)) result.push(key);
            cursor.setDate(cursor.getDate() + 1);
        }

        return result.length > 0 ? result : [activeDay];
    }, [dayKeys, periodRange, activeDay, selectedSet]);

    const selectedDayBadgeLabel = useMemo(() => {
        if (selectedSummaryDayKeys.length !== 1) return null;
        return `Day:${selectedSummaryDayKeys[0]}`;
    }, [selectedSummaryDayKeys]);

    const selectedDaysSummary = useMemo(() => {
        if (!selectedSet) {
            return { days: 0, dishes: 0, calories: 0, price: 0 };
        }
        const baseGroups = getBaseGroups(selectedSet);
        let dishes = 0;
        let calories = 0;
        let price = 0;

        for (const dayKey of selectedSummaryDayKeys) {
            const dayGroups: CalorieGroup[] = Array.isArray(baseGroups[dayKey]) ? baseGroups[dayKey] : [];
            for (const group of dayGroups) {
                for (const dish of group?.dishes || []) {
                    dishes += 1;
                    calories += getDishCalories(dish as SetDish, availableDishes, kcalPerGramByName);
                    price += getDishPrice(dish as SetDish, availableDishes, warehouseItemByName);
                }
            }
        }

        return {
            days: selectedSummaryDayKeys.length,
            dishes,
            calories: Math.round(calories),
            price: Math.round(price),
        };
    }, [selectedSet, selectedSummaryDayKeys, warehouseItemByName, kcalPerGramByName, availableDishes]);

    const calendarUiText = useMemo(() => {
        if (language === 'ru') {
            return { calendar: 'Период', today: 'Сегодня', thisWeek: 'Неделя', thisMonth: 'Месяц', clearRange: 'Сброс', allTime: 'Выбрать период' };
        }
        if (language === 'uz') {
            return { calendar: 'Davr', today: 'Bugun', thisWeek: 'Hafta', thisMonth: 'Oy', clearRange: 'Tozalash', allTime: 'Davr tanlang' };
        }
        return { calendar: 'Period', today: 'Today', thisWeek: 'Week', thisMonth: 'Month', clearRange: 'Clear', allTime: 'Select period' };
    }, [language]);

    const setToThisSetLabel = useMemo(() => {
        if (language === 'ru') return 'Установить на этот сет';
        if (language === 'uz') return 'Ushbu setga biriktirish';
        return 'Set to this set';
    }, [language]);

    const periodAssignedMessage = useMemo(() => {
        if (language === 'ru') return 'Период привязан к выбранному сету';
        if (language === 'uz') return 'Davr tanlangan setga biriktirildi';
        return 'Period assigned to selected set';
    }, [language]);

    const applySelectedPeriodToSet = async () => {
        if (!selectedSet || !periodRange?.from) return;
        const from = new Date(periodRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(periodRange.to ?? periodRange.from);
        to.setHours(0, 0, 0, 0);

        const baseGroups = getBaseGroups(selectedSet);
        const meta = getMeta(selectedSet);
        const nextGroups = attachGroupsMeta({ ...baseGroups }, {
            ...meta,
            assignedPeriod: {
                from: from.toISOString(),
                to: to.toISOString(),
            },
        });

        const updatedSet = { ...selectedSet, calorieGroups: nextGroups };
        setSelectedSet(updatedSet);
        setSets((prev) => prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)));
        await saveSet(updatedSet);
        toast.success(periodAssignedMessage);
    };

    const deleteGroupById = async (groupId: string) => {
        if (!selectedSet) return;
        if (!groupId) return;
        if (!confirm(uiText.confirmDeleteGroup)) return;

        const baseGroups = getBaseGroups(selectedSet);
        const meta = getMeta(selectedSet);

        const nextGroups: DayConfig = {};
        for (const dayKey of getDayKeysFromGroups(baseGroups)) {
            const dayArr: CalorieGroup[] = Array.isArray(baseGroups[dayKey]) ? baseGroups[dayKey] : [];
            nextGroups[dayKey] = dayArr.filter((g) => String(g.id || '') !== String(groupId));
        }
        attachGroupsMeta(nextGroups, {
            ...meta,
            groupOrder: Array.isArray(meta.groupOrder) ? meta.groupOrder.filter((id) => String(id) !== String(groupId)) : undefined,
        });

        const updatedSet = { ...selectedSet, calorieGroups: nextGroups };
        setSelectedSet(updatedSet);
        setSets((prev) => prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)));

        setActiveGroupTab((prev) => {
            if (prev !== groupId) return prev;
            const forActiveDay = nextGroups[String(activeDay)] || [];
            const ensured = forActiveDay.map((g, idx) => ({ ...g, id: g.id || `group-${idx + 1}` }));
            return ensured[0]?.id || '';
        });

        await saveSet(updatedSet);
        toast.success(uiText.deleted);
    };

    useEffect(() => {
        if (!hasDataForDay) return;
        if (visibleDayGroups.some((g) => g.id === activeGroupTab)) return;
        setActiveGroupTab(visibleDayGroups[0]?.id || '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDay, hasDataForDay, visibleDayGroups]);

    useEffect(() => {
        if (!dayKeys.includes(activeDay)) {
            setActiveDay(dayKeys[0] || '1');
        }
    }, [dayKeys, activeDay]);

    useEffect(() => {
        if (!selectedSet) return;
        if (selectedSetIdForPeriod === selectedSet.id) return;

        setSelectedSetIdForPeriod(selectedSet.id);

        const assignedRange = getAssignedPeriodRange(selectedSet);
        setPeriodRange(assignedRange);

        if (assignedRange?.from) {
            const mappedDay = resolveDayKeyForDate(assignedRange.from, selectedSet, dayKeys[0] || '1');
            if (dayKeys.includes(mappedDay)) {
                setActiveDay(mappedDay);
                return;
            }
        }

        setActiveDay(dayKeys[0] || '1');
    }, [selectedSet, selectedSetIdForPeriod, dayKeys]);

    if (isLoading) return <div className="p-8"><div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent mx-auto"></div></div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold">{uiText.title}</h2>
                    <p className="text-sm text-muted-foreground">{uiText.subtitle}</p>
                </div>

                {/* Orders-tab style: wrap on mobile so actions never disappear off-screen. */}
                <ResourceActionBar
                    searchValue={setSearch}
                    onSearchChange={setSetSearch}
                    searchPlaceholder={uiText.search}
                    className="w-full border-0 pb-0 sm:w-auto sm:flex-1 sm:border-0 sm:pb-0"
                >
                    <CalendarRangeSelector
                        value={periodRange}
                        onChange={(next) => {
                            if (!next?.from) {
                                setPeriodRange(undefined);
                                setActiveDay(dayKeys[0] || '1');
                                return;
                            }
                            const start = new Date(next.from);
                            start.setHours(0, 0, 0, 0);
                            const end = new Date(next.to ?? next.from);
                            end.setHours(0, 0, 0, 0);
                            setPeriodRange({ from: start, to: end });
                            const mappedDay = resolveDayKeyForDate(start, selectedSet, dayKeys[0] || '1');
                            if (dayKeys.includes(mappedDay)) {
                                setActiveDay(mappedDay);
                            } else {
                                setActiveDay(dayKeys[0] || '1');
                            }
                        }}
                        uiText={calendarUiText}
                        locale={language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US'}
                        highlightAfterRange
                        className="w-full sm:w-[280px] md:w-[320px] flex-none basis-full sm:basis-auto"
                    />
                    <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full sm:w-auto flex-none basis-full sm:basis-auto"
                        disabled={!selectedSet || !periodRange?.from}
                        onClick={() => void applySelectedPeriodToSet()}
                    >
                        {setToThisSetLabel}
                    </Button>
                </ResourceActionBar>
            </div>

            <div className="space-y-4">
                {/* Sets Selector Row (replaces sidebar) */}
                <Card className="bg-card border-2 border-border overflow-hidden">
                    <div className="p-2 overflow-x-auto">
                        <div className="flex items-center gap-1 min-w-max">
                            <span className="text-xs font-medium px-2 text-main-foreground/80 mr-2 flex items-center gap-1">
                                <Scale className="w-4 h-4" />
                                {uiText.setsList}:
                            </span>

                            {visibleSets.map((set) => {
                                const isSelected = selectedSet?.id === set.id;
                                return (
                                    <Button
                                        key={set.id}
                                        type="button"
                                        onClick={() => setSelectedSet(set)}
                                        variant="ghost"
                                        className={[
                                            "h-9 min-w-[140px] max-w-[220px] px-3 rounded-base flex items-center border-2 justify-start",
                                            isSelected
                                                ? "border-border bg-background text-foreground"
                                                : "border-transparent bg-transparent text-main-foreground hover:border-border hover:bg-secondary-background",
                                        ].join(" ")}
                                        title={set.name}
                                    >
                                        <span className="truncate text-sm font-medium flex-1 text-left">{set.name}</span>
                                    </Button>
                                );
                            })}

                            <IconButton
                                label={uiText.newSet}
                                variant="ghost"
                                iconSize="md"
                                className={rowIconBtnGhostClass}
                                onClick={() => setIsCreateModalOpen(true)}
                            >
                                <Plus className="h-4 w-4" />
                            </IconButton>

                            <IconButton
                                label={uiText.delete}
                                variant="ghost"
                                iconSize="md"
                                className={rowIconBtnDeleteClass}
                                disabled={!selectedSet}
                                onClick={() => selectedSet ? void deleteSet(selectedSet.id) : undefined}
                            >
                                <Trash2 className="h-4 w-4" />
                            </IconButton>
                        </div>
                    </div>
                </Card>

                {selectedSet ? (
                    <div className="space-y-4">
                            <Card className="bg-card border border-border/70">
                                <CardContent className="px-4 py-3">
                                    {selectedDayBadgeLabel ? (
                                        <div className="mb-2 text-xs font-semibold text-main-foreground/80">{selectedDayBadgeLabel}</div>
                                    ) : null}
                                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                                        <div className="bg-card rounded-md border px-3 py-2">
                                            <p className="text-[11px] text-muted-foreground">{uiText.dishesLabel}</p>
                                            <p className="font-semibold tabular-nums">{selectedDaysSummary.dishes}</p>
                                        </div>
                                        <div className="bg-card rounded-md border px-3 py-2">
                                            <p className="text-[11px] text-muted-foreground">{uiText.caloriesLabel}</p>
                                            <p className="font-semibold tabular-nums">{new Intl.NumberFormat('ru-RU').format(selectedDaysSummary.calories)}</p>
                                        </div>
                                        <div className="bg-card rounded-md border px-3 py-2">
                                            <p className="text-[11px] text-muted-foreground">{uiText.priceLabel}</p>
                                            <p className="font-semibold tabular-nums">{formatUzs(selectedDaysSummary.price)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-card min-h-[600px] flex flex-col">
                                {/* Day Content */}
                                <CardContent className="flex-1 p-0">
                                    {!hasDataForDay ? (
                                            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                                <UtensilsCrossed className="w-16 h-16 text-muted-foreground/60 mb-4" />
                                            <h3 className="text-lg font-medium text-foreground mb-2">{uiText.noDayDataTitle}</h3>
                                            <p className="max-w-md mb-6">{uiText.noDayDataDesc(activeDay)}</p>
                                            <IconButton label={uiText.copyStandard(activeDay)} onClick={copyStandardMenuToDay} iconSize="md">
                                                <Copy className="h-4 w-4" />
                                            </IconButton>
                                        </div>
                                    ) : (
                                        <Tabs value={activeGroupTab} onValueChange={setActiveGroupTab} className="h-full flex flex-col">
                                            <div className="px-6 py-2 border-b-2 border-black flex items-center gap-2 bg-yellow-300 text-black dark:border-yellow-300 dark:bg-black/60 dark:text-white">
                                                <TabsList className="flex flex-wrap w-full justify-start gap-1 bg-transparent">
                                                    {visibleDayGroups.map((g, idx) => (
                                                        <TabsTrigger
                                                            key={g.id}
                                                            value={g.id as string}
                                                            className="px-3 border-2 border-black bg-yellow-100 text-black data-[state=active]:bg-black data-[state=active]:text-yellow-200 dark:border-yellow-300 dark:bg-black/35 dark:text-white dark:data-[state=active]:bg-yellow-300 dark:data-[state=active]:text-black"
                                                        >
                                                            <span className="max-w-[160px] truncate">
                                                                {(() => {
                                                                    const groupLabel = getGroupDisplayName(g, idx);
                                                                    return /^\d+$/.test(groupLabel) ? `${uiText.group} ${groupLabel}` : groupLabel;
                                                                })()}
                                                            </span>
                                                            {typeof g.price === 'number' && Number.isFinite(g.price) ? (
                                                                <span className="ml-1 text-[10px] tabular-nums opacity-80">
                                                                    {formatUzsCompact(g.price)}
                                                                </span>
                                                            ) : null}
                                                        </TabsTrigger>
                                                    ))}
                                                </TabsList>

                                                <IconButton
                                                    label={uiText.newGroup}
                                                    variant="outline"
                                                    iconSize="md"
                                                    className={`${rowIconBtnClass} border-black bg-yellow-100 text-black hover:bg-yellow-200 dark:border-yellow-300 dark:bg-black/35 dark:text-white dark:hover:bg-yellow-300 dark:hover:text-black`}
                                                    onClick={() => {
                                                        setEditingGroup(null)
                                                        setIsGroupModalOpen(true)
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </IconButton>

                                                <IconButton
                                                    label={uiText.delete}
                                                    variant="outline"
                                                    iconSize="md"
                                                    className={`${rowIconBtnClass} border-black bg-yellow-100 text-black hover:bg-yellow-200 dark:border-yellow-300 dark:bg-black/35 dark:text-white dark:hover:bg-yellow-300 dark:hover:text-black`}
                                                    disabled={!activeGroupTab}
                                                    onClick={() => void deleteGroupById(activeGroupTab)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </IconButton>

                                            </div>

                                            {visibleDayGroups.map((group) => {
                                                    const groupIdx = visibleDayGroups.findIndex((g) => g.id === group.id)

                                                    const dishesSorted = (group.dishes || [])
                                                        .slice()
                                                        .sort((a, b) => {
                                                            const aN = typeof a.mealIndex === 'number' ? a.mealIndex : (getMealIndex(String(a.mealType)) ?? 999)
                                                            const bN = typeof b.mealIndex === 'number' ? b.mealIndex : (getMealIndex(String(b.mealType)) ?? 999)
                                                            return aN - bN
                                                        })

                                                    return (
                                                        <TabsContent key={group.id} value={group.id as string} className="flex-1 p-6 m-0 bg-card">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <Flame className="w-5 h-5 text-orange-500" />
                                                                        <span className="font-semibold text-lg truncate">
                                                                            {getGroupDisplayName(group, groupIdx)}
                                                                        </span>
                                                                        {typeof group.price === 'number' && Number.isFinite(group.price) ? (
                                                                            <Badge variant="secondary" className="text-[10px] tabular-nums">
                                                                                {formatUzs(group.price)} UZS
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <IconButton
                                                                        label={uiText.group}
                                                                        variant="outline"
                                                                        iconSize="md"
                                                                        onClick={() => {
                                                                            setEditingGroup({ groupIndex: groupIdx, group })
                                                                            setIsGroupModalOpen(true)
                                                                        }}
                                                                    >
                                                                        <Edit className="h-4 w-4" />
                                                                    </IconButton>

                                                                    <IconButton
                                                                        label={uiText.addMeal}
                                                                        iconSize="md"
                                                                        onClick={() => {
                                                                            setAddDishTarget({ calorieIndex: groupIdx })
                                                                            resetAddMealDraft()
                                                                            setIsAddDishModalOpen(true)
                                                                        }}
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                    </IconButton>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                                {dishesSorted.map((dish, idx) => {
                                                                    const mealIndex =
                                                                        typeof dish.mealIndex === 'number'
                                                                            ? dish.mealIndex
                                                                            : (getMealIndex(String(dish.mealType)) ?? 1)
                                                                    const dishKcal = getDishCalories(dish, availableDishes, kcalPerGramByName)

                                                                    return (
                                                                        <div key={`${dish.dishId}-${idx}`} className="bg-card p-3 rounded-xl border border-border flex gap-3 group relative">
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex justify-between items-start gap-2">
                                                                                    <div className="min-w-0">
                                                                                        <Badge variant="outline" className="text-[10px] mb-1">
                                                                                            {uiText.mealLabel(mealIndex)}
                                                                                        </Badge>
                                                                                        <h4 className="font-medium text-sm line-clamp-2">{dish.dishName}</h4>
                                                                                        <div className="mt-1 text-[10px] text-muted-foreground">
                                                                                            {Math.round(dishKcal)} kcal
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex gap-1 shrink-0">
                                                                                        <IconButton
                                                                                            label={uiText.editMeal}
                                                                                            variant="ghost"
                                                                                            iconSize="sm"
                                                                                            className="h-7 w-7"
                                                                                            onClick={() => {
                                                                                                setEditingDish({
                                                                                                    setId: selectedSet.id,
                                                                                                    calorieIndex: groupIdx,
                                                                                                    dishIndex: idx,
                                                                                                    dish: { ...dish }
                                                                                                });
                                                                                                setIsEditDishModalOpen(true);
                                                                                            }}
                                                                                        >
                                                                                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                                                                                        </IconButton>
                                                                                        <IconButton
                                                                                            label="Delete"
                                                                                            variant="ghost"
                                                                                            iconSize="sm"
                                                                                            className="h-7 w-7"
                                                                                            onClick={() => deleteDishFromGroup(groupIdx, idx)}
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                                                        </IconButton>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="mt-2 text-xs text-muted-foreground">
                                                                                    {dish.customIngredients ? (
                                                                                        <span className="text-amber-600 font-medium flex items-center gap-1">
                                                                                            <Scale className="w-3 h-3" /> {uiText.customWeight}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-muted-foreground/80 flex items-center gap-1">
                                                                                            <Scale className="w-3 h-3" /> {uiText.standard}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}

                                                                {(!group?.dishes || group.dishes.length === 0) && (
                                                                    <div className="col-span-full py-8 text-center text-muted-foreground border-2 border-dashed rounded-base">
                                                                        {uiText.noDishes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TabsContent>
                                                    );
                                                })}
                                        </Tabs>
                                    )}
                                </CardContent>
                            </Card>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-20 h-20 bg-secondary-background border-2 border-border rounded-base flex items-center justify-center mb-4">
                            <ArrowRight className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p>{uiText.selectSetHint}</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{uiText.newSet}</DialogTitle>
                        <DialogDescription>{uiText.subtitle}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>{uiText.setName}</Label>
                            <Input
                                value={newSetForm.name}
                                onChange={(e) => setNewSetForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={uiText.setName}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={createSet}>{uiText.create}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Group Modal */}
            <Dialog
                open={isGroupModalOpen}
                onOpenChange={(open) => {
                    setIsGroupModalOpen(open);
                    if (!open) setEditingGroup(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? uiText.group : uiText.newGroup}</DialogTitle>
                        <DialogDescription>{uiText.groups}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 py-4">
                        <div className="grid gap-2">
                            <Label>{uiText.groupName}</Label>
                            <Input
                                value={groupForm.name}
                                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder={uiText.groupName}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{uiText.groupPrice}</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={groupForm.price}
                                onChange={(e) => setGroupForm((prev) => ({ ...prev, price: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>
                            {uiText.cancel}
                        </Button>
                        <Button onClick={() => void upsertGroup()}>
                            {uiText.saveChanges}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Dish Modal */}
            <Dialog
                open={isAddDishModalOpen}
                onOpenChange={(open) => {
                    setIsAddDishModalOpen(open);
                    if (!open) {
                        setAddDishTarget(null);
                        resetAddMealDraft();
                    }
                }}
            >
                <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>{uiText.addMeal}</DialogTitle>
                        <DialogDescription>{uiText.dish} / {uiText.meal}</DialogDescription>
                    </DialogHeader>

                    <div className="px-6 py-4 flex-1 overflow-auto space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label className="min-w-0">{uiText.mealName}</Label>
                                <div className="flex items-center gap-2">
                                    {selectedDishToAdd ? (
                                        <Badge variant="secondary" className="text-[10px]">DB</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[10px]">NEW</Badge>
                                    )}
                                </div>
                            </div>
                            <Input
                                value={mealNameToAdd}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setMealNameToAdd(v);
                                    // If user starts typing a different name, treat it as a new dish draft.
                                    if (selectedDishToAdd) {
                                        const selected = availableDishes.find((dish) => String(dish.id) === selectedDishToAdd);
                                        if (selected && normalizeName(selected.name) !== normalizeName(v)) {
                                            setSelectedDishToAdd('');
                                        }
                                    }
                                }}
                                placeholder={uiText.mealNamePlaceholder}
                            />

                            {mealNameToAdd.trim().length > 0 ? (
                                <div className="bg-card rounded-md border border-border">
                                    <ScrollArea className="max-h-44">
                                        <div className="p-2 space-y-1">
                                            {availableDishes
                                                .filter((dish) => normalizeName(dish.name).includes(normalizeName(mealNameToAdd)))
                                                .slice(0, 12)
                                                .map((d) => {
                                                    const isSelected = String(d.id) === selectedDishToAdd;
                                                    return (
                                                        <Button
                                                            key={String(d.id)}
                                                            type="button"
                                                            onClick={() => selectDishForAdd(d)}
                                                            variant="ghost"
                                                            className={[
                                                                'w-full text-left rounded-md px-2 py-2 flex items-center justify-between gap-2',
                                                                'hover:bg-muted/60 transition-colors',
                                                                isSelected ? 'bg-muted' : '',
                                                            ].join(' ')}
                                                        >
                                                                                                                            <span className="truncate">{d.name}</span>

                                                            {isSelected ? (
                                                                <Badge variant="secondary" className="text-[10px] shrink-0">Selected</Badge>
                                                            ) : null}
                                                        </Button>
                                                    );
                                                })}
                                            {availableDishes.filter((dish) => normalizeName(dish.name).includes(normalizeName(mealNameToAdd))).length === 0 ? (
                                                <div className="px-2 py-2 text-sm text-muted-foreground">
                                                    {uiText.newDish}
                                                </div>
                                            ) : null}
                                        </div>
                                    </ScrollArea>
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-xl border border-border overflow-hidden">
                            <div className="bg-card px-4 py-3 border-b flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold">{uiText.ingredients}</div>
                                    <div className="text-xs text-muted-foreground truncate">{uiText.ingredientsDesc}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[10px]">
                                        {selectedSet?.name || uiText.setName}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {(() => {
                                            const idx = addDishTarget?.calorieIndex ?? -1;
                                            if (idx < 0) return uiText.group;
                                            const targetGroup = currentDayData[idx];
                                            return targetGroup ? `${uiText.group}: ${getGroupDisplayName(targetGroup, idx)}` : uiText.group;
                                        })()}
                                    </Badge>
                                </div>
                            </div>

                            <Table className="[&_tr]:!bg-transparent [&_tr]:text-foreground">
                                <TableHeader>
                                    <TableRow className="!bg-transparent">
                                        <TableHead className="pl-4">{uiText.tableName}</TableHead>
                                        <TableHead className="w-[110px]">{uiText.tableAmount}</TableHead>
                                        <TableHead className="w-[90px]">{uiText.tableUnit}</TableHead>
                                        <TableHead className="w-[120px] text-right">kcal/gr</TableHead>
                                        <TableHead className="w-[150px] text-right">UZS/unit</TableHead>
                                        <TableHead className="w-[48px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {draftMealIngredients.map((ing, idx) => (
                                        <TableRow key={`${ing.name}-${idx}`} className="!bg-transparent">
                                            <TableCell className="pl-4 min-w-0">
                                                <Input
                                                    className="h-8"
                                                    value={ing.name}
                                                    onChange={(e) => updateDraftIngredient(idx, { name: e.target.value })}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    className="h-8 w-24"
                                                    value={ing.amount}
                                                    onChange={(e) => {
                                                        const newVal = parseFloat(e.target.value);
                                                        updateDraftIngredientAmount(idx, Number.isFinite(newVal) ? newVal : 0);
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select value={String(ing.unit || 'gr')} onValueChange={(val) => updateDraftIngredient(idx, { unit: val })}>
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {UNIT_OPTIONS.map((unit) => (
                                                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-right"
                                                    value={typeof ing.kcalPerGram === 'number' && Number.isFinite(ing.kcalPerGram) ? ing.kcalPerGram : ''}
                                                    placeholder={(() => {
                                                        const meta = warehouseItemByName.get(String(ing.name || '').trim().toLowerCase());
                                                        return typeof meta?.kcalPerGram === 'number' ? String(meta.kcalPerGram) : 'auto';
                                                    })()}
                                                    onChange={(e) => {
                                                        const next = e.target.value.trim() === '' ? undefined : Number(e.target.value);
                                                        updateDraftIngredient(idx, { kcalPerGram: Number.isFinite(next as number) ? (next as number) : undefined });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-right"
                                                    value={typeof ing.pricePerUnit === 'number' && Number.isFinite(ing.pricePerUnit) ? ing.pricePerUnit : ''}
                                                    placeholder={(() => {
                                                        const meta = warehouseItemByName.get(String(ing.name || '').trim().toLowerCase());
                                                        return typeof meta?.pricePerUnit === 'number' ? String(meta.pricePerUnit) : 'auto';
                                                    })()}
                                                    onChange={(e) => {
                                                        const next = e.target.value.trim() === '' ? undefined : Number(e.target.value);
                                                        updateDraftIngredient(idx, { pricePerUnit: Number.isFinite(next as number) ? (next as number) : undefined });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeDraftIngredient(idx)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-main"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {draftMealIngredients.length === 0 ? (
                                        <TableRow className="!bg-transparent">
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                {uiText.noIngredients}
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </TableBody>
                            </Table>

                            <div className="bg-card p-4 border-t border-border space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-bold">{uiText.addIngredient}</Label>
                                    <Select onValueChange={(val) => addDraftIngredient(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={uiText.selectIngredient} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {getAllUniqueIngredients().map((ing) => (
                                                <SelectItem key={ing.name} value={ing.name}>
                                                    <div className="flex justify-between w-full min-w-[200px]">
                                                        <span className="truncate">{ing.name}</span>
                                                        <span className="text-muted-foreground text-xs">{ing.unit}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-12 gap-2">
                                    <Input className="col-span-4 h-8" placeholder="New ingredient" value={customDraftIngredient.name} onChange={(e) => setCustomDraftIngredient((prev) => ({ ...prev, name: e.target.value }))} />
                                    <Input className="col-span-2 h-8" type="number" placeholder="Amount" value={customDraftIngredient.amount} onChange={(e) => setCustomDraftIngredient((prev) => ({ ...prev, amount: e.target.value }))} />
                                    <Select value={customDraftIngredient.unit} onValueChange={(value) => setCustomDraftIngredient((prev) => ({ ...prev, unit: value }))}>
                                        <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>{UNIT_OPTIONS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input className="col-span-2 h-8" type="number" placeholder="kcal/gr" value={customDraftIngredient.kcalPerGram} onChange={(e) => setCustomDraftIngredient((prev) => ({ ...prev, kcalPerGram: e.target.value }))} />
                                    <Input className="col-span-1 h-8" type="number" placeholder="UZS" value={customDraftIngredient.pricePerUnit} onChange={(e) => setCustomDraftIngredient((prev) => ({ ...prev, pricePerUnit: e.target.value }))} />
                                    <Button type="button" variant="outline" className="col-span-1 h-8 w-8 p-0" onClick={addCustomDraftIngredient}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t">
                        <Button variant="outline" onClick={() => setIsAddDishModalOpen(false)}>{uiText.cancel}</Button>
                        <Button onClick={addDishToGroup} disabled={!mealNameToAdd.trim()}>{uiText.addMeal}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Ingredients Modal */}
            <Dialog open={isEditDishModalOpen} onOpenChange={setIsEditDishModalOpen}>
                <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle>{uiText.ingredients}: {editingDish?.dish.dishName}</DialogTitle>
                        <DialogDescription>
                            {uiText.ingredientsDesc}
                        </DialogDescription>
                    </DialogHeader>
                    {editingDish && (
                        <div className="flex-1 overflow-auto">
                            <Table className="[&_tr]:!bg-transparent [&_tr]:text-foreground">
                                <TableHeader className="bg-card sticky top-0">
                                    <TableRow className="!bg-transparent">
                                        <TableHead className="pl-6">{uiText.tableName}</TableHead>
                                        <TableHead>{uiText.tableAmount}</TableHead>
                                        <TableHead>{uiText.tableUnit}</TableHead>
                                        <TableHead>kcal/gr</TableHead>
                                        <TableHead>UZS/unit</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(editingDish.dish.customIngredients || getOriginalIngredients(editingDish.dish.dishId, availableDishes)).map((ing, idx) => (
                                        <TableRow key={`${ing.name}-${idx}`} className="!bg-transparent">
                                            <TableCell className="pl-6 font-medium">
                                                <Input className="h-8" value={ing.name} onChange={(e) => updateEditingIngredient(idx, { name: e.target.value })} />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" className="h-8 w-24"
                                                    value={ing.amount}
                                                    onChange={(e) => {
                                                        const newVal = parseFloat(e.target.value) || 0;
                                                        updateEditingIngredient(idx, { amount: newVal });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                <Select value={String(ing.unit || 'gr')} onValueChange={(val) => updateEditingIngredient(idx, { unit: val })}>
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {UNIT_OPTIONS.map((unit) => (
                                                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    className="h-8"
                                                    value={typeof ing.kcalPerGram === 'number' && Number.isFinite(ing.kcalPerGram) ? ing.kcalPerGram : ''}
                                                    placeholder="auto"
                                                    onChange={(e) => {
                                                        const next = e.target.value.trim() === '' ? undefined : Number(e.target.value);
                                                        updateEditingIngredient(idx, { kcalPerGram: Number.isFinite(next as number) ? (next as number) : undefined });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    className="h-8"
                                                    value={typeof ing.pricePerUnit === 'number' && Number.isFinite(ing.pricePerUnit) ? ing.pricePerUnit : ''}
                                                    placeholder="auto"
                                                    onChange={(e) => {
                                                        const next = e.target.value.trim() === '' ? undefined : Number(e.target.value);
                                                        updateEditingIngredient(idx, { pricePerUnit: Number.isFinite(next as number) ? (next as number) : undefined });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => removeIngredient(idx)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-main"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(editingDish.dish.customIngredients || getOriginalIngredients(editingDish.dish.dishId, availableDishes)).length === 0 && (
                                        <TableRow className="!bg-transparent">
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                {uiText.noIngredients}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="bg-card p-4 border-t border-border space-y-3">
                        <div className="grid grid-cols-12 gap-2">
                            <Input className="col-span-4 h-8" list="edit-ingredients-list" placeholder="New ingredient" value={customEditIngredient.name} onChange={(e) => setCustomEditIngredient((prev) => ({ ...prev, name: e.target.value }))} />
                            <datalist id="edit-ingredients-list">
                                {getAllUniqueIngredients().map((ing) => (
                                    <option key={ing.name} value={ing.name} />
                                ))}
                            </datalist>
                            <Input className="col-span-2 h-8" type="number" placeholder="Amount" value={customEditIngredient.amount} onChange={(e) => setCustomEditIngredient((prev) => ({ ...prev, amount: e.target.value }))} />
                            <Select value={customEditIngredient.unit} onValueChange={(value) => setCustomEditIngredient((prev) => ({ ...prev, unit: value }))}>
                                <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{UNIT_OPTIONS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input className="col-span-2 h-8" type="number" placeholder="kcal/gr" value={customEditIngredient.kcalPerGram} onChange={(e) => setCustomEditIngredient((prev) => ({ ...prev, kcalPerGram: e.target.value }))} />
                            <Input className="col-span-1 h-8" type="number" placeholder="UZS" value={customEditIngredient.pricePerUnit} onChange={(e) => setCustomEditIngredient((prev) => ({ ...prev, pricePerUnit: e.target.value }))} />
                            <Button type="button" variant="outline" className="col-span-1 h-8 w-8 p-0" onClick={addCustomIngredientToEditingDish}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsEditDishModalOpen(false)}>{uiText.cancel}</Button>
                            <Button onClick={updateEditingDish}>{uiText.saveChanges}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
