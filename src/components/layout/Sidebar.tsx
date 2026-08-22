'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  ChefHat,
  DollarSign,
  History,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function Sidebar({ className, activeTab, onTabChange, isOpen, onClose, onLogout }: SidebarProps) {
  const { t, language } = useLanguage();

  const menuItems = [
    { id: 'statistics', label: t.admin.statistics, icon: BarChart3, badge: null },
    { id: 'orders', label: t.admin.orders, icon: ShoppingCart, badge: 0 },
    { id: 'clients', label: t.admin.clients, icon: Users, badge: null },
    { id: 'admins', label: t.admin.admins, icon: Users, badge: null },
    { id: 'couriers', label: t.admin.couriers, icon: Truck, badge: null },
    { id: 'divider-1', type: 'divider' as const },
    { id: 'warehouse', label: t.warehouse.title, icon: Package, badge: null },
    { id: 'cooking', label: t.warehouse.cooking, icon: ChefHat, badge: null },
    { id: 'divider-2', type: 'divider' as const },
    { id: 'finance', label: t.finance.title, icon: DollarSign, badge: null },
    { id: 'history', label: t.admin.history, icon: History, badge: null },
    { id: 'divider-3', type: 'divider' as const },
    { id: 'chat', label: t.courier.chat, icon: MessageSquare, badge: null },
    { id: 'bin', label: t.admin.bin, icon: Trash2, badge: null },
    { id: 'divider-4', type: 'divider' as const },
    { id: 'profile', label: t.common.profile, icon: User, badge: null },
    { id: 'settings', label: t.admin.settings, icon: Settings, badge: null },
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 -translate-x-full transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'border-r border-border bg-background',
          'lg:static lg:translate-x-0 lg:w-[260px]',
          isOpen && 'translate-x-0',
          className
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-6 lg:pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ChefHat className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground">AutoFood</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === 'ru' ? 'Панель' : language === 'uz' ? 'Panel' : 'Dashboard'}
                </p>
              </div>
            </div>

            <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mx-5 h-px bg-border" />

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-0.5 px-3 lg:px-2">
              {menuItems.map((item) => {
                if ('type' in item && item.type === 'divider') {
                  return <div key={item.id} className="mx-3 my-3 h-px bg-border" />;
                }

                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <Button
                    type="button"
                    variant="ghost"
                    key={item.id}
                    className={cn(
                      'relative flex h-10 w-full items-center gap-3.5 rounded-xl px-3.5 text-[13.5px] font-semibold',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => {
                      onTabChange(item.id);
                      onClose();
                    }}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-accent-foreground' : 'text-muted-foreground')} />
                    <span className="flex-1 text-left tracking-wide truncate">{item.label}</span>
                    {item.badge !== null && item.badge > 0 && (
                      <Badge className="h-5 min-w-5 border-transparent bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground shadow-none">{item.badge}</Badge>
                    )}
                  </Button>
                );
              })}
            </nav>
          </ScrollArea>

          {/* Footer - Logout */}
          <div className="mx-5 h-px bg-border" />
          <div className="p-3">
            <Button
              type="button"
              variant="ghost"
              className="flex h-10 w-full items-center gap-3.5 rounded-xl px-3.5 text-[13.5px] font-semibold text-destructive hover:bg-destructive/10"
              onClick={onLogout}
            >
              <LogOut className="h-[18px] w-[18px]" />
              {t.common.logout}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
