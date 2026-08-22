# External reference notes

## Project context

The audited repository is `ozodbekasilbekov2-gif/ok`, a Next.js 15 / React 19 / TypeScript / Tailwind / Prisma delivery platform with admin, courier, customer-site, warehouse, routing, payments/transactions, AI, and realtime-related modules.

## Reference 1: Enatega

Source: https://github.com/enatega/food-delivery-multivendor

Enatega is a public multi-vendor delivery management system that explicitly covers food, groceries, home services, and courier delivery. Its README documents a high-level architecture and a separated product surface: customer app, rider/driver app, vendor/store app, ordering website, admin dashboard, API server, analytics, and error monitoring. The documented technologies include Expo, React Navigation, Apollo GraphQL, React, Node.js, MongoDB, and Firebase. Its feature list includes role-specific authentication, notifications, real-time agent tracking, chat, multilingual support, maps, ratings, payment integrations, order history, addresses, analytics, and Sentry-based error reporting.

Key comparison value: Enatega is the closest domain reference for role separation, delivery lifecycle, realtime tracking, observability, and multi-surface product architecture. It is not a drop-in stack reference because the audited project uses Next.js/Prisma rather than React Native/GraphQL/MongoDB.

## Reference 2: Medusa

Source: https://github.com/medusajs/medusa

Medusa describes itself as an open-source commerce platform and framework for custom commerce applications. Its README states that its framework and modules support B2B/DTC stores, marketplaces, distributor platforms, POS systems, service businesses, and similar solutions that need commerce primitives. It links its architecture and commerce-module documentation and maintains a large monorepo with packages, integration tests, changesets, documentation, and active release workflows.

Key comparison value: Medusa is the stronger architecture reference for extracting deep modules around orders, inventory, payments, and integrations without forcing a full rewrite. The useful principle is modular commerce primitives with narrow interfaces and replaceable adapters, not copying Medusa's stack wholesale.

## Early findings

The audited repository has 475 tracked files and 323 TypeScript/TSX source files. Several UI and orchestration modules are very large: `AdminDashboardPage.tsx` is approximately 213 KB, `SetsTab.tsx` 117 KB, `WarehouseTab.tsx` 81 KB, and `src/app/middle-admin/database/page.tsx` 72 KB. The repository has only two Playwright specs and no visible unit-test framework configuration. `next.config.ts` conditionally ignores TypeScript and ESLint build failures outside CI, which is a quality-gate risk. `package.json` also has a build script that runs catalog generation and a database push before `next build`, which couples deployment builds to database mutation.

The first architecture candidates are therefore likely to be: (1) deepening the admin/dashboard orchestration seam, (2) isolating order/dispatch workflow logic from large route handlers and UI modules, (3) strengthening Prisma indexes and lifecycle constraints after query review, and (4) adding reliable performance/error/quality instrumentation before making broad changes.

## Official metric sources

### Core Web Vitals

Source: https://developers.google.com/search/docs/appearance/core-web-vitals

Google defines Core Web Vitals as real-world measures of loading performance, interactivity, and visual stability. The recommended good-user-experience targets are LCP within 2.5 seconds, INP below 200 milliseconds, and CLS below 0.1. These are appropriate frontend SLO candidates for the public customer site and the most-used admin views, measured at the 75th percentile rather than as an average.

### Google SRE service levels

Source: https://sre.google/sre-book/service-level-objectives/

Google SRE defines an SLI as a carefully defined quantitative measure of a service level, and an SLO as a target value or range measured by an SLI. It distinguishes an SLA as an agreement with consequences when objectives are missed. The practical implication for this project is to define a small set of user-visible SLIs around order creation, order status updates, dispatch, login, and customer-site availability, then set explicit SLO targets and an error-budget response policy instead of collecting arbitrary metrics.

### OWASP ASVS

Source: https://owasp.org/www-project-application-security-verification-standard/

OWASP describes ASVS as a basis for testing web-application technical security controls and a requirements list for secure development. It is explicitly intended to be used as a metric and yardstick for confidence in web applications, including controls protecting against XSS and SQL injection. The current stable version named on the page is 5.0.0. For this project, the useful first pass is a scoped checklist for authentication, authorization/data isolation, input validation, output encoding, secrets, session/token handling, and auditability of order and admin mutations.

### OpenTelemetry

Source: https://opentelemetry.io/docs/what-is-opentelemetry/

OpenTelemetry is an open-source, vendor- and tool-agnostic observability framework for generating, exporting, and collecting telemetry such as traces, metrics, and logs. It is not itself a backend. Its semantic conventions and context propagation are useful for correlating a user request, Next.js route/API handler, Prisma query, external routing/payment/AI call, and resulting order event. This gives a path to improve reliability and memory/performance diagnosis without committing to a single observability vendor.

