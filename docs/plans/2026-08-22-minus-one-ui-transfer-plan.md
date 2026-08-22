# AutoFood uchun `-1` reference-driven UI va resurs boshqaruvi rejasi

**Sana:** 2026-08-22
**Muallif:** Manus AI
**Reference revision:** `ozodbekasilbekov2-gif/-1`, commit `297fed5` (`v1.2.184-local.360`)
**Maqsad:** `-1` ilovasining resurslarni boshqarishdagi kuchli UX va funksional patternlarini AutoFood’ning oziq-ovqat yetkazib berish domeniga moslashtirish, lekin AutoFood’ning Prisma/PostgreSQL modeli, API response shape’lari, rollari, order lifecycle’i va Vercel deployment’ini saqlab qolish.

## 1. Asosiy xulosa

`-1` va AutoFood mavzu jihatidan farq qiladi, ammo mahsulot modeli bir xil: foydalanuvchi ko‘plab resurslarni ko‘radi, izlaydi, filterlaydi, tanlaydi, guruhlaydi, tahrirlaydi, arxivlaydi va ularning vaqtga bog‘liq holatini kuzatadi. `-1` dagi eng ko‘chiriladigan qiymat ranglar yoki Android komponentlari emas, balki **bir xil command surface**, **resurslar bilan ishlashning yagona interaction grammatikasi**, **davr bo‘yicha ko‘rish**, **bulk selection**, **soft-delete/trash**, **qayta tartiblash**, **configurable dashboard** va **aniq state invariantlari**dir.

Shu sababli AutoFood’ni `-1` ga o‘xshatish degani Android/Kotlin/Room’ni ko‘chirish yoki barcha ekranlarni qayta yozish emas. To‘g‘ri yo‘l — hozir mavjud bo‘lgan AutoFood seamlaridan foydalanib, avval umumiy web-native UI contractlarini ajratish, keyin ularni clients, orders, warehouse, sets, finance va statistics tablariga bosqichma-bosqich ulashdir.

> **Qaror:** `-1` product-interaction reference sifatida qabul qilinadi; stack, monolit activity, local-only database va platform-specific funksiyalar ko‘chirilmaydi.

## 2. Ikki repository bo‘yicha dalillar

`-1` source code’ida top-level shell active tab, search mode, date range, multi-selection, create/edit/delete trigger, trash/archive mode va nested navigation state’larini yuqoriga ko‘taradi. Bu yondashuv bir xil amallarni renters, scooters, contracts, transactions, finance va reports bo‘yicha bir xil ishlatishga imkon beradi. Ammo buni aynan `MainActivity` shaklida ko‘chirish mumkin emas: reference’ning asosiy activity fayli 7,629 qatorli monolitdir. [1]

`UnifiedButton.kt` oltita semantic variant, icon, qisqa label, loading va disabled holatlariga ega kichik interface beradi. Uning AutoFood uchun foydali qismi — primary, secondary, success, danger va text action’lar uchun yagona vizual va xulqiy grammar. Android `Surface`, icon rotation va aynan shu animatsiyalar ko‘chirilmaydi; AutoFood’ning allaqachon flat qilingan button tokenlari saqlanadi. [2]

`UnifiedTable.kt` search, column filter, qo‘lda column visibility, sort state, date-range filter va filter side panelni bitta qayta ishlatiladigan modulga birlashtiradi. Filter helper’ning muhim xususiyati — item-specific value extractor orqali generic bo‘lishi va faol filterlarni AND sharti bilan qo‘llashi. Bu AutoFood’ning clients, orders, warehouse items va dishes ro‘yxatlari uchun mos keladi. [3]

`ReportsScreen.kt` typed widget registry, bitta `ReportWidgetData` payload, widget visibility/order persistence, global search, date range va up/down reorder action’laridan foydalanadi. Bu AutoFood statistics tabini fixed metric grid’dan configurable operations dashboard’ga olib chiqish uchun eng kuchli reference hisoblanadi. [4]

`FinansiPanel.kt` resurslar uchun live/trash source switch, persisted order, search/filter, lifted selection, external create/edit/delete trigger va scroll ichidagi action zone patternlarini qo‘llaydi. Bu yondashuv AutoFood finance, warehouse yoki sets kabi resurs-oriented tablarda faqat kerak bo‘lgan joylarda ishlatiladi. [5]

