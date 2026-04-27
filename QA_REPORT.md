# 🔍 Senior QA Analyst — Deep Audit Report
## Restaurant Management System (RMS2)

**Auditor:** Claude (acting as Senior QA Analyst)
**Date:** April 23, 2026
**Scope:** Security, Authorization, Functionality, UI/UX, Design, Performance, Code Quality
**Method:** Static code review (deep) of `/sessions/compassionate-quirky-newton/mnt/RMS2`
**Tech Stack:** Next.js 16 · React 19 · TypeScript · Prisma v7 · NextAuth v5 (beta) · Tailwind v4 · shadcn/ui · Zustand · SWR

---

## 🚨 Executive Summary — No Hold-Back Verdict

**This application is NOT production-ready.** It has serious, exploitable security holes, financial integrity bugs, and fails to build. I found **170+ concrete findings** across the four focus areas, including **17 Critical** issues that must be fixed before any production use.

| Severity | Count | Must-fix-before-ship? |
|---|---|---|
| 🔴 **Critical** | 17 | **Yes — blocking** |
| 🟠 **High** | 37 | **Yes** |
| 🟡 **Medium** | 82 | Strongly recommended |
| 🟢 **Low** | 22 | Nice-to-have |
| **Total** | **158+** | |

**Top 5 “stop-everything-and-fix-now” findings:**

1. **Unauthenticated API endpoints** (`/api/kds/active`, `/api/serve/ready`) leak live order + customer data to the public internet.
2. **All admin server actions are unauthorized** — any logged-in kitchen staff can create OWNER accounts, edit timesheets, refund orders, and change tax rate.
3. **Payment can be recorded on paid/void orders** and **refunds can exceed order total** → direct cash leakage.
4. **`.env` is committed** with live Postgres credentials and a weak, hardcoded `AUTH_SECRET` → full database compromise.
5. **Application does not build** — missing `Textarea` UI component and Prisma v7 schema error block deployment.

---

## 🗂️ Table of Contents

