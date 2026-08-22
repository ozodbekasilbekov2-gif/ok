'use client'

import type { ReactNode, Ref } from 'react'
import { ResourceActionBar } from '@/components/admin/dashboard/shared/ResourceActionBar'

export function FilterToolbar({
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  onSearchChange,
  inputRef,
  children,
}: {
  searchValue: string
  searchPlaceholder: string
  searchAriaLabel?: string
  onSearchChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  children?: ReactNode
}) {
  return (
    <ResourceActionBar
      searchValue={searchValue}
      searchPlaceholder={searchPlaceholder}
      searchAriaLabel={searchAriaLabel}
      onSearchChange={onSearchChange}
      inputRef={inputRef}
    >
      {children}
    </ResourceActionBar>
  )
}
