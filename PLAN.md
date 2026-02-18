# RMS2 — Implementation Plan

## Step 1 · Project Initialization
- [ ] Scaffold Next.js 16 with TypeScript (`npx -y create-next-app@latest ./`)
- [ ] Install core deps:
  ```
  prisma @prisma/client
  next-auth@beta @auth/prisma-adapter
  tailwindcss @tailwindcss/postcss
  zod react-hook-form @hookform/resolvers
  swr zustand
  lucide-react
  bcryptjs @types/bcryptjs
  ```
- [ ] Initialize Shadcn UI (`npx shadcn@latest init`)
- [ ] Configure `tailwind.config.ts` — dark mode `class`, custom RMS palette
- [ ] Set up `.env` with `DATABASE_URL` and `AUTH_SECRET`

## Step 2 · Database & Prisma
- [ ] Copy finalized `SCHEMA.prisma` → `prisma/schema.prisma`
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Create `prisma/seed.ts`:
  - 4 Users (one per role, PINs hashed with bcrypt)
  - 10 Tables (T1–T10)
  - 4 Categories with 5-6 MenuItems each
  - 2 sample Promotions (one FIXED/ITEM, one PERCENT/CATEGORY)
- [ ] Add seed script to `package.json` and run `npx prisma db seed`
- [ ] Create `src/lib/prisma.ts` singleton

## Step 3 · Authentication Layer
- [ ] Create `src/lib/auth.ts` — Auth.js v5 config
  - `CredentialsProvider`: accept `pinCode`, look up User, verify bcrypt hash
  - JWT callbacks: inject `id`, `role` into token & session
- [ ] Create `src/lib/auth.config.ts` — edge-safe config (no Prisma import)
- [ ] Create `src/middleware.ts`:
  - Protect `/(dashboard)/*` routes
  - Role-based redirect matrix
- [ ] Create `src/app/(auth)/login/page.tsx` — PIN pad UI

## Step 4 · Shared Layout & Components
- [ ] Install Shadcn primitives: `button`, `card`, `badge`, `dialog`, `input`, `label`, `select`, `tabs`, `toast`, `sonner`
- [ ] Build `src/app/(dashboard)/layout.tsx` — sidebar + role-gated nav
- [ ] Build `src/components/shared/sidebar.tsx`
- [ ] Build `src/components/shared/page-header.tsx`
- [ ] Build `src/components/shared/connection-toast.tsx` + `useConnectionStatus` hook

## Step 5 · POS Module — Table Grid
- [ ] `src/server/queries/table.queries.ts` — `getAllTables()`
- [ ] `src/server/actions/table.actions.ts` — `updateTableStatus()`
- [ ] `src/app/(dashboard)/pos/page.tsx` — grid of color-coded table tiles
- [ ] `src/components/pos/table-grid.tsx` — Green/Red/Yellow status colors

## Step 6 · POS Module — Cart & Order Builder
- [ ] `src/stores/cart-store.ts` — Zustand store (add/remove/qty/notes/reset)
- [ ] `src/lib/pricing.ts` — `calcEffectivePrice(item, promos)`
- [ ] `src/server/queries/menu.queries.ts` — `getMenuByCategory()`
- [ ] `src/server/queries/promotion.queries.ts` — `getActivePromotions()`
- [ ] `src/app/(dashboard)/pos/[tableId]/page.tsx` — menu browser + cart
- [ ] `src/components/pos/category-tabs.tsx`
- [ ] `src/components/pos/cart-panel.tsx` — with promo pricing display
- [ ] `src/server/actions/order.actions.ts` — `fireOrder()` Server Action
  - Transactional: create Order + OrderItems (frozenPrice), set Table → OCCUPIED

## Step 7 · KDS Module
- [ ] `src/app/api/kds/active/route.ts` — GET handler
  - Query: `Order.status = OPEN`, include `OrderItem.status = PENDING`, order by `createdAt ASC`
