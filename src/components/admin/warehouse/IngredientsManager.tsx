'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { RefreshIconButton } from '@/components/admin/dashboard/shared/RefreshIconButton';
import { ResourceActionBar } from '@/components/admin/dashboard/shared/ResourceActionBar';

interface Ingredient {
    id: string;
    name: string;
    amount: number;
    unit: string;
    kcalPerGram?: number | null;
    pricePerUnit?: number | null;
    priceUnit?: string;
}

interface IngredientsManagerProps {
    onUpdate?: () => void;
}

export function IngredientsManager({ onUpdate }: IngredientsManagerProps) {
    const { language } = useLanguage();

    const uiText = useMemo(() => {
        if (language === 'ru') {
            return {
                searchPlaceholder: 'Поиск ингредиентов...',
                addIngredient: 'Добавить ингредиент',
                name: 'Название',
                amountInStock: 'Количество (на складе)',
                unit: 'Ед.',
                kcalPerGram: 'ккал / гр',
                kcalPerGramHint: 'Калории в 1 грамме',
                price: 'Цена',
                pricePerUnit: 'Цена за единицу (UZS)',
                priceUnit: 'Ед. цены',
                actions: 'Действия',
                noIngredientsFound: 'Ингредиенты не найдены',
                editIngredient: 'Редактировать ингредиент',
                addIngredientTitle: 'Добавить ингредиент',
                amountInitial: 'Количество (начальное)',
                priceExample: 'Например: 35000',
                priceUnitExample: 'kg, gr, ml, шт',
                cancel: 'Отмена',
                save: 'Сохранить',
                exampleName: 'например: Рис',
                unitExample: 'гр, мл, шт',
                failedLoadIngredients: 'Не удалось загрузить ингредиенты',
                nameRequired: 'Название обязательно',
                ingredientUpdated: 'Ингредиент обновлен',
                ingredientCreated: 'Ингредиент создан',
                failedSaveIngredient: 'Не удалось сохранить ингредиент',
                errorSaveIngredient: 'Ошибка сохранения ингредиента',
                confirmDeleteIngredient: 'Удалить этот ингредиент?',
                ingredientDeleted: 'Ингредиент удален',
                failedDeleteIngredient: 'Не удалось удалить ингредиент',
                errorDeleteIngredient: 'Ошибка удаления ингредиента',
            }
        }

        if (language === 'uz') {
            return {
                searchPlaceholder: 'Ingredientlarni qidirish...',
                addIngredient: "Ingredient qo'shish",
                name: 'Nomi',
                amountInStock: 'Miqdor (omborda)',
                unit: "O'lchov",
                kcalPerGram: 'kkal / g',
                kcalPerGramHint: '1 grammdagi kaloriya',
                price: 'Narx',
                pricePerUnit: 'Birlik narxi (UZS)',
                priceUnit: 'Narx birligi',
                actions: 'Amallar',
                noIngredientsFound: 'Ingredient topilmadi',
                editIngredient: 'Ingredientni tahrirlash',
                addIngredientTitle: "Ingredient qo'shish",
                amountInitial: "Miqdor (boshlang'ich)",
                priceExample: 'Masalan: 35000',
                priceUnitExample: 'kg, gr, ml, dona',
                cancel: 'Bekor qilish',
                save: 'Saqlash',
                exampleName: 'masalan: Guruch',
                unitExample: 'gr, ml, dona',
                failedLoadIngredients: 'Ingredientlar yuklanmadi',
                nameRequired: 'Nom kiritish shart',
                ingredientUpdated: 'Ingredient yangilandi',
                ingredientCreated: 'Ingredient yaratildi',
                failedSaveIngredient: "Ingredientni saqlab bo'lmadi",
                errorSaveIngredient: 'Ingredientni saqlashda xatolik',
                confirmDeleteIngredient: "Ushbu ingredient o'chirilsinmi?",
                ingredientDeleted: "Ingredient o'chirildi",
                failedDeleteIngredient: "Ingredientni o'chirib bo'lmadi",
                errorDeleteIngredient: "Ingredientni o'chirishda xatolik",
            }
        }

        return {
            searchPlaceholder: 'Search ingredients...',
            addIngredient: 'Add Ingredient',
            name: 'Name',
            amountInStock: 'Amount (In Stock)',
            unit: 'Unit',
            kcalPerGram: 'kcal / g',
            kcalPerGramHint: 'Calories per 1 gram',
            price: 'Price',
            pricePerUnit: 'Price per unit (UZS)',
            priceUnit: 'Price unit',
            actions: 'Actions',
            noIngredientsFound: 'No ingredients found',
            editIngredient: 'Edit Ingredient',
            addIngredientTitle: 'Add Ingredient',
            amountInitial: 'Amount (Initial)',
            priceExample: 'Example: 35000',
            priceUnitExample: 'kg, gr, ml, pcs',
            cancel: 'Cancel',
            save: 'Save',
            exampleName: 'e.g. Rice',
            unitExample: 'gr, ml, pcs',
            failedLoadIngredients: 'Failed to load ingredients',
            nameRequired: 'Name is required',
            ingredientUpdated: 'Ingredient updated',
            ingredientCreated: 'Ingredient created',
            failedSaveIngredient: 'Failed to save ingredient',
            errorSaveIngredient: 'Error saving ingredient',
            confirmDeleteIngredient: 'Are you sure you want to delete this ingredient?',
            ingredientDeleted: 'Ingredient deleted',
            failedDeleteIngredient: 'Failed to delete ingredient',
            errorDeleteIngredient: 'Error deleting ingredient',
        }
    }, [language]);

    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentIngredient, setCurrentIngredient] = useState<Partial<Ingredient>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchIngredients = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/warehouse/ingredients');
            if (res.ok) {
                const data = await res.json();
                setIngredients(data);
            }
        } catch (error) {
            console.error('Failed to fetch ingredients', error);
            toast.error(uiText.failedLoadIngredients);
        } finally {
            setLoading(false);
        }
    }, [uiText.failedLoadIngredients]);

    useEffect(() => {
        void fetchIngredients();
    }, [fetchIngredients]);

    const handleSave = async () => {
        if (!currentIngredient.name) {
            toast.error(uiText.nameRequired);
            return;
        }

        const pricePerUnit =
            typeof currentIngredient.pricePerUnit === 'number' && Number.isFinite(currentIngredient.pricePerUnit)
                ? currentIngredient.pricePerUnit
                : null;

        const kcalPerGram =
            typeof currentIngredient.kcalPerGram === 'number' && Number.isFinite(currentIngredient.kcalPerGram)
                ? currentIngredient.kcalPerGram
                : null;

        const payload: Partial<Ingredient> = {
            ...currentIngredient,
            kcalPerGram,
            pricePerUnit,
            priceUnit: (currentIngredient.priceUnit || 'kg').trim() || 'kg',
        };

        setIsSaving(true);
        try {
            const method = currentIngredient.id ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/warehouse/ingredients', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(currentIngredient.id ? uiText.ingredientUpdated : uiText.ingredientCreated);
                fetchIngredients();
                setIsDialogOpen(false);
                setCurrentIngredient({});
                if (onUpdate) onUpdate();
            } else {
                toast.error(uiText.failedSaveIngredient);
            }
        } catch (error) {
            console.error('Error saving ingredient', error);
            toast.error(uiText.errorSaveIngredient);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(uiText.confirmDeleteIngredient)) return;

        try {
            const res = await fetch(`/api/admin/warehouse/ingredients?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success(uiText.ingredientDeleted);
                fetchIngredients();
                if (onUpdate) onUpdate();
            } else {
                toast.error(uiText.failedDeleteIngredient);
            }
        } catch (error) {
            console.error('Error deleting ingredient', error);
            toast.error(uiText.errorDeleteIngredient);
        }
    };

    const filteredIngredients = ingredients.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-3">
                <ResourceActionBar
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder={uiText.searchPlaceholder}
                >
                    <Button
                        type="button"
                        size="icon"
                        className="size-9"
                        onClick={() => { setCurrentIngredient({ unit: 'gr', amount: 0 }); setIsDialogOpen(true); }}
                        aria-label={uiText.addIngredient}
                        title={uiText.addIngredient}
                    >
                        <Plus className="size-4" />
                    </Button>
                    <RefreshIconButton
                        label={language === 'ru' ? 'Обновить' : language === 'uz' ? 'Yangilash' : 'Refresh'}
                        onClick={() => void fetchIngredients()}
                        isLoading={loading}
                        iconSize="md"
                    />
                </ResourceActionBar>
            </div>

            <div className="relative max-h-[600px] overflow-y-auto rounded-lg border border-border bg-card">
                <Table className="[&_tr]:!bg-transparent [&_tr]:text-foreground">
                    <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
                        <TableRow className="!bg-transparent">
                            <TableHead>{uiText.name}</TableHead>
                            <TableHead>{uiText.amountInStock}</TableHead>
                            <TableHead>{uiText.unit}</TableHead>
                            <TableHead>{uiText.kcalPerGram}</TableHead>
                            <TableHead>{uiText.price}</TableHead>
                            <TableHead className="text-right">{uiText.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow className="!bg-transparent">
                                <TableCell colSpan={6} className="text-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredIngredients.length === 0 ? (
                            <TableRow className="!bg-transparent">
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    {uiText.noIngredientsFound}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredIngredients.map((ing) => (
                                 <TableRow key={ing.id} className="!bg-transparent">
                                     <TableCell className="font-medium">{ing.name}</TableCell>
                                     <TableCell>{ing.amount}</TableCell>
                                     <TableCell>{ing.unit}</TableCell>
                                     <TableCell className="text-xs text-muted-foreground">
                                         {typeof ing.kcalPerGram === 'number' && Number.isFinite(ing.kcalPerGram) ? ing.kcalPerGram : '-'}
                                     </TableCell>
                                     <TableCell className="text-sm text-muted-foreground">
                                         {typeof ing.pricePerUnit === 'number' && Number.isFinite(ing.pricePerUnit)
                                             ? `${ing.pricePerUnit.toLocaleString('ru-RU')} UZS/${ing.priceUnit || 'kg'}`
                                             : '-'}
                                     </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => { setCurrentIngredient(ing); setIsDialogOpen(true); }}>
                                                <Pencil className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(ing.id)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentIngredient.id ? uiText.editIngredient : uiText.addIngredientTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{uiText.name}</Label>
                            <Input
                                value={currentIngredient.name || ''}
                                onChange={(e) => setCurrentIngredient({ ...currentIngredient, name: e.target.value })}
                                placeholder={uiText.exampleName}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{uiText.amountInitial}</Label>
                                <Input
                                    type="number"
                                    value={currentIngredient.amount || 0}
                                    onChange={(e) => setCurrentIngredient({ ...currentIngredient, amount: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{uiText.unit}</Label>
                                <Input
                                    value={currentIngredient.unit || 'gr'}
                                    onChange={(e) => setCurrentIngredient({ ...currentIngredient, unit: e.target.value })}
                                    placeholder={uiText.unitExample}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                {uiText.kcalPerGram}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">{uiText.kcalPerGramHint}</span>
                            </Label>
                            <Input
                                inputMode="decimal"
                                value={typeof currentIngredient.kcalPerGram === 'number' ? String(currentIngredient.kcalPerGram) : ''}
                                onChange={(e) =>
                                    setCurrentIngredient({
                                        ...currentIngredient,
                                        kcalPerGram: e.target.value.trim() === '' ? null : Number(e.target.value),
                                    })
                                }
                                placeholder="0.0"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{uiText.pricePerUnit}</Label>
                                <Input
                                    inputMode="decimal"
                                    value={typeof currentIngredient.pricePerUnit === 'number' ? String(currentIngredient.pricePerUnit) : ''}
                                    onChange={(e) =>
                                        setCurrentIngredient({
                                            ...currentIngredient,
                                            pricePerUnit: e.target.value.trim() === '' ? null : Number(e.target.value),
                                        })
                                    }
                                    placeholder={uiText.priceExample}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{uiText.priceUnit}</Label>
                                <Input
                                    value={currentIngredient.priceUnit || 'kg'}
                                    onChange={(e) => setCurrentIngredient({ ...currentIngredient, priceUnit: e.target.value })}
                                    placeholder={uiText.priceUnitExample}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{uiText.cancel}</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {uiText.save}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