### WCAG 2.2

Source: https://www.w3.org/TR/WCAG22/

WCAG 2.2 is a W3C Recommendation whose success criteria are testable and technology-independent, with conformance levels A, AA, and AAA. The relevant baseline for this product is a scoped AA review: keyboard access and no traps, focus visibility, labels and input purpose, text alternatives, contrast, reflow, error identification, and authentication/re-authentication behavior across admin, courier, and customer-site flows.

### Next.js production checklist

Source: https://nextjs.org/docs/app/guides/production-checklist

The official Next.js production checklist is the framework-specific source to use for validating this application's deployment posture. It should be applied against the actual repository rather than copied wholesale: verify performance and caching strategy, image/font/script handling, metadata and error handling, security headers and environment variables, observability, and deployment/build behavior. The repository's current build-time database push and conditional ignoring of type/lint failures are high-priority checklist deviations to verify before changing product behavior.

## Codebase audit evidence

The repository contains 99 API route files. A static scan found explicit auth-helper/auth usage in 81 of 99 route files; the remaining 18 include authentication endpoints, cron/system endpoints, health, and public site auth/data paths, so this count is a screening signal rather than proof of vulnerability. Each exception needs classification and, where appropriate, an explicit public/cron guard.

The DB schema contains core `Admin`, `Customer`, `Order`, `OrderAuditEvent`, `ActionLog`, `Website`, warehouse, menu, transaction, and messaging models. The `Order` model has a rich lifecycle and telemetry surface, but only the audit event relation has an explicit composite index. Several high-volume filters likely deserve measured index review after query plans are collected, especially order status/date/courier/customer combinations, customer creator/deleted status, and admin hierarchy fields.

The auth helper accepts NextAuth sessions first and then a Bearer JWT fallback. It validates JWT algorithm HS256 and a Zod payload shape, but it trusts the `id`, `email`, and `role` claims without reloading the current admin record or checking `isActive`; the authorization model therefore needs a targeted review for revocation and role-change behavior. `src/middleware.ts` and `src/auth.config.ts` both define role-home/path policy separately, creating policy duplication risk.

`useDashboardData.ts` coordinates permission loading, low-admin loading, orders, clients, statistics, couriers, sets, and two bin refreshes in one hook. It issues five parallel API requests followed by two sequential requests, uses a single timeout promise that is not explicitly cleared, and returns a large mutable state surface. This is a strong candidate for deepening into a small dashboard data interface with query-specific adapters/hooks, but should be changed incrementally and measured.

`next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds` outside CI. The normal build invokes catalog generation, Prisma generate, and a Vercel-specific `prisma db push` script before `next build`; the production branch of that script may mutate the database during a deployment build. This is a high-risk change-safety issue and should be separated into an explicit migration/deploy step after verifying the project's deployment assumptions.

The repository has two Playwright specs and no visible unit-test configuration. Existing scripts include destructive or credential-affecting operations such as reset, cleanup, seed, database push, and password changes; they should not be run against any real connected database during audit. Static findings include extensive `any` usage and console logging in API routes, suggesting a gradual typing and structured-observability opportunity rather than a broad rewrite.

### DORA software delivery performance

Source: https://dora.dev/guides/dora-metrics/

The current DORA guide describes five metrics: change lead time, deployment frequency, failed deployment recovery time, change fail rate, and deployment rework rate. It separates throughput from instability and warns against turning metrics into simplistic goals, comparing unlike applications, or optimizing one metric in isolation. For this repository, the safe first step is to collect these from GitHub/Vercel/incident records at application level, use trends rather than universal targets, and keep them separate from product/user SLIs.

### TastyIgniter

Source: https://github.com/tastyigniter/TastyIgniter

TastyIgniter is a mature open-source restaurant platform whose repository presents online ordering, table reservation, and restaurant management as distinct but integrated surfaces. The repository structure separates application, database, routes, themes, extensions, and tests, and its recent history includes security hardening changes around storage paths. It is a domain and product-surface reference rather than a stack reference for this Next.js project. The relevant lesson is to keep restaurant/order workflows, back-office management, themes/site-builder, and extensions as explicit boundaries.

## 2026-08-21 authorization audit refresh

Primary OWASP references reviewed during the current audit cycle:

- Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html. The guidance emphasizes distinguishing authentication from authorization, enforcing authorization server-side, using deny-by-default, validating permissions on every request, centralizing policy logic where practical, and adding authorization regression tests.
- OWASP API1:2023 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/. The guidance states that every API endpoint receiving an object identifier and acting on that object should validate that the authenticated user has permission for the requested object; comparing only the current user ID to a URL parameter is insufficient for many ownership/group cases.