`ContractCalendar.kt` controlled interface, explicit callbacks, active group, edit/view mode, status tanlanmaguncha sana tanlashni bloklash va day boundary normalization kabi invariantlarni saqlaydi. AutoFood’da bu pattern contract modelini ko‘chirish uchun emas, cooking plan va menu/set assignment kabi date-scoped workflowlar uchun moslashtiriladi. [6]

`BackupManager.kt` import order, counts, temporary file safety va user-visible error/success resultlarini ko‘rsatadi. AutoFood’ning PostgreSQL/Prisma database’siga reference local backup kodini ko‘chirmaymiz. Faqat scoped import/export, rollback va observability tamoyillari olinadi. [7]

AutoFood’da bu patternlar uchun tayyor insertion point’lar allaqachon bor. `AdminDashboardPage.tsx` active tab, period/date, selected orders/clients, search, modal triggers, warehouse state va `useDashboardData` seamini boshqaradi. `StatisticsTab.tsx` metric groups, `WarehouseTab.tsx` inventory/cooking/shopping-list state’lari, `SetsTab.tsx` set/day/group/dish/ingredient editing, `FinanceTab.tsx` va `HistoryTable.tsx` esa resurs-oriented UI surfaces sifatida ishlaydi.

## 3. Reference-to-AutoFood transfer matrix

| `-1` dagi pattern | AutoFood’dagi manzil | Ko‘chirish shakli | Prioritet | Chegara |
|---|---|---|---|---|
| Unified top-level command surface | `AdminDashboardPage.tsx`, `AdminLayout.tsx`, shared dashboard actions | `ResourceActionBar` va typed action state; mavjud tab/API contract’lar saqlanadi | P0 | Yangi monolit controller yozilmaydi |
| Unified button variants | `src/components/ui/button.tsx` va admin shared actions | Semantic `variant`/`size`/loading/disabled contractlarini bir xillashtirish | P0 | Glass, shadow, 3D offset va keraksiz motion qo‘shilmaydi |
| Search + column filter + visibility | `FilterToolbar`, `SearchPanel`, clients/orders/warehouse/sets tables | Generic filter state va value extractor; URL/local state bilan test qilinadigan model | P0 | Har bir sahifa alohida filter engine yozmaydi |
| Multi-select + bulk operations | orders, clients, warehouse items, dishes/sets | `SelectionModel<TId>` yoki kichik equivalent; count va action availability bir joyda | P0 | Authorization faqat serverda qayta tekshiriladi |
| Trash mode | orders/clients va mavjud bin flow’lari | Soft-delete/restore state’larini umumiy UI contract orqali ko‘rsatish | P1 | Hard delete faqat hozirgi mavjud explicit flow’lar bilan |
| Archive mode | paused clients, historical orders, cooking history | `active / archived / trash` source selector; domain meaning alohida qoladi | P1 | Archive va trash semantikasi aralashtirilmaydi |
| Configurable report widgets | `StatisticsTab.tsx` | typed widget registry, shared statistics payload, per-user order/visibility | P1 | Avval client persistence; server persistence faqat alohida spec va migration bilan |
| Date-range calendar | statistics, orders, cooking audit, shopping calculation | Bitta date-range adapter va tab-specific query params | P1 | Local timezone/day boundary regression test majburiy |
| Controlled calendar state machine | cooking/menu/set scheduling | status/date prerequisites va explicit callbacks | P1 | Reference contract fields AutoFood schema’siga ko‘chirilmaydi |
| Resource card order | finance cards yoki warehouse summary resources | persisted order faqat user value beradigan ekranlarda | P2 | Jadvalni keraksiz card grid’ga aylantirmaymiz |
| Notification/widget quick actions | browser notifications, compact quick actions, PWA imkoniyatlari | faqat mavjud workflow foydasi isbotlangandan keyin | P2 | Android widget provider yoki WorkManager ko‘chirilmaydi |
| Camera/OCR scanner | order/customer document yoki ingredient intake | alohida product case bo‘lsa browser upload/server adapter | P3 | API, privacy va cost spec’siz qo‘shilmaydi |
| Backup/restore | PostgreSQL admin export/import | scoped, transactional, dry-run va audit log bilan | P2 | Eski accounts/orders/finance avtomatik qaytarilmaydi |

