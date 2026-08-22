'use client'

import Link from 'next/link'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { LogIn, UserRound, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SiteConfig } from '@/hooks/useSiteConfig'
import { makeClientSiteHref } from '@/lib/site-urls'
import { cn } from '@/lib/utils'

function toCssVars(site: SiteConfig) {
  return {
    '--site-bg': site.palette.pageBackground,
    '--site-panel': site.palette.panelBackground,
    '--site-text': site.palette.textPrimary,
    '--site-muted': site.palette.textMuted,
    '--site-border': site.palette.border,
    '--site-accent': site.palette.accent,
    '--site-accent-soft': site.palette.accentSoft,
    '--site-hero-from': site.palette.heroFrom,
    '--site-hero-to': site.palette.heroTo,
    '--site-hero-text': site.palette.heroText,
  } as CSSProperties
}

export function SitePageSurface({ site, children }: { site: SiteConfig; children: ReactNode }) {
  return (
    <div
      className={cn('min-h-screen overflow-x-hidden', site.bodyClass)}
      style={{
        ...toCssVars(site),
        backgroundColor: 'var(--site-bg)',
        color: 'var(--site-text)',
      }}
    >
      {children}
    </div>
  )
}

function useCustomerAuthenticated() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    let isMounted = true

    const checkAuth = async () => {
      const token = localStorage.getItem('customerToken')
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false)
        }
        return
      }

      try {
        const response = await fetch('/api/customers/profile', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (isMounted) {
          setIsAuthenticated(response.ok)
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false)
        }
      }
    }

    void checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  return isAuthenticated
}

export function SitePublicHeader({ site, rightSlot }: { site: SiteConfig; rightSlot?: ReactNode }) {
  const isAuthenticated = useCustomerAuthenticated()
  const showAuthButtons = isAuthenticated !== true

  return (
    <header className="sticky top-0 z-30 border-b px-3 py-3 sm:px-4" style={{ color: 'var(--site-text)', borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link href={makeClientSiteHref(site.subdomain, '')} className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-base border-2 text-sm font-semibold"
            style={{
              borderColor: 'var(--site-border)',
              background: 'var(--site-accent-soft)',
            }}
          >
            {site.siteName.slice(0, 2)}
          </span>
          <div>
            <span className={cn('block text-base font-semibold tracking-tight', site.headingClass)}>{site.siteName}</span>
            <span className="block text-[11px] tracking-[0.14em]" style={{ color: 'var(--site-muted)' }}>
              client portal
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {rightSlot}
          {showAuthButtons ? (
            <>
              <Link href={makeClientSiteHref(site.subdomain, '/login')}>
                <Button variant="outline" size="sm" className="gap-1 border-2">
                  <LogIn className="h-4 w-4" /> Login
                </Button>
              </Link>
              <Link href={makeClientSiteHref(site.subdomain, '/register')}>
                <Button variant="outline" size="sm" className="gap-1 border-2">
                  <UserPlus className="h-4 w-4" /> Register
                </Button>
              </Link>
              <Link href={makeClientSiteHref(site.subdomain, '/client')}>
                <Button size="sm" className="gap-1">
                  <UserRound className="h-4 w-4" /> Client
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export function SiteHero({
  title,
  subtitle,
  eyebrow,
  actions,
  asideTitle,
  asideDetail,
}: {
  title: string
  subtitle: string
  eyebrow?: string
  actions?: ReactNode
  asideTitle?: string
  asideDetail?: string
}) {
  return (
    <section className="px-4 pt-5">
      <div
        className="mx-auto grid max-w-6xl gap-6 border-b px-5 py-8 lg:grid-cols-[minmax(0,1.3fr)_320px] lg:px-8 lg:py-10"
        style={{
          borderColor: 'var(--site-border)',
        }}
      >
        <div className="relative">
          {eyebrow ? (
            <p
              className="inline-flex rounded-base border-2 px-3 py-1 text-[11px] font-semibold tracking-[0.14em]"
              style={{
                borderColor: 'var(--site-border)',
                backgroundColor: 'var(--site-accent-soft)',
                color: 'var(--site-text)',
              }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 md:text-base" style={{ color: 'var(--site-muted)' }}>
            {subtitle}
          </p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        <div
          className="border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6"
          style={{
            borderColor: 'var(--site-border)',
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent)' }}>
            Live snapshot
          </p>
          <h2 className="mt-3 text-xl font-semibold">{asideTitle ?? 'Fast, direct client flow'}</h2>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--site-muted)' }}>
            {asideDetail ?? 'Landing, login, balance, daily menu, and order history stay inside one clear journey.'}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: 'Access', value: '24/7' },
              { label: 'Menu view', value: 'Daily' },
              { label: 'Support load', value: 'Lower' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-base border-2 px-4 py-3"
                style={{
                  borderColor: 'var(--site-border)',
                  backgroundColor: 'var(--site-accent-soft)',
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--site-muted)' }}>
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function SitePanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-base border-2 p-4 md:p-5 ${className}`}
      style={{
        borderColor: 'var(--site-border)',
        backgroundColor: 'var(--site-panel)',
      }}
    >
      {children}
    </div>
  )
}

export function SiteClientNav({ subdomain, currentPath }: { subdomain: string; currentPath?: string }) {
  const items = [
    { href: makeClientSiteHref(subdomain, '/client'), label: 'Client' },
    { href: makeClientSiteHref(subdomain, '/history'), label: 'History' },
  ]

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <Button
            variant={currentPath === item.href ? 'default' : 'outline'}
            size="sm"
          >
            {item.label}
          </Button>
        </Link>
      ))}
    </nav>
  )
}