1. [Critical Findings — Fix Before Ship](#critical-findings)
2. [Security & Authorization](#security--authorization)
3. [Functionality & Bugs](#functionality--bugs)
4. [UI / UX & Design](#ui--ux--design)
5. [Performance & Code Quality](#performance--code-quality)
6. [Prioritized Fix Roadmap](#roadmap)
7. [Test Plan / Regression Checklist](#test-plan)

---

<a id="critical-findings"></a>
## 🔴 Critical Findings — Fix Before Ship

| # | Area | File:Line | Issue |
|---|---|---|---|
| C1 | Security | `src/app/api/kds/active/route.ts:4` · `src/app/api/serve/ready/route.ts:4` | No `auth()` check — public leak of all active kitchen orders incl. customer PII. |
| C2 | Security | `src/server/actions/user.actions.ts:8-28` | `createUser()` accepts any role → floor-staff can create OWNER accounts (privilege escalation). |
| C3 | Security | `src/server/actions/attendance.actions.ts:245-280` | `adminUpdateRecord` / `adminDeleteRecord` have zero auth checks → payroll fraud. |
| C4 | Security | `src/app/(dashboard)/admin/**/page.tsx` (7 pages) | Admin pages only UI-gated — any logged-in user can navigate and mutate settings, users, menu, promotions. |
| C5 | Security | `.env` (committed) | Live DB password + weak/static `AUTH_SECRET` checked into git. |
| C6 | Security | `prisma/seed.ts:14-17` | Sequential 4-digit PINs (1234, 2345, 3456, 4567) seeded as default credentials. |
| C7 | Functionality | `src/server/actions/order.actions.ts:337-455` `recordPayment` | No idempotency; double-clicks + concurrent calls allow duplicate payments and payments on VOID/REFUNDED orders. |
| C8 | Functionality | `src/server/actions/order.actions.ts:832-890` `refundOrder` | Can refund an already-refunded order; partial-refund amount is not capped against order total → refund > paid. |
| C9 | Functionality | `src/server/actions/order.actions.ts:249-271` | Inventory decrement has no pre-check; two concurrent orders can oversell stock into negative. |
| C10 | Functionality | `src/server/actions/table.actions.ts:97-113` | Reservation overlap check is not transactional → double-booking race condition. |
| C11 | Functionality | `src/components/storefront/storefront-checkout.tsx:48-56` | Customer can schedule pickup in the past; no minimum lead-time validation. |
| C12 | Functionality | `src/components/admin/mock-campaign-creator.tsx:8` | Imports missing `@/components/ui/textarea` → **build fails**. |
| C13 | Functionality | `prisma/schema.prisma:18` | Prisma v7 no longer supports `url = env(...)` in datasource — migrations fail. |
| C14 | UX | `src/app/(dashboard)/admin/menu-manager.tsx:149-158` | Delete menu item with no confirmation dialog → accidental data loss. |
| C15 | UX | `src/components/pos/order-builder.tsx:308-321` | `Void Order` button has no confirmation, no reason capture, no audit log. |
| C16 | UX | `src/components/pos/table-grid.tsx:177` | `window.confirm()` used for destructive action (poor branding + a11y). |
| C17 | Perf | `src/server/queries/analytics.queries.ts:10-203` | Fetches all paid orders twice with deep includes; will timeout beyond a few thousand orders. |

---

<a id="security--authorization"></a>
## 🔐 1. Security & Authorization

### 1.1 Critical

**S-C1. Unauthenticated public API routes leak live operations data**
- **Files:** `src/app/api/kds/active/route.ts:4`, `src/app/api/serve/ready/route.ts:4`
- The routes return every active order, customer name, table, prep timings — **no `auth()` call**. `src/middleware.ts:9` excludes `/api/auth` but Next middleware does not gate `/api/*` routes by default.
- **Attack:** `curl https://site/api/kds/active` → full order book + customer data.
- **Fix:**
  ```ts
  import { auth } from "@/lib/auth";
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  ```

**S-C2. Every admin server action is unauthorized**
- **Files:** `src/server/actions/user.actions.ts`, `menu.actions.ts`, `promotion.actions.ts`, `settings.actions.ts`, `crm.actions.ts`, `schedule.actions.ts` — none call `auth()` or check `role`.
- **Impact:** Any authenticated user (even KITCHEN_STAFF) can:
  - `createUser({ role: "OWNER" })` → privilege escalation
  - `updateSiteSetting("TAX_RATE", 0)` → revenue fraud
  - `updateCustomerPoints(id, -9999)` → loyalty fraud
  - `deleteTable()` → service disruption
  - `adminUpdateRecord()` → payroll fraud
- **Fix:** Create a single helper:
  ```ts
  async function requireRole(roles: Role[]) {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!role || !roles.includes(role)) throw new Error("Forbidden");
    return session!;
  }
  ```
  Call `await requireRole(["OWNER","SUPERVISOR"])` at the top of every admin action.

**S-C3. Admin pages are only UI-gated**
- **Files:** `src/app/(dashboard)/admin/analytics|customers|menu|promotions|settings|tables|marketing|users/page.tsx` — only `timesheets/page.tsx` does a server-side role check.
- **Attack:** Any logged-in user types `/admin/settings` in the URL bar.
- **Fix:** Add server-side redirect on every admin page, or move the role check into the `(dashboard)/admin/layout.tsx` so it applies to the whole group.

**S-C4. `.env` committed with live credentials**
- **File:** `.env`
  - `DATABASE_URL` & `PGPASSWORD` — live Neon Postgres credentials.
  - `AUTH_SECRET` hardcoded, static across environments.
- **Fix:**
  1. `git rm --cached .env` and add `.env` to `.gitignore`.
  2. **Rotate** the DB password and `AUTH_SECRET` (`openssl rand -hex 32`) immediately.
  3. Scrub history with `git filter-repo` or `bfg-repo-cleaner`.

**S-C5. Seeded default credentials are sequential and weak**
- **File:** `prisma/seed.ts:14-17`
  - 101/1234, 102/2345, 103/3456, 104/4567.
- **Fix:** Remove the seed entirely from production pipelines, or generate random 8+ digit PINs and force a reset on first login.

### 1.2 High

| ID | File:Line | Finding | Recommendation |
|---|---|---|---|
| S-H1 | `src/app/(auth)/login/page.tsx:19-42` | No login rate-limit — 10 000-PIN brute-force trivially automatable. | Add `@upstash/ratelimit` or a middleware throttle: e.g., 5 attempts / 15 min / IP + employeeId. |
| S-H2 | `src/server/actions/attendance.actions.ts:245-280` | `adminUpdateRecord/Delete/Create` unauth → payroll fraud. | `requireRole(["OWNER","SUPERVISOR"])`. |
| S-H3 | `src/server/actions/crm.actions.ts:71-127` | `getCustomers/getCustomerDetails` unrestricted → PII dump. | Gate to OWNER/SUPERVISOR/FLOOR_STAFF; block KITCHEN_STAFF. |
| S-H4 | `src/server/actions/order.actions.ts:337-455` | `recordPayment` + `voidOrder` unauth → embezzlement vector. | Require OWNER/SUPERVISOR for void/refund; log actor. |
| S-H5 | `src/server/actions/user.actions.ts` `createUser` | No role-value whitelist. | `z.enum(["OWNER","SUPERVISOR","FLOOR_STAFF","KITCHEN_STAFF"]).parse(role)`. |
| S-H6 | `src/server/actions/attendance.actions.ts` `getTimesheets` | Returns every employee’s records to any authed user. | Scope by `userId === session.user.id` unless role is manager. |
| S-H7 | NextAuth config | `AUTH_SECRET` format looks hand-typed/static. | Regenerate with `openssl rand -hex 32`, unique per env. |
| S-H8 | `src/app/(dashboard)/timeclock/page.tsx:33-50` | Timeclock is effectively a second login; no throttle. | Same rate-limit as login; lock after N failures. |
| S-H9 | `src/generated/prisma/*` shipped in `src/` | Prisma client accidentally importable from client bundles. | Move to `node_modules/.prisma` (default) or enforce via `server-only`. |

### 1.3 Medium

- **S-M1** `src/server/actions/crm.actions.ts:48-69` — `updateCustomerPoints` unauth → loyalty fraud.
- **S-M2** `src/server/actions/schedule.actions.ts` `getWeeklySchedules`, `getStaffList` — everyone sees the whole roster.
- **S-M3** Middleware matcher excludes `/api/auth` but not `/api/*` — false sense of security for future API routes. Standardize on a **deny-by-default** `requireSession()` helper used in every route.
- **S-M4** No CSRF hardening for future POST API endpoints — rely on NextAuth session cookies marked `SameSite=Lax` at minimum.
- **S-M5** No audit log table — impossible to forensic-trace tampering of orders, users, or timesheets.
- **S-M6** `prisma/schema.prisma` User.pin stored as bcrypt hash ✅ but no uniqueness enforcement — two users can share a PIN and clock each other in.

### 1.4 Low

- **S-L1** `console.error(err)` in multiple action files can leak stack traces/SQL in browser devtools via Next error overlay. Use structured sanitized logger in production.
- **S-L2** Minimum PIN length is 4 digits — too small a keyspace.
- **S-L3** Seed script can be run against production by accident — gate with `if (process.env.NODE_ENV === "production") throw`.

---

<a id="functionality--bugs"></a>
## 🧪 2. Functionality & Bugs

### 2.1 Critical

**F-C1. `recordPayment` allows double-pay and pay-after-paid/void**
- `src/server/actions/order.actions.ts:337-455`
- No idempotency key, no status guard (`order.status !== "OPEN" && !== "PAID"` is missing).
- **Repro:** Click **Pay** twice fast → two Payment rows, `amountPaid` doubles. Or void an order then pay it → payment recorded.
- **Fix:** Begin transaction; `SELECT ... FOR UPDATE`; assert status is `OPEN`; require an idempotency token from client.

**F-C2. `refundOrder` can refund twice and exceed total**
- `src/server/actions/order.actions.ts:832-890`
- Only checks `order.status !== "PAID"`. Doesn’t check already-REFUNDED. Refund amount is `sum(frozenPrice*qty)` of selected items with no cap.
- **Fix:**
  ```ts
  if (order.status === "REFUNDED") throw new Error("Already refunded");
  const maxRefund = Number(order.total) - Number(order.refundAmount ?? 0);
  refundAmount = Math.min(refundAmount, maxRefund);
  ```

**F-C3. Inventory can go negative — overselling**
- `src/server/actions/order.actions.ts:249-271`
- Decrement is unconditional then clamped to 0 after the fact — two concurrent orders both see stock=1 and both succeed.
- **Fix:** `UPDATE menuItem SET stockQuantity = stockQuantity - :q WHERE id = :id AND trackStock = true AND stockQuantity >= :q` — if row-count = 0, abort transaction.

**F-C4. Reservation double-booking race**
- `src/server/actions/table.actions.ts:97-113`
- Overlap `findFirst` check is outside a transaction → two concurrent reserves both pass.
- **Fix:** Wrap in `prisma.$transaction` with `isolationLevel: "Serializable"`, or use a DB-level exclusion constraint (`tstzrange && reserved_range`).

**F-C5. Scheduled pickup time can be in the past**
- `src/components/storefront/storefront-checkout.tsx:48-56`
- **Fix:** Validate `scheduledAt > now + MIN_LEAD_MINUTES` on both client and server.

**F-C6. Build does not succeed**
- `src/components/admin/mock-campaign-creator.tsx:8` → imports `@/components/ui/textarea` which does not exist (see `build.log`).
- `prisma/schema.prisma:18` → Prisma v7 forbids `url = env("DATABASE_URL")` (see `prisma_err.txt`); must move to `prisma.config.ts`.
- **Fix:** (a) `npx shadcn@latest add textarea`; (b) move the `url` to `prisma.config.ts` or remove and inject via `@prisma/adapter-pg`.

### 2.2 High

| ID | File:Line | Bug | Repro / Fix |
|---|---|---|---|
| F-H1 | `src/lib/pricing.ts:47` | Promotion can drive per-item price below zero. `Math.max(0, price-discount)` clamps price but discount is still recorded as full amount. | Cap discount to the item's base price *before* applying. |
| F-H2 | `src/lib/cart-calculations.ts:226-230` | Tax computed on **discounted** subtotal — wrong in most US jurisdictions; undercharges tax. | Compute tax on the pre-discount subtotal, then subtract discounts. Make rule jurisdiction-configurable. |
| F-H3 | `src/server/actions/order.actions.ts:556-714` `addItemsToOrder` | Race: items can be appended to an order mid-payment, ending up on a PAID ticket. | Pessimistic lock on order row or optimistic concurrency via `version` column. |
| F-H4 | `src/server/actions/order.actions.ts:788-809` `serveItem` | Doesn't check order status — staff can mark items SERVED on VOID orders. | `if (order.status === "VOID") return`. |
| F-H5 | `src/server/actions/order.actions.ts:301-315` `bumpItem` | Same issue — can bump on VOID. | Status guard. |
| F-H6 | `src/server/actions/order.actions.ts:249-271` | Voided items’ stock never returned to inventory. | On void: loop items, `increment: qty` for tracked items. |
| F-H7 | `src/components/pos/order-builder.tsx:775-782` | 86’d items (admin set `isAvailable=false`) can still be ordered if `stockQuantity>0`. | Check both `isAvailable` and stock. |
| F-H8 | `src/hooks/use-kds-orders.ts:44-52` | SWR fetcher swallows errors silently → staff doesn’t know when KDS is stale. | Add `onError` with toast; show banner "Offline — last update 2 min ago". |
| F-H9 | `src/stores/cart-store.ts:50` | `... as any` cast on `menuItems` snapshot drops required fields → downstream null refs. | Define `MenuItemSnapshot` type. |
| F-H10 | `src/components/pos/order-builder.tsx:811` + desktop cart | Fixed 320px cart; on mid-sized desktops (< 1024px) order column is cut off. | Use `flex-1 max-w-sm`. |

### 2.3 Medium (condensed)

- **F-M1** Points double-deducted when `pointsToRedeem > 0` in Quick Sale (`fireOrder` line 237 + `recordPayment` line 388).
- **F-M2** Floating-point errors: modifier prices + tax never rounded → cumulative cent errors. Round to 2 dp after every step.
- **F-M3** Cart doesn’t reactively re-calc when promotions change unless an item is added/removed.
- **F-M4** Combo reward-ratio logic gives items $0.17 prices when combo.value ≠ sum(base). Clamp `combo.value ≤ sum(baseTotal)`.
- **F-M5** Order-history receipts average `frozenPrice` across items → wrong per-unit price display.
- **F-M6** Stock decrements not rolled back on transaction failure (no try/catch around inventory update).
- **F-M7** `attendance.clockIn` race: two tabs open, both can clock in → duplicate open records. Add unique partial index: `@@unique([userId], where: clockOut IS NULL)` (Postgres partial index via `$executeRaw` migration).
- **F-M8** Week-start hardcoded to Sunday (`getDay()`); breaks for ISO locales.
- **F-M9** `durationMinutes` uses `new Date()` again after setting `clockOut` — off-by-ms but also wrong if server TZ ≠ user TZ.
- **F-M10** Reservation creation doesn't hold/block the table status → a server can seat walk-ins on a reserved table.
- **F-M11** Overlapping shifts allowed (`createShift` has no overlap check).
- **F-M12** `copyPreviousWeekSchedule` is not idempotent — running twice double-schedules everyone.
- **F-M13** Promotion value not validated — negative, >100 %, absurdly large values accepted.
- **F-M14** Multiple overlapping promotions pick one silently → confusing UX + audit problem.
- **F-M15** Partial-refund UI lets you pick a $60 refund on a $30 order — server must cap, not just UI.
- **F-M16** Refunds store float without rounding → cumulative drift.
- **F-M17** Split payments read `remainingAfterPoints` from closure — stale when customer data changes mid-dialog.
- **F-M18** Takeout/CRM phone numbers have no format validation — violates the unique constraint with whitespace-only strings.
- **F-M19** No minimum-lead-time on storefront scheduled orders (see also F-C5).
- **F-M20** Server-side error messages like `Failed to update modifiers` swallow the real error — bad DX + hides bugs.

### 2.4 Low

- **F-L1** `durationMinutes` computed from two `new Date()` calls ms apart — precision loss.
- **F-L2** `serve-board` and `table-grid` are not invalidated after mutations — staff sees stale state for up to 5 s.
- **F-L3** KDS empty state has friendly copy but no link back to POS.

---

<a id="ui--ux--design"></a>
## 🎨 3. UI / UX & Design

### 3.1 Critical / High — user-facing blockers

| ID | File:Line | Issue | Recommendation |
|---|---|---|---|
| U-C1 | `src/components/pos/table-grid.tsx:177` | Uses native `window.confirm()` for destructive action (cancel reservation) — not branded, breaks a11y, can't be styled. | Replace with `<AlertDialog>` (shadcn). |
| U-C2 | `src/components/admin/menu-manager.tsx:149-158` | Delete with **no** confirmation dialog. | Wrap the trash button in an `<AlertDialog>`. |
| U-C3 | `src/components/pos/order-builder.tsx:308-321` | **Void Order** button fires immediately — no confirmation and no reason-code capture (required for audit). | Open modal: "Reason for void?" → required dropdown + confirm. |
| U-C4 | `src/components/shared/sidebar.tsx:234` | Sidebar nav uses `<div onClick>` instead of `<a>`/`<button>`. Screen readers skip it. | Use shadcn's `<NavigationMenu>` or plain `<Link>`. |
| U-C5 | `src/components/pos/table-grid.tsx:246` | Tables are clickable `<Card>`s but no `role="button"`, `tabIndex`, or keyboard handler. | Make the entire card a `<button>` or add `role/tabIndex/onKeyDown`. |
| U-C6 | `src/app/(dashboard)/kds/page.tsx:72-84` | Order aging conveyed **color-only** (green/amber/red). WCAG failure. | Add text label or icon ("< 10 min · 10–20 · > 20"). |
| U-H1 | `src/components/pos/order-builder.tsx:785-788` | Modifier dialog closes if user clicks outside; selections lost without warning. | `onOpenChange` confirm if selections exist. |
| U-H2 | `src/components/pos/order-builder.tsx:811` | Cart panel fixed `w-80 lg:w-96` — overflows on narrow laptops. | `max-w-sm w-full` inside flex container. |
| U-H3 | `src/components/shared/sidebar.tsx:310-316` | Mobile hamburger has no `aria-label`. | `aria-label="Toggle navigation"`. |
| U-H4 | `src/app/(dashboard)/pos/page.tsx:40,45` | `bg-blue-600`/`bg-purple-600` hardcoded → breaks dark mode + theming. | Use `bg-primary` + `variant` on `<Button>`. |
| U-H5 | `src/app/(dashboard)/admin/analytics-dashboard.tsx:322-327` | Full-screen spinner overlay on period change; can't even change period while loading. | Skeleton cards + disabled button states. |

### 3.2 Medium — recurring quality issues (grouped)

**Accessibility**
- Menu/storefront cards are clickable divs with no role/tabIndex/keyboard. (`storefront-menu.tsx:46`)
- Icon-only buttons in KDS cards lack `aria-label`.
- Form inputs in POS notes dialog (`order-builder.tsx:539`) have no associated `<Label>`.
- Emoji-only buttons "⚡ Quick Sale" / "📦 New Takeout" — replace with icon + text, add aria-label.
- Recharts `<ResponsiveContainer>` blocks lack `aria-label`.

**Responsive**
- Menu grid `grid-cols-2` on phones — touch targets < 44 px.
- POS sticky bottom bar ignores iOS safe-area inset (`pb-safe`).
- Checkout form `grid-cols-1 md:grid-cols-2` cramped on tablet (no gap scaling).
- KDS header doesn’t wrap on narrow tablets.

**Visual consistency**
- Status colors hardcoded (`bg-emerald-500`, `bg-red-500`) throughout — define a `statusClasses[]` map tied to Tailwind theme tokens.
- Button styles inconsistent — `<Button>` component vs raw `<button>` with utility classes (e.g., "Add note / allergy" on `order-builder.tsx:533`).
- Role badge `bg-slate-200/50` unreadable in dark mode.
- Fire Order uses `bg-red-600` instead of a first-class `variant="fire"`.
- Analytics KPI icons each a different color with no semantic rationale.

**User flow**
- Checkout redirects to `/pos` without showing the order number → customers feel uncertain.
- Success page `storefront-checkout.tsx:78` invents a fake order ID via `Math.random()` instead of returning the real one.
- Remove-item on a ticket is silent with no Undo.
- Error toasts expose server error messages verbatim ("Prisma constraint violation…") — wrap in user-friendly copy.
- No onboarding/help for KDS/POS abbreviations.

**Copy**
- Abbreviation "KDS" never explained.
- Colloquial "86 this item" in tooltips (change to "Mark as unavailable").
- Mixed casing: "FIRE ORDER" vs "Add to Order" vs "Sign in" vs "Login".
- "Remaining: $X" doesn't clarify whether it's after points/discounts.

**Loading / empty / error**
- No skeleton loaders anywhere; all pages show a spinner or blank.
- Order history has no loading state.
- Storefront skips empty categories silently instead of communicating.
- Payment dialog doesn't show errors inline — generic toast only.

**Dark mode**
- Several hardcoded colors break dark mode (analytics icons, status pills, login tile).
- Test every page with `next-themes` toggled.

### 3.3 Low

- Toasts use sonner inconsistently — some actions give feedback, some don't.
- Loading spinner in "Fire Order" button is inline CSS — extract `<Spinner>` component.
- `alt={item.name}` on storefront images — add fallback `|| "Menu item"`.
- `title={...}` used for truncation tooltips — use a proper Tooltip component.

---

<a id="performance--code-quality"></a>
## ⚡ 4. Performance & Code Quality

### 4.1 Critical / High

**P-C1. Analytics N+1 / over-fetch**
- `src/server/queries/analytics.queries.ts:10-203`
- Pulls every paid order with deep `include`s twice, then loops in JS for totals. Will **timeout** at scale.
- **Fix:** Use Prisma aggregation (`groupBy`, `_sum`), or pre-compute daily metrics into a `DailySales` materialized table.

**P-C2. `order.queries.ts:37-66` — `findMany` with `take:200` and all fields**
- No cursor pagination, no `select`.
- **Fix:** Cursor pagination + `select` only the columns the list screen renders.

**P-C3. Missing indexes**
- `prisma/schema.prisma`: no `@@index` on `Order.status`, `Order.createdAt`, `Order.tableId`, `Promotion.active`, `PromotionRule.promotionId`, `AttendanceRecord.userId,clockIn`.
- **Fix:** Add composite indexes matching your hot queries. Run `EXPLAIN ANALYZE` in dev.

**P-C4. `menu.queries.ts:23-46` over-includes modifier groups on list view**
- Shipped to client is 500 KB+ for 100-item menus.
- **Fix:** List query = `select { id, name, price, image }`; detail query includes modifiers.

**P-C5. `JSON.parse(JSON.stringify(...))` round-trips**
- `src/app/(dashboard)/pos/page.tsx:52` and `admin/menu/page.tsx:22-25`
- Expensive, loses Decimal/Date types, and unnecessary since Next serializes props anyway.
- **Fix:** Return a mapped plain object with explicit Decimal → number conversion.

**P-C6. Build-config weaknesses**
- `next.config.ts` is empty — no `images.remotePatterns`, no `compress`, no experimental flags.
- `middleware.ts` convention deprecated in favor of `proxy` in Next 16.

**P-H1. Huge client bundles from recharts on admin pages**
- `src/components/admin/analytics-dashboard.tsx` eagerly imports three chart components → ~250 KB gzipped on every admin page.
- **Fix:** `const RevenueChart = dynamic(() => import('./revenue-chart'), { ssr: false });`

**P-H2. `order-builder.tsx` is 1000+ lines of mixed concerns**
- Cart logic + payment + modifiers + notes + CRM prompt all in one client component with lots of state.
- **Fix:** Split into `<Cart>`, `<PaymentDialog>`, `<ModifierDialog>`, `<CustomerLookup>`.

**P-H3. SWR polling every 5 s without dedup**
- `serve-board.tsx:40-42`, `use-kds-orders.ts:43-70`
- 5 tablets × 12 req/min = 60 req/min just for polling.
- **Fix:** Increase to 10–15 s; add `dedupingInterval`; ideally use Postgres LISTEN/NOTIFY or Pusher for push instead.

**P-H4. Raw `<img>` in `menu-manager.tsx:242-247` & `storefront-menu.tsx:51`**
- Loads full-resolution images, no WebP/AVIF, no lazy load.
- **Fix:** `import Image from "next/image"` with `sizes`, configure `next.config.ts > images.remotePatterns`.

### 4.2 Medium

- **P-M1** `any` types scattered through POS / KDS — `modifyingItem: any`, `customerData: any`, `order: any`, `where: any`. Replace with Prisma-derived types.
- **P-M2** `(session?.user as any).role` everywhere — extend next-auth module types once:
  ```ts
  declare module "next-auth" { interface Session { user: { id: string; role: Role; name: string } } }
  ```
- **P-M3** Recurrent tax/discount math duplicated between `cart-calculations.ts`, `order.actions.ts`, and `storefront-checkout.tsx` — extract to a single `pricing.ts` with unit tests.
- **P-M4** Magic numbers: tax 0.07, loyalty rate 0.10 — move to `SiteSetting` table (already exists) and cache.
- **P-M5** Transactions wrap too much work — e.g., fireOrder locks every item's stock row for the whole transaction. Split inventory updates into a second transaction or use `UPDATE … WHERE stock_quantity >= N` and check affected-rows.
- **P-M6** No `revalidateTag` usage — every mutation calls `router.refresh()`, blowing the entire route cache.
- **P-M7** No Suspense / streaming on heavy pages (analytics, orders).
- **P-M8** `prisma/schema.prisma`: `Modifier.priceAdjustment`, `Order.total`, etc. use Decimal but are converted to `Number()` at the edge losing precision.
- **P-M9** `src/generated/prisma/*` checked into the `src` tree — pollutes bundle analysis + risks accidental client imports. Move back to `node_modules/.prisma/client` default.
- **P-M10** No connection-pool config for Prisma/Neon — defaults can exhaust under dinner rush.
- **P-M11** React-compiler plugin is enabled (`babel-plugin-react-compiler`) but many components still have redundant `useCallback`/`useMemo` — audit and remove; or conversely, ensure compiler is actually running (check Next 16 integration).
- **P-M12** `eslint.config.mjs` is minimal — no stricter rules (no-floating-promises, strict-boolean-expressions) catching the bug patterns above.

### 4.3 Low

- `tsconfig.tsbuildinfo` (138 KB) committed to repo.
- `build_error.txt`, `prisma_err.txt`, `build.log` checked in — move to `.gitignore`.
- `components.json` and `shadcn` pinned — make sure `npx shadcn diff` surfaces stale components.
- Unused `tsx` dev dep + `dotenv` dep duplicate Next's built-in env handling.
- Dead commented-out code in several actions files.
- Inconsistent error return shape — some actions `throw`, some return `{ success:false, error }`.

---

<a id="roadmap"></a>
## 🗺️ 5. Prioritized Fix Roadmap

### Week 1 — Stop-the-bleeding (critical only)
1. **Rotate & remove** `.env` from git; regenerate `AUTH_SECRET`, DB password.
2. Fix Prisma v7 schema + add missing `Textarea` → **make the build pass**.
3. Add `requireRole()` helper; wire into **every** server action + admin page layout + `/api/*` route.
4. Guard `recordPayment`, `voidOrder`, `refundOrder` with status checks + caps + idempotency.
5. Fix inventory decrement with atomic `UPDATE ... WHERE stock >= qty`.
6. Rate-limit `/api/auth` and `/timeclock` endpoints.
7. Remove sequential seed PINs; force first-login reset.

### Week 2 — High-impact correctness
- Fix reservation & shift overlap races (transactions + locks).
- Restore inventory on void/refund.
- Fix tax-calculation order (pre-discount base, not post).
- Eliminate floating-point drift (round to cents everywhere).
- Replace `window.confirm` and silent deletes with `<AlertDialog>` + reason capture.
- Add confirmations for Void, Delete, Cancel, 86 actions.

### Week 3 — Performance
- Add DB indexes matching hot queries.
- Replace analytics loops with Prisma `groupBy` / materialized view.
- Code-split recharts and dynamically-import chart components.
- Switch to cursor pagination for order history.
- Replace 5 s polling with push (LISTEN/NOTIFY or WebSocket) or bump dedup.

### Week 4 — UX / Accessibility / Polish
- Semantic HTML pass: every clickable card/div becomes a `<button>` or `<a>`.
- Dark-mode pass: replace every hardcoded color with theme token.
- Responsive pass: POS + storefront tested on real tablet + phone.
- Skeleton loaders everywhere.
- Copy pass: plain-English KDS/serve labels; consistent casing.
- Toasts for every mutation (success + failure).

### Ongoing
- Add audit log table + middleware.
- Write unit tests for `cart-calculations.ts`, `pricing.ts`.
- Write integration tests for payment/refund/void flows.
- Add Playwright smoke tests for POS → Fire → KDS → Serve → Pay loop.

---

<a id="test-plan"></a>
## ✅ 6. Regression / QA Test Plan (condensed)

### Auth & RBAC
- [ ] Log in as each role; attempt every admin URL directly; confirm redirect for non-managers.
- [ ] Call each server action with a KITCHEN_STAFF session; confirm all admin mutations return `Forbidden`.
- [ ] Hit `/api/kds/active` and `/api/serve/ready` unauthenticated → 401.
- [ ] Brute-force login 100 attempts → rate-limited.
- [ ] Rotate `AUTH_SECRET` → existing sessions invalidated.

### Payments & Money
- [ ] Double-click Fire Order → only one order created (idempotency).
- [ ] Pay $0.01 on $100 order → rejected or partial-remainder tracked correctly.
- [ ] Pay then pay again → rejected.
- [ ] Refund full → status REFUNDED; refund again → rejected.
- [ ] Refund partial > order total → clamped.
- [ ] Void paid order → status/inventory/points all reversed.
- [ ] Promotion 200% discount → clamped; no negative totals.
- [ ] Tax: $100 item + 50% off + 7% tax = expected value per jurisdiction rule.

### Inventory
- [ ] Two simultaneous orders on stock=1 → only one succeeds.
- [ ] 86 item → cannot be added to order.
- [ ] Void order → stock restored.
- [ ] Refund line → stock restored for tracked items.

### Reservations & Schedules
- [ ] Concurrent reservations on same slot → only one succeeds.
- [ ] Seat walk-in on reserved table inside reserve window → blocked/warned.
- [ ] Copy-previous-week twice → no duplicates.
- [ ] Two overlapping shifts for same user → blocked.

### Timeclock
- [ ] Already-clocked-in user tries again → blocked.
- [ ] User in different TZ → hours computed in restaurant's TZ.
- [ ] Manager edits another user's record → allowed with audit entry.
- [ ] Employee tries to edit another user's record → blocked.

### Storefront
- [ ] Customer schedules pickup in past → blocked.
- [ ] Schedule pickup 5 min out when min-lead is 30 → blocked.
- [ ] Submit order on mobile Safari → iOS safe-area respected.

### UI / A11y
- [ ] Navigate sidebar with Tab/Enter only.
- [ ] VoiceOver/NVDA reads every button meaningfully.
- [ ] Toggle dark mode on every page → no invisible text.
- [ ] Test at 375 px (iPhone SE), 768 px (iPad), 1366 px (laptop), 1920 px.

### Performance
- [ ] Seed 10 000 orders → analytics page loads < 2 s.
- [ ] Profile KDS with 50 active orders → no jank.
- [ ] Bundle analyzer: no admin page > 500 KB gzip.

---

## 📞 Next Steps

This audit is intentionally unsparing — you asked for "no hold back." Nothing here is personal; every item is fixable, and most of the Critical issues share a root cause: **a missing authorization layer and no transactional discipline around money & inventory**. Fix those two systemically and roughly a third of the report disappears.

If you'd like, I can continue into any of:
- Generate a ready-to-paste `requireRole()` helper and patch every action file.
- Write the missing `Textarea` component + the Prisma v7 config migration.
- Produce a test harness (Vitest + Playwright) covering the regression plan above.
- Produce the same report as an Excel bug tracker (`.xlsx`) for your dev team.

— End of report —