- [ ] `src/hooks/use-kds-orders.ts` — SWR wrapper (`refreshInterval: 5000`)
- [ ] `src/app/(dashboard)/kds/page.tsx` — full-screen card grid
- [ ] `src/components/kds/kds-card.tsx` — aging border logic (green/yellow/red + pulse)
- [ ] `src/components/kds/bump-button.tsx` — mark item READY
- [ ] `src/server/actions/order.actions.ts` — `bumpItem(itemId)` Server Action

## Step 8 · Payment Flow
- [ ] Add "Print Bill" action → set Table status → `BILL_PRINTED`
- [ ] `src/server/actions/order.actions.ts` — `recordPayment()`:
  - Set `Order.paymentMethod`, `Order.status → PAID`
  - Set `Table.status → VACANT`, clear `Table.currentOrderId`
- [ ] Payment dialog on POS: select CASH or CARD_EXTERNAL → confirm

## Step 9 · Admin — Menu Manager
- [ ] `src/app/(dashboard)/admin/menu/page.tsx`
- [ ] `src/components/admin/menu-item-form.tsx` (React Hook Form + Zod)
- [ ] `src/server/actions/menu.actions.ts`:
  - `createMenuItem()`, `updateMenuItem()`, `deleteMenuItem()`
  - `toggleAvailability()` — 86 toggle
- [ ] Category management (create/reorder)

## Step 10 · Admin — Promotions
- [ ] `src/app/(dashboard)/admin/promotions/page.tsx`
- [ ] `src/components/admin/promo-form.tsx` (RHF + Zod)
- [ ] `src/server/actions/promotion.actions.ts`:
  - `createPromotion()`, `updatePromotion()`, `togglePromotion()`
  - Scope: target a single MenuItem or an entire Category

## Step 11 · Admin — Analytics
- [ ] `src/app/(dashboard)/admin/analytics/page.tsx`
- [ ] `src/server/queries/analytics.queries.ts`:
  - Gross sales (sum of `Order.total` where PAID)
  - Order count, average ticket
  - Hourly breakdown buckets
  - Top-selling items
- [ ] Date range picker (today / 7d / 30d / custom)
- [ ] Export CSV (client-side Blob)

## Step 12 · Polish & QA
- [ ] Responsive audit on tablet viewport (768px–1024px)
- [ ] Touch target audit (min 48px)
- [ ] Dark mode consistency pass
- [ ] Error boundaries on all routes
- [ ] Loading skeletons for async pages
- [ ] `Void Order` flow with confirmation dialog

## Step 13 · MVP Deployment
- [ ] Configure production `DATABASE_URL` (e.g. Neon / Supabase Postgres)
- [ ] Set `AUTH_SECRET` in production env
- [ ] `npx prisma migrate deploy`
- [ ] Deploy to Vercel (or self-host)
- [ ] Smoke test all modules in production

---

## Verification Plan

### Automated
| What | Command / Method |
|:-----|:-----------------|
| Prisma schema validity | `npx prisma validate` |
| Migration runs clean | `npx prisma migrate dev --name init` (no errors) |
| TypeScript strict build | `npm run build` (zero errors) |
| Seed data loads | `npx prisma db seed` (exits 0) |

### Manual / Browser Testing
| Module | Test |
|:-------|:-----|
| **Auth** | Enter valid PIN → dashboard. Enter wrong PIN → error. Role redirect works. |
| **POS Grid** | Tables show correct colors. Click table → order builder. |
| **POS Cart** | Add items, change qty, see promo discount, fire order → table turns red. |
| **KDS** | Fired order appears within 5 s. Aging colors change over time. Bump clears item. |
| **Payment** | Print bill → yellow. Record cash → table green, order PAID. |
| **Menu Admin** | CRUD item. Toggle 86 → item hidden on POS. |
| **Promo Admin** | Create 15% promo → discount shows in cart. Deactivate → discount gone. |
| **Analytics** | Sales total matches sum of paid orders. CSV downloads. |
| **Offline** | Disable network → toast appears. Re-enable → toast clears, KDS resumes. |
