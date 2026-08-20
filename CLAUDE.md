# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pairo Lifestyle: a Next.js (App Router) e-commerce storefront + admin back-office for a custom-jacket/apparel brand, backed by MongoDB (Mongoose). It includes a customer storefront, an affiliate program, and a full admin CMS (drag-and-drop page builder, promotions engine, RBAC, shipping/tax, blogs, reviews, etc.).

## Important: this is not a stock Next.js version

`node_modules/next` is version 16.2.6 and includes bundled docs at `node_modules/next/dist/docs/` describing this version's actual API, which may differ from your training data (e.g. experimental `cacheComponents` / `unstable_instant` route segment config). Before writing App Router code that touches caching, prefetching, or route segment config, check the relevant doc under `node_modules/next/dist/docs/01-app/` rather than assuming stock Next.js behavior.

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # start production server
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals)
npx vitest run                        # run all tests
npx vitest run src/__tests__/promotion-engine.test.js   # run a single test file
npx vitest run -t "test name"         # run tests matching a name
```

There is no `test` npm script — invoke `vitest` directly. Tests are integration tests that connect to a **real MongoDB** (`MONGODB_URI` from `.env.local`, falling back to `mongodb://127.0.0.1:27017/pairo`) and create/teardown real documents — there is no mocked DB layer. A local or reachable MongoDB instance is required to run most of `src/__tests__/*.test.js`.

## Architecture

### Multi-role auth (single NextAuth config)
`src/app/api/auth/[...nextauth]/route.js` defines one Credentials provider that tries **Staff → Affiliate → Customer** (in that order, or a single type via `loginType`) against three separate Mongoose models. The JWT callback re-checks the account's status in the DB on every request (so suspending a Staff/Affiliate takes effect immediately, not just at next login), and stores `isStaff` / `isAffiliate` / `role` (populated `Role` doc with `permissions`) on the token/session.

`src/middleware.js` is the perimeter: it protects `/admin/:path*` and `/api/admin/:path*`, redirecting unauthenticated or non-staff users to `/admin-login`, and does coarse-grained route-level permission checks (customers, settings/team, settings/roles) before the page even renders. Fine-grained checks happen in `src/lib/rbac.js`'s `can(staff, "module.action")`, used inside admin pages/API routes. `super-admin` role always bypasses permission checks.

### Multi-tenant-shaped data model
Most collections (Product, Order, etc.) carry a `tenantId` field defaulting to `'DEFAULT_STORE'` and most queries filter on it, even though this deployment only runs a single store. Preserve the `tenantId` filter pattern when writing new queries rather than dropping it.

### CMS page builder (the biggest subsystem)
Pages are stored as documents (`src/models/Page.js`) made of an ordered list of `{ type, config }` sections. Three registries drive this:
- `src/lib/templates.js` — `TEMPLATE_REGISTRY`: per-template `allowedSections` and `defaultSections` (home, about, contact, custom-jacket, gallery, size-chart, default/generic page).
- `src/lib/section-registry.js` — `SECTION_REGISTRY`: maps a section `type` string to a `next/dynamic` React component.
- `src/lib/section-schemas.js` — editable field schemas per section type, used to render the admin builder UI (`src/app/admin/pages/[id]/builder`, `src/components/admin/builder`).

Rendering a page (`src/lib/page-cache.js` → `resolvePageAndTemplate`, `src/lib/page-data-resolver.js` → `resolvePageSections`) resolves each section's `config` against live data (e.g. `product_grid` resolves `productIds`/`collectionId` into real `Product` docs, respecting `isDeleted`/`status`/`tenantId`). `src/app/[slug]/page.js` is the catch-all route that serves any non-reserved top-level slug as a CMS page (after checking for a category-slug redirect and reserved routes in `src/lib/routes.js`'s `RESERVED_ROUTES` / `redirect-resolver.js`'s `RESERVED_SLUGS`). Adding a new section type requires updates in all three registries plus the corresponding component under `src/components/home` or `src/components/sections`.

### Promotion/discount engine
`src/lib/promotionEngine/` is a small rule pipeline: `Loader` → `ConditionEvaluator` → `ConflictResolver` → `ActionExecutor` → `Engine` (orchestrator), with `Validator`, `Debugger`, and `HistoryService` (writes `PromotionRevision`/`PromotionAuditLog`) alongside it. Admin promotion UI mirrors this structure under `src/components/admin/promotions/{RuleBuilder,ActionBuilder,History,Simulator}`.

### Affiliate program
`src/lib/affiliate/` holds `ClickQueue`, `CommissionEngine`, `rateLimiter`, and `encryption` (for sensitive affiliate data at rest). Affiliates are a distinct auth'd role (see auth section above) with their own dashboard (`src/app/affiliate/dashboard`) and API namespace (`src/app/api/affiliate/*`), separate from the admin-facing `src/app/api/admin/affiliates/*`.

### Shipping & tax
`src/services/shipping/` implements zone-based shipping: `ZoneMatcher` finds the matching `ShippingZone`, `MethodEligibility` filters `ShippingMethod`s, provider strategies (`FlatRateProvider`, `FreeShippingProvider`, `LocalPickupProvider`, registered in `ProviderRegistry`) compute rates via `RateCalculator`/`ShippingService`. `src/services/tax/TaxService.js` is the analogous tax calculator. Both read config seeded by admin UI (`src/app/admin/settings/shipping`, `src/app/admin/settings/tax`).

### Route layout conventions
- `src/app/api/**` mirrors `src/app/**` admin/affiliate/customer areas 1:1 — an admin UI page under `src/app/admin/X` almost always has a matching `src/app/api/admin/X` route.
- `src/app/[slug]/[productSlug]/` is the product detail route nested under a resolved category/collection slug; `src/app/product/[id]/` is a separate direct-by-id product route.
- `src/lib/*-server.js` files (`products-server.js`, `routes-server.js`) contain server-only data-fetching helpers, kept separate from their client-safe counterparts (`routes.js`).

## Notable non-obvious things

- `next.config.mjs` disables Next's image optimization (`images.unoptimized: true`) and allows all remote image hosts — do not assume `next/image` optimization is active.
- `db-export.json` at repo root is a large (~3.7MB) data dump, likely used by `src/scripts/seed-from-export.js`; treat it as a data fixture, not something to read wholesale.
- `fix_replica.sh` is a deployment/ops script for enabling MongoDB replica sets on the production host — it is not part of the app runtime.