Repository implications identified: the chat conversation POST gap was a concrete object-level authorization failure and is now covered by `src/lib/chat/participants.ts` plus matrix tests. The next audit should continue scanning every route that receives IDs for resource-scope checks and should add role-matrix regression tests rather than relying only on authentication presence.


## Authorization audit refresh — 2026-08-21

OWASP API1:2023 states that BOLA occurs when an authenticated caller manipulates an object identifier and the endpoint fails to verify access to that specific record. Its prevention guidance requires authorization checks on every function that uses client-provided identifiers to access a record, plus authorization regression tests. Source: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

OWASP Authorization Cheat Sheet emphasizes that authentication is distinct from authorization, authorization should be deny-by-default and least-privilege, and server-side permission checks must be applied to protected actions rather than trusting client behavior. Source: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html


## Reference verification refresh — 2026-08-21

The official Enatega repository was re-opened and verified at https://github.com/enatega/food-delivery-multivendor. Its README describes a complete ordering and delivery ecosystem with separate customer, rider/driver, vendor/store, ordering website, admin dashboard, API server, analytics, and Sentry error-monitoring surfaces. It explicitly covers food, groceries, parcel logistics, home services, flowers, and pharmacy workflows, multiple vendors, and multiple service regions. The README also states that frontend applications are open source while the backend/API are proprietary/licensed, so Enatega is a domain/product-surface reference for AutoFood rather than a complete backend implementation to copy. The repository currently exposes separate app directories for admin, customer, rider, store, and web, plus CI, security, contribution, and documentation files.


## Medusa verification refresh — 2026-08-21

The official Medusa repository was re-opened and verified at https://github.com/medusajs/medusa. The repository presents Medusa as a flexible commerce platform for agents and developers and visibly organizes work into packages, integration-tests, scripts, changesets, docs, CI/security configuration, and a large active commit/PR workflow. Its recent first-party commit history explicitly includes versioned order/shipping adjustments, migration/backfill work, missing-index fixes, integration tests, module tests, Vite/build compatibility checks, and runtime-safe ESM assertions. The reference lesson for AutoFood is not to copy Medusa's stack, but to deepen domain modules behind small interfaces, keep database migrations/indexes and integration tests close to the change, and treat build/runtime compatibility as a first-class regression surface.


## TastyIgniter verification refresh — 2026-08-21

The official TastyIgniter repository was re-opened and verified at https://github.com/tastyigniter/TastyIgniter. Its README identifies an open-source restaurant system for online ordering, table reservations, and restaurant management. The repository visibly separates `app`, `database`, `routes`, `resources`, `themes`, `extensions`, `tests`, `storage`, and CI/security configuration; recent first-party commits include Docker/Nginx/PHP-FPM setup, storage privacy/hardening, extension/theme cleanup, and database/config structure work. The reference lesson for AutoFood is explicit separation of restaurant/order workflows, back-office management, themes/customer-facing sites, extensions/integrations, storage, and tests, while retaining the existing Next.js/Prisma/Vercel runtime rather than copying the Laravel/PHP deployment model.


## Reference 4: `ozodbekasilbekov2-gif/-1` resource-management UI audit — 2026-08-22

Source repository: https://github.com/ozodbekasilbekov2-gif/-1
Audited revision: `297fed5` (`v1.2.184-local.360`). The repository is an Android/Kotlin/Jetpack Compose application for scooter-rental resource management. Its README is generic AI Studio scaffolding, so the authoritative evidence for product behavior is the source code itself. The app is not a stack reference for AutoFood; it is a product-interaction and resource-management reference.

### Transferable product patterns

The reference has a single resource-management shell in `app/src/main/java/com/example/MainActivity.kt`. Top-level state lifts tab selection, date range, search mode, selection sets, create/edit/delete triggers, trash mode, archive mode, and navigation state above feature screens. The same source also centralizes intent-driven actions from widgets and notifications. This creates a consistent command surface across renters, scooters, contracts, transactions, finance, and reports, although the 7,629-line activity is itself too large to copy. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/MainActivity.kt

`UnifiedButton.kt` defines a small semantic button interface with six variants, one icon, one short label, loading state, enabled state, and a restrained press confirmation. The useful AutoFood lesson is semantic action consistency and a compact interaction grammar; the exact animated icon rotation or Android `Surface` implementation should not be copied into the web app. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ui/components/UnifiedButton.kt

`UnifiedTable.kt` provides shared search, column filtering, manual column visibility, sort-state cycling, date-range filtering, and a reusable filter side panel. Its strongest principle is that table behavior is shared while item-specific value extraction remains a caller-supplied adapter. The filter helper ANDs active filters and performs case-insensitive contains matching. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ui/components/UnifiedTable.kt