## 4. Tavsiya qilinadigan web arxitekturasi

### 4.1. Tashqi interface’lar

Har bir resurs ekrani quyidagi kichik, aniq interface’lardan foydalanishi kerak: `ResourceQueryState` search/filter/date state’ni, `SelectionModel` tanlangan ID’larni, `ResourceActionState` create/edit/delete/restore availability’ni, `ResourceViewState` loading/empty/error/success holatlarini, `ResourceAdapter` esa entity’ni search/filter/sort uchun text va columns’ga aylantirishni ifodalaydi.

Bu nomlar qat’iy TypeScript interface bo‘lishi shart emas; muhim talab — har bir modulning caller bilishi kerak bo‘lgan surface’i kichik bo‘lishi. `AdminDashboardPage.tsx` barcha implementation tafsilotlarini bilmasligi kerak. U faqat tab, action va data adapterlarni ulashi kerak.

### 4.2. State ownership

Top-level shell faqat cross-tab state’ni ushlaydi: active tab, date context, global command mode va authentication/permission context. Entity-specific form state dialog yoki feature module ichida qoladi. Search/filter state bir xil visual action bar’dan boshqarilsa ham, query semantics har bir resurs adapterida qoladi.

Har bir mutation serverda role/scope bo‘yicha qayta tekshiriladi. UI’dagi disabled tugma authorization o‘rnini bosa olmaydi. Existing `adminScope` va route auth helper’lari saqlanadi; yangi generic UI modul faqat serverga yuboriladigan intentni ifodalaydi.

### 4.3. Data interface va API compatibility

Mavjud REST route’lar va response shape’lari birinchi bosqichlarda o‘zgartirilmaydi. `useDashboardData` ichidagi request orchestration asta-sekin query-specific adapters’ga ajratiladi, lekin tashqi component’lar oladigan `orders`, `clients`, `couriers`, `availableSets`, `stats`, `binClients` va `binOrders` contract’lari vaqtincha saqlanadi.

Prisma schema’ga faqat real ehtiyoj bo‘lsa migration qo‘shiladi. Dashboard widget order/visibility uchun avval browser local persistence ishlatiladi; keyinchalik multi-device va role-based customization talab qilinsa, `InterfaceConfig` yoki alohida kichik model uchun additive migration alohida qaror sifatida ko‘riladi. Build vaqtida production database’ga `db push` qilish qayta joriy qilinmaydi.

## 5. Bosqichma-bosqich amalga oshirish rejasi

### P0 — UI command grammar va baseline contract

Avval shared action buttons, refresh, date selector, search, filter trigger, selection count, loading va empty/error holatlari uchun bitta flat visual grammar belgilanadi. Mavjud `FilterToolbar`, `SearchPanel`, `RefreshIconButton`, `EntityStatusBadge`, `TabEmptyState` va `CalendarDateSelector` qayta ishlatiladi yoki kichik deep modules’ga ajratiladi; dublikatlar kamaytiriladi.

**Natija:** clients, orders, warehouse va sets ekranlarida primary/secondary/danger actionlar bir xil joylashadi; buttonlar barcha mutationlarda `disabled`, `loading`, `aria-label` va keyboard focus holatlarini beradi.

### P1 — Resource list foundation

`ClientDirectoryTable`, `OrdersTable`, `IngredientsManager` va dishes/sets list’larida generic filter adapter, multi-select va action availability bir xil contract orqali ishlaydi. Reference’dagi filter panelning kuchli tomoni — column bo‘yicha contains filter va column visibility — AutoFood’da faqat ma’lumot zichligi yuqori bo‘lgan jadvallarga qo‘llanadi.

Mavjud mobile responsive layout buzilmasligi kerak. Desktop’da jadval, mobile’da compact list/card fallback ishlatiladi. `AdminDashboardPage.tsx` ichidagi entity-specific filtering ko‘chirilsa ham, public API response o‘zgarmaydi.

### P2 — Soft-delete, archive va safe restore

