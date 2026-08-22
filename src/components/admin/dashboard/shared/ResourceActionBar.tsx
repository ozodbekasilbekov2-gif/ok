'use client'

import type { ReactNode, Ref } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SearchPanel } from '@/components/ui/search-panel'
import { cn } from '@/lib/utils'

export function ResourceActionBar({
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  onSearchChange,
  inputRef,
  selectedCount = 0,
  onClearSelection,
  children,
  className,
}: {
  searchValue: string
  searchPlaceholder: string
  searchAriaLabel?: string
  onSearchChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  selectedCount?: number
  onClearSelection?: () => void
  children?: ReactNode
  className?: string
}) {
  const hasSelection = selectedCount > 0

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center',
        className,
      )}
    >
      <SearchPanel
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        ariaLabel={searchAriaLabel || searchPlaceholder}
        inputRef={inputRef}
        className="max-w-none flex-1"
      />
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {hasSelection && (
          <div className="flex h-9 items-center gap-1 rounded-base border border-border bg-secondary-background px-2 text-xs text-muted-foreground" aria-live="polite">
            <span>{selectedCount}</span>
            <span>selected</span>
            {onClearSelection && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-1 size-7"
                aria-label="Clear selection"
                title="Clear selection"
                onClick={onClearSelection}
              >
                <X />
              </Button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