`ReportsScreen.kt` models reports as a list of typed widgets backed by one `ReportWidgetData` payload. Widget order and hidden state persist in preferences; global search, date range, and filter triggers are controlled by the parent shell; each widget has move-up/move-down controls. This is the clearest transferable pattern for AutoFood statistics: a compact dashboard contract plus configurable widgets, not a copy of the Android charts. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ReportsScreen.kt

`FinansiPanel.kt` applies the same resource pattern to virtual cards: live/trash source switching, persisted card order, search and column filters, lifted selection, external create/edit/delete triggers, and a header action zone that scrolls with the card grid. For AutoFood this suggests a shared resource-list contract usable by warehouse items, menu sets, couriers, and finance records where appropriate. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/FinansiPanel.kt

`ContractCalendar.kt` exposes a controlled calendar interface with explicit group state, active group, edit/view mode, status selection before date selection, add/remove/edit callbacks, and normalized day boundaries. Its value is the state machine and invariant enforcement: users cannot select a period before choosing a status, and date cells use stable start-of-day values. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ContractCalendar.kt

`BackupManager.kt` demonstrates explicit import order, backup statistics, temporary-file safety, and a user-visible success/error result. It is not suitable to copy as a data strategy for AutoFood because AutoFood already has PostgreSQL/Prisma and must not import unrelated historical business data. The transferable lesson is scoped, observable, rollback-conscious import/export workflows. Source: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/data/BackupManager.kt

The source also includes Room repositories/DAOs for renters, scooters, contract history, transactions, virtual cards, and notifications; WorkManager workers for payment checks/SMS; Android widgets for dashboard, quick actions, reports, renters, scooters, contracts, and transactions; and a CameraX/Mistral OCR scanner. These are useful capability references, but most are platform-specific and should be translated into web notifications, responsive quick actions, server jobs, or browser upload/OCR only when AutoFood’s current domain requires them.

### Current AutoFood insertion points

AutoFood already has the right domain substrate for the strongest reference patterns: `AdminDashboardPage.tsx` lifts active tab, period/date selection, multi-selection sets, search, modal triggers, warehouse state, and a `useDashboardData` seam; `StatisticsTab.tsx` renders grouped metrics; `WarehouseTab.tsx` owns inventory, cooking calculations, shopping list, cooking audit range, selected date, and plan loading; `SetsTab.tsx` owns set/day/group/dish/ingredient editing; and `FinanceTab.tsx`/`HistoryTable.tsx` provide adjacent resource surfaces. The current Prisma schema already models `WarehouseItem`, `Dish`, `Menu`, `MenuSet`, `DailyCookingPlan`, `Order`, `Customer`, `Admin`, and transactions, so the safe migration is primarily UI/state modularization and interaction consistency, not a schema rewrite.

### Explicit non-goals and risks

Do not copy the reference’s Android/Kotlin/Room/WorkManager stack into the Next.js/Vercel application. Do not copy its single 7,629-line `MainActivity`; instead extract small deep modules behind narrow interfaces. Do not introduce its local-only backup semantics into production PostgreSQL. Preserve AutoFood’s existing API response shapes, role scoping, Prisma schema, customer/courier/order workflows, and flat/no-glass UI preference. The reference’s warm cream/terracotta palette can be considered only as an optional product theme; the immediate visual direction should remain AutoFood’s existing flat token system rather than adding gradients, glass, shadows, or 3D effects.

### Proposed transfer sequence

1. Define a web-native resource-list interface for search, date/filter state, selection, CRUD action availability, loading/error/empty states, and soft-delete/restore behavior; adapt existing clients, orders, warehouse, sets, and finance screens incrementally.
2. Extract `AdminDashboardPage.tsx` orchestration into small dashboard state/data modules while preserving its current tab and API contracts.
3. Add a configurable statistics widget registry with persisted order/visibility per admin, using existing stats API data and explicit server-side scope checks.
4. Normalize reusable table/filter/selection primitives and apply them first to clients/orders/warehouse; make keyboard access, labels, focus, responsive reflow, and reduced motion acceptance criteria.
5. Improve warehouse/set workflow around a compact master-detail layout, date-scoped cooking planning, ingredient availability, shopping-list actions, and clear optimistic/rollback behavior without destructive refreshes.
6. Add browser/API regression tests for each migrated surface, plus measured Core Web Vitals, request latency, error rate, and memory/render-cost baselines before broader UI changes.

This note is a research record, not an implementation authorization. Each step requires a small spec, tests, browser verification, and a separate cohesive commit.