Bin flow’lari orders va clients bilan cheklanib qolmasdan, domain jihatdan xavfsiz bo‘lgan warehouse/dish/set resurslari uchun ham ko‘rib chiqiladi. `trash` — foydalanuvchi o‘chirish niyatini, `archive` esa faol operatsiyadan chiqarilgan, lekin tarix uchun saqlangan ma’lumotni anglatadi. Ularning ranglari, empty state’lari va restore confirmation’lari ajratiladi.

Bu bosqichda hard delete, cascade va ownership bo‘yicha alohida test matritsasi yoziladi. Eski account, customer, order, finance yoki boshqa biznes ma’lumotlarini restore qilish bu rejaning maqsadi emas.

### P3 — Configurable operations statistics

`StatisticsTab.tsx` fixed metric groups’dan typed widget registry’ga o‘tkaziladi. Birinchi widgetlar mavjud data bilan cheklanadi: order status, payment split, calorie distribution, daily/even/odd delivery, warehouse availability, cooking planned/cooked/remaining va set usage. Har bir widget bitta normalized payload oladi; widget order/visibility esa local persistence’da saqlanadi.

Search va date range global toolbar’dan keladi, lekin widgetlar faqat o‘z title/metadata’si bo‘yicha filterlanadi. Reorder tugmalari accessibility bilan ishlaydi. Har bir metric uchun period semantics yozib qo‘yiladi, shunda “today”, “selected day” va “selected range” aralashib ketmaydi.

### P4 — Warehouse va Sets master-detail workflow

`WarehouseTab.tsx` va `SetsTab.tsx` allaqachon kuchli domain logicga ega, shuning uchun ularni qayta yozish o‘rniga master-detail interaction soddalashtiriladi. Chap yoki yuqori master qism ingredient/set/dish ro‘yxatini, detail qism esa tanlangan entity’ni ko‘rsatadi. Search, selection, create, edit, copy, delete va refresh command’lari bitta action area’ga yig‘iladi.

Reference calendar invariantlari cooking flow’ga quyidagicha tarjima qilinadi: avval menu/set yoki cooking mode tanlanadi, keyin sana/davr, undan keyin quantity yoki dish allocation. Date grid local timezone’da normalized ISO day bilan ishlaydi. Hisoblashlar 31 yoki 45 kunlik mavjud UI limitlarini saqlaydi; katta range uchun server-side aggregation talab qilinadi.

### P5 — Finance va boshqa resurslar uchun selective card pattern

Reference virtual card patterni AutoFood finance uchun faqat card/resource semantics haqiqatan foydali bo‘lsa olinadi. Orderlar va warehouse ingredients majburan visual cards’ga o‘tkazilmaydi. Finance card order, selected resources va transaction action zone mavjud `FinanceTab.tsx` modeliga moslashtiriladi va default object’larni o‘chirishga yo‘l qo‘yilmaydi.

### P6 — Quick actions, notifications va optional integrations

Android widgets’ning web ekvivalenti faqat real usage isbotlangandan keyin tanlanadi: compact admin quick actions, browser notification yoki PWA installable shell. OCR scanner va AI funksiyalari esa alohida privacy, rate-limit, storage va failure policy bilan tasdiqlanadi. Bu imkoniyatlar UI reference’ni ko‘r-ko‘rona ko‘chirish uchun emas, aniq AutoFood workflow muammosini yechish uchun qo‘shiladi.

## 6. Acceptance criteria va o‘lchovlar

Har bir bosqich bir xil quality gate’dan o‘tadi. UI’da keyboard-only navigation, visible focus, accessible name, mobile reflow, loading/empty/error states va `prefers-reduced-motion` tekshiriladi. Functional flow’lar browser orqali login, tab navigation, search/filter, selection, create/edit/delete/restore, date selection va mutation error holatlari bilan tekshiriladi.

