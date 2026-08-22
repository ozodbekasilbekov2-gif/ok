'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { SitePageSurface, SitePublicHeader } from '@/components/site/SiteScaffold'
import { makeClientSiteHref } from '@/lib/site-urls'
import type { SiteConfig } from '@/hooks/useSiteConfig'

type SiteAuthFeature = {
  icon: LucideIcon
  title: string
  description: string
}

interface SiteAuthShellProps {
  site: SiteConfig
  subdomain: string
  badge: string
  title: string
  description: string
  features: SiteAuthFeature[]
  formTitle: string
  formDescription: string
  children: React.ReactNode
}

export function SiteAuthShell({
  site,
  subdomain,
  badge,
  title,
  description,
  features,
  formTitle,
  formDescription,
  children,
}: SiteAuthShellProps) {
  return (
    <SitePageSurface site={site}>
      <SitePublicHeader site={site} />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-4 text-sm text-muted-foreground">
          <Link href={makeClientSiteHref(subdomain, '')} className="underline">
            Back to landing
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="space-y-6 border-b pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6" style={{ borderColor: 'var(--site-border)' }}>
            <div
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--site-border)', color: 'var(--site-accent)' }}
            >
              {badge}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: 'var(--site-muted)' }}>
                {description}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-md border p-4"
                  style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)' }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: 'var(--site-accent)' }} />
                  <p className="mt-3 font-medium">{feature.title}</p>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--site-muted)' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-lg space-y-4 lg:pl-2">
            <div>
              <h2 className="text-2xl font-semibold">{formTitle}</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>
                {formDescription}
              </p>
            </div>
            {children}
          </section>
        </div>
      </main>
    </SitePageSurface>
  )
}