| Yo‘nalish | Minimal acceptance mezoni |
|---|---|
| Functional correctness | Mavjud Playwright suite regressiyasiz; yangi flow uchun success va failure testlari |
| API compatibility | Mavjud route URL, auth semantics va response shape’lar saqlanadi yoki versioned adapter orqali o‘tiladi |
| Authorization | Har bir ID-based mutation server-side owner/role scope bilan tekshiriladi |
| Performance | Public va admin critical views’da LCP/INP/CLS baseline yoziladi; optimizatsiya average emas p75 bilan kuzatiladi |
| Reliability | `health/ready`, mutation error rate, timeout va rollback holatlari loglanadi; destructive operation transaction bilan himoyalanadi |
| Memory/render cost | Katta table/list’da render count va payload size baseline olinadi; keraksiz duplicate fetch kamaytiriladi |
| Responsive UI | Mobile, tablet va desktop viewport’larda no-overflow, usable actions va stable dialog/calendar layout |
| Data safety | Schema parity saqlanadi; restore/import dry-run, selected scope, count summary va rollback’siz production write yo‘q |
| Delivery | Har bir cohesive source improvement alohida commit, build/typecheck/unit/integration/browser gates bilan |

## 7. Commit va rollout tartibi

Birinchi source commit research note va ushbu plan bilan cheklanadi. Keyingi commitlar quyidagi tartibda alohida bo‘ladi: **shared action/filter contract**, **resource selection/list foundation**, **statistics widget registry**, **warehouse/sets master-detail cleanup**, **finance selective resource pattern**, va kerak bo‘lsa **quick actions/notifications**. Har bir commit oldingi commitning behavior’ini saqlaydi va mustaqil rollback qilinishi mumkin.

Har bir commit avval `/home/ubuntu/ok` source branch’da typecheck, production build, unit/integration test va browser smoke bilan tekshiriladi. Keyin source branch/main synchronization va `FreedoomForm/ok:main` non-force push qilinadi. Database migration faqat schema zarurati isbotlanganda, oldin backup va explicit user confirmation bilan amalga oshiriladi; UI reference transfer uchun database reset qilinmaydi.

## 8. Birinchi implementatsiya uchun aniq ticketlar

| Ticket | Scope | Blocking edges | Expected deliverable |
|---|---|---|---|
| UI-1 | `ResourceActionBar` contract va flat semantic action states | P0 baseline | Shared action model, existing toolbar adapters, tests |
| UI-2 | Generic selection/filter modelni clients/orders/ingredientsga ulash | UI-1 | Reusable selection/filter behavior, browser regression coverage |
| UI-3 | Statistics widget registry va persisted order/visibility | UI-1, existing stats payload | Configurable statistics tab, metric semantics documenti |
| UI-4 | Sets/Warehouse master-detail visual simplification | UI-1, UI-2 | Minimal resource workflow, no schema rewrite |
| UI-5 | Date-scoped cooking planning invariantlari | UI-4 | Stable day normalization, plan/cook/remaining validation |
| UI-6 | Finance card patternini selective qo‘llash | UI-1, existing FinanceTab | Resource order/selection only where beneficial |
| UI-7 | Full browser/API quality matrix va performance baseline | UI-1–UI-6 incrementally | Regression report, Core Web Vitals and request baseline |

## 9. Qat’iy non-goals

Bu reja `-1` ilovasini webga to‘liq port qilish emas. Kotlin, Jetpack Compose, Room, WorkManager, Android widget provider, native camera va local SQLite schema AutoFood’ga ko‘chirilmaydi. AutoFood’ning mavjud customer site, courier flow, order status lifecycle, payment/finance, admin role hierarchy, Prisma schema va Vercel compatibility buzilmaydi.

Shuningdek, reference’dagi ranglar, glass/gradient/shadow, uzun textual explanations yoki ortiqcha animation AutoFood’ga avtomatik kiritilmaydi. Hozirgi talab — **tekis, ixcham, kam tekstli, tez va aniq interface**. Reference’dan faqat bu talabga xizmat qiladigan information architecture va interaction patternlari olinadi.

## References

[1]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/MainActivity.kt "Reference MainActivity: lifted shell state and navigation"
[2]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ui/components/UnifiedButton.kt "Reference UnifiedButton semantic action variants"
[3]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ui/components/UnifiedTable.kt "Reference UnifiedTable search, filter and sorting primitives"
[4]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ReportsScreen.kt "Reference configurable reports widgets"
[5]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/FinansiPanel.kt "Reference finance resource cards and selection"
[6]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/ContractCalendar.kt "Reference controlled calendar state machine"
[7]: https://github.com/ozodbekasilbekov2-gif/-1/blob/297fed5/app/src/main/java/com/example/data/BackupManager.kt "Reference backup/import safety patterns"
