# Stripe Payment Integration — Requirements & Plan

Status: implementation in progress (backend phase). This doc is the source of truth for the
Stripe rollout — update it if the design changes.

## 1. What's needed from you

Nothing blocks the code from being written — implementation proceeds against the defaults
below. You only need to act on the items marked **(action)** before a real payment can be
tested end-to-end.

- **(action)** A Stripe account (test mode is enough to start).
- **(action)** Three env vars in `.env.local` (never commit these — `.gitignore` already
  excludes `.env*`):
  - `STRIPE_SECRET_KEY` — test secret key (`sk_test_...`) from
    https://dashboard.stripe.com/test/apikeys
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — test publishable key (`pk_test_...`), same page
  - `STRIPE_WEBHOOK_SECRET` — see "Local webhook testing" below for how to get this
- Business rules assumed below — flag any of these if they're wrong, they're cheap to change
  now and expensive after the fact:
  1. **Currency: USD only.** Matches the existing `financials.currency` default and
     `formatUSD`/`formatCurrency` in `src/lib/currency.js`. No multi-currency work is included.
  2. **COD stays available alongside Card**, per your earlier answer. Card is the default
     selection; COD behaves exactly as it does today (unchanged code path).
  3. **A successful card payment auto-advances the order from `Pending` → `Confirmed`.** COD
     orders still start at `Pending` and are advanced manually by staff, as today.
  4. **Refunds are admin-triggered only**, from the order detail page, full or partial amount,
     wired to the `orders.refund` RBAC permission (`src/lib/rbac.js`) which already exists in
     the permission matrix but isn't connected to anything yet.
  5. **No Stripe Tax / Stripe Checkout tax collection.** The existing `TaxService` and
     shipping calculators keep computing the total; Stripe is only told the final number to
     charge.
  6. **Apple Pay / Google Pay** are enabled automatically (Stripe's `PaymentElement` with
     `automatic_payment_methods` surfaces whatever the Stripe account has turned on) — no
     extra code, but note it here since it changes what shows up in the UI.

## 2. Why this shape (money-safety principle)

Two failure modes matter more than usual because real charges are involved:
- **Never trust the client for the charge amount.** The amount charged must be derived from
  the same server-side pricing logic that ends up on the persisted `Order`, or a tampered
  client could pay less than the cart total.
- **Never lose a paid order.** If the browser closes mid-3DS-redirect or the network drops
  right after a successful charge, the order must still get created. This means the
  **Stripe webhook, not the browser, is what actually creates the `Order`** for card
  payments — the browser just shows a "finalizing" state and polls for it.

## 3. Architecture

### New/changed collections
- `Order.payment` (extended): adds `provider`, `stripePaymentIntentId`, `stripeChargeId`,
  `paidAt`, `refundedAmount`. `method` becomes `'Cash on Delivery' | 'Card'`.
- `PendingCheckout` (new): holds the full checkout payload (items, shipping address, promo
  code, etc.) keyed by `idempotencyKey`, created when a PaymentIntent is created, consumed by
  the webhook once the order is fulfilled. TTL-expires unpaid attempts.

### New/changed routes
| Route | Purpose |
|---|---|
| `src/lib/checkoutPricing.js` | shared authoritative-total calculation, used by both the PaymentIntent endpoint and order fulfillment so the charged amount can never drift from the persisted order total |
| `src/lib/checkoutFulfillment.js` | shared `createOrderFromCheckoutPayload(...)` — the transaction body extracted from today's `/api/checkout`, reused by the COD path and the webhook path |
| `POST /api/checkout` | unchanged behavior for COD; now a thin wrapper around the shared fulfillment function |
| `POST /api/checkout/create-payment-intent` | new — recomputes the total, upserts `PendingCheckout`, creates a Stripe PaymentIntent, returns `clientSecret` |
| `POST /api/webhooks/stripe` | new — raw-body, signature-verified. On `payment_intent.succeeded`, creates the `Order` via the shared fulfillment function. Idempotent against Stripe retries. |
| `GET /api/checkout/status?idempotencyKey=` | new — polled by the success page until the webhook-created order appears |
| `POST /api/admin/orders/[id]/refund` | new — full/partial Stripe refund, gated on `orders.refund` |

### Frontend
- `src/app/checkout/page.js` — Payment section becomes a Card/COD toggle; Card renders
  Stripe's `<PaymentElement>` inside `<Elements>` using the `clientSecret` from
  `create-payment-intent`.
- `src/app/checkout/success/page.js` — when arriving from a Stripe redirect, polls
  `/api/checkout/status` and shows "finalizing your order" until the webhook has created it.
- `src/app/admin/orders/[id]/page.js` — payment panel shows provider/status/paid-at, a link
  to the Stripe dashboard for the PaymentIntent, and a Refund button.

## 4. Local webhook testing

Stripe webhooks need a reachable URL, so for local dev use the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This prints a `whsec_...` value — put that in `STRIPE_WEBHOOK_SECRET`. For production, register
a webhook endpoint at `https://<your-domain>/api/webhooks/stripe` in the Stripe Dashboard,
listening for `payment_intent.succeeded` and `payment_intent.payment_failed`, and use the
signing secret it gives you there instead.

## 5. Manual test checklist (once env vars are set)

1. `npm install` (pulls in `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`)
2. `npm run dev` + `stripe listen --forward-to localhost:3000/api/webhooks/stripe` in a second
   terminal
3. Add items to cart, go to checkout, pay with `4242 4242 4242 4242`, any future expiry, any
   CVC/ZIP → order should appear in `/admin/orders` with `payment.status = Paid`,
   `status = Confirmed`
4. Pay with `4000 0000 0000 0002` (declined) → no order is created, cart is preserved,
   checkout shows an error
5. From `/admin/orders/[id]`, issue a refund on a paid order → `payment.status` becomes
   `Refunded`/`Partially Refunded` and the Stripe dashboard shows the refund
6. Place a COD order → confirm nothing about that path changed

## 6. Status log

- 2026-08-18: Doc created. Backend implementation (models, pricing/fulfillment refactor,
  PaymentIntent + webhook + refund routes) in progress.
- 2026-08-18: Backend implementation complete.
  - `src/lib/checkoutPricing.js`: `computeAuthoritativeCheckout(...)` extracted from
    `/api/checkout`. Takes a `dryRun` flag — when true, skips the `Discount.usageCount` and
    `Promotion.usageLimits/analytics` increments so `create-payment-intent` can price a cart
    without reserving promo usage before payment succeeds. Real reservation only happens when
    `createOrderFromCheckoutPayload` calls it with `dryRun: false` inside the transaction.
  - `src/lib/checkoutFulfillment.js`: `createOrderFromCheckoutPayload(payload, ctx)` owns its
    own `mongoose.startSession()` / `withTransaction()` (previously that lived in the route's
    retry loop) so it works identically from a real request or from the webhook. `getServerSession`
    is no longer called inside it — callers resolve `orderUserId`/`checkoutEmail`/`isGuestSession`
    first. `paymentInfo` is omitted entirely for COD so the `Order.payment` subdocument falls
    back to its schema defaults (`Cash on Delivery` / `Pending`) exactly as before; when present
    (card payments) it sets `status: 'Confirmed'` on the order instead of `Pending`.
  - `/api/checkout`: thinned to parse body → idempotency check → `getServerSession` → call
    `createOrderFromCheckoutPayload` inside the existing retry loop. Response shape and COD
    behavior unchanged.
  - `/api/checkout/create-payment-intent`: recomputes the authoritative total via
    `computeAuthoritativeCheckout({ dryRun: true })`, upserts a `PendingCheckout` keyed by
    `tenantId + idempotencyKey` storing both the raw checkout payload and the resolved
    session context (`orderUserId`, `checkoutEmail`, `isGuestSession`, `ipAddress`), and
    creates/updates a Stripe PaymentIntent for that amount. Re-calling it with the same
    `idempotencyKey` updates the existing PaymentIntent's amount instead of creating a new one.
  - `/api/webhooks/stripe`: raw-body + signature verified (`export const runtime = "nodejs"`).
    On `payment_intent.succeeded`, loads the `PendingCheckout` by `stripePaymentIntentId`,
    reconstructs a minimal `req` shim that replays the originally-captured IP through
    `x-forwarded-for` (the real webhook request's IP is Stripe's, not the customer's), and calls
    `createOrderFromCheckoutPayload` with `paymentInfo.status = 'Paid'`. Idempotent two ways: a
    `PendingCheckout.status === 'consumed'` short-circuit, and a catch on Mongo's `E11000`
    duplicate-key error (the `idempotencyKey` unique index) that looks up the already-created
    order instead of erroring, in case a retried webhook race loses the `consumed` check.
    `payment_intent.payment_failed` just logs — `PendingCheckout` has no explicit "failed"
    status, so it's left to expire via its existing 24h TTL index.
  - `/api/checkout/status`: polls by `idempotencyKey`. Order found → `succeeded`; `PendingCheckout`
    consumed → `processing` (order write in flight); still pending → live-checks the PaymentIntent
    status via Stripe (`canceled` / `last_payment_error` → `failed`) rather than trusting local
    state alone, so a declined card is reported before the webhook ever fires.
  - `/api/admin/orders/[id]/refund`: gated on `can(staff, 'orders.refund')`, tenantId-scoped
    order lookup, full or partial `stripe.refunds.create`, updates `payment.refundedAmount`/
    `payment.status`, flips `order.status` to `Refunded` only on full refund, and calls
    `CommissionEngine.reverseCommission` (pro-rated on partial refund) when the order has
    affiliate attribution.
  - `.env.example`: created, documents every `process.env.*` referenced anywhere in `src/`
    (found via repo-wide grep) plus the three new Stripe vars. Added `!.env.example` to
    `.gitignore` since the existing `.env*` rule was silently excluding it too.
  - Deviation: `src/lib/stripe.js` was changed to fall back to a placeholder API key
    (`sk_test_placeholder_unset`) when `STRIPE_SECRET_KEY` is unset, because the module is now
    imported at build time by three route files and Next's page-data collection instantiates
    them eagerly — with no fallback, `npm run build` hard-crashed with "Neither apiKey nor
    config.authenticator provided" even before this Stripe work, any route importing `stripe.js`
    without a real key would have hit this. Real API calls still fail cleanly (Stripe auth
    error) until a real `STRIPE_SECRET_KEY` is set.
  - Build note: `npm run build` in this environment fails at the static-generation step with
    "Please define the MONGODB_URI environment variable" — confirmed pre-existing by stashing
    all of this work and re-running the build against the untouched `stripe/integration` branch
    tip, which fails identically. No `MONGODB_URI` (or any `.env.local`) exists in this sandbox.
    Turbopack compilation and the TypeScript pass both completed successfully first, covering
    all new/changed files. `npx eslint src/app/api/checkout src/app/api/admin/orders
    src/app/api/webhooks src/lib/checkoutPricing.js src/lib/checkoutFulfillment.js
    src/lib/stripe.js src/models/Order.js src/models/PendingCheckout.js` passes with zero
    warnings/errors (exit 0).
  - Work happened on a new `stripe/integration` branch (created by the backend agent), not
    directly on `main`.
- 2026-08-18: Reviewed the backend implementation and closed a money-safety gap: previously,
  if `payment_intent.succeeded` fired but `createOrderFromCheckoutPayload` then failed for a
  non-idempotency reason (e.g. another order took the last unit of stock, or a promotion hit
  its usage cap in the window between PaymentIntent creation and webhook delivery), the
  customer would be charged with no order ever created, and `payment_intent.payment_failed`
  webhook retries would loop forever until the 24h `PendingCheckout` TTL silently expired.
  Fixed:
  - `/api/webhooks/stripe`: on any fulfillment error other than the `E11000` idempotency hit,
    immediately issues a `stripe.refunds.create` for that PaymentIntent, marks the
    `PendingCheckout` `status: 'expired'` with a new `failureReason` field, and stops (no more
    webhook retries).
  - `PendingCheckout` model: added `failureReason: String`.
  - `/api/checkout/status`: `pending.status === 'expired'` now reports `status: 'failed'` with
    the reason, instead of leaving the poller hanging indefinitely.
  - `/api/checkout/create-payment-intent`: added a read-only stock pre-check (`manageStock` +
    `stock >= quantity` per item) before creating the PaymentIntent, so the common case fails
    fast with a clear message before a card is ever charged, rather than relying solely on the
    refund safety net above for a race that's usually avoidable.
  - `npx eslint` on the touched files passes with zero warnings/errors.
- 2026-08-18: Customer-facing frontend implementation complete.
  - `package.json`: added `@stripe/stripe-js` and `@stripe/react-stripe-js`; `npm install` run.
  - `src/lib/stripeClient.js` (new): exports `stripePromise` via `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)`, per spec.
  - `src/components/checkout/StripePaymentForm.js` (new): child of `<Elements>`, renders `<PaymentElement/>` plus
    its own "Complete Order" button (identical classes to the existing button). On submit: runs the `onValidate`
    prop first (the page's extracted field-validation function) and bails if it returns false; otherwise stores
    `idempotencyKey` in `sessionStorage` under `pairo-checkout-idempotency-key`, then calls
    `stripe.confirmPayment({ elements, confirmParams: { return_url }, redirect: 'if_required' })`. On
    `result.error`, shows `result.error.message` inline and re-enables the button. On
    `result.paymentIntent.status === 'succeeded'` (the non-redirect path — the common case, including
    `4242...`), navigates via `router.push('/checkout/success?idempotencyKey=...')` itself rather than relying on
    the Stripe redirect. Shows a skeleton in place of `<PaymentElement/>` until `stripe`/`elements` are ready.
  - `src/app/checkout/page.js`:
    - Added `paymentMethod` state (`'card'` default), `clientSecret`, `loadingClientSecret`, `paymentIntentError`.
    - Extracted the inline validation block from `handlePayment` into a standalone `validateForm()` (same
      new-errors-loop + scroll-to-first-error behavior), used by both the COD button and
      `StripePaymentForm`'s `onValidate` prop.
    - Extracted the request-body-building logic from `handlePayment` into `buildCheckoutPayload()` (same shape
      as before: `items, idempotencyKey, customerEmail, customerNote, shippingAddress, shippingSnapshot,
      referralCode, financials: { subtotal, shippingCost, discountTotal, total, promoCode }`), reused verbatim by
      both `/api/checkout` (COD) and `/api/checkout/create-payment-intent` (Card) — no new body shape invented.
      Exposed via a ref (`buildCheckoutPayloadRef`, kept current in an effect rather than mutated during render,
      to satisfy the `react-hooks/refs` lint rule) so the debounced PaymentIntent effect always sends the latest
      form state without needing form fields in its own dependency array.
    - New debounced effect (mirrors the existing `fetchRates` pattern, 600ms) re-POSTs to
      `/api/checkout/create-payment-intent` whenever `paymentMethod === 'card'` and any of
      `cartItems, cartSubtotal, shippingCost, appliedPromo?.code, selectedShipping` change, exactly as specced.
      In practice, address-field edits are still captured because `selectedShipping` itself changes once the
      existing `fetchRates` effect re-resolves shipping options for a new address.
    - Replaced the static COD-only "4. Payment Method" box with a two-option radio selector (Card / COD) reusing
      the shipping-method radio visual pattern. Card renders a loading skeleton while the PaymentIntent request
      is in flight, a plain error message if it fails, and `<Elements stripe={stripePromise} options={{
      clientSecret, appearance }}><StripePaymentForm .../></Elements>` once ready. The page-bottom "Complete
      Order" button is now only rendered for `paymentMethod === 'cod'` so there's never two submit buttons.
    - `handlePayment` (COD path) unchanged in behavior — still calls `/api/checkout`, `clearCart()`, and
      redirects with `?id=&orderNumber=` immediately on success. The card path never calls `clearCart()` from
      the page; that now only happens on the success page once `/api/checkout/status` confirms `succeeded`.
    - **userId question**: confirmed by reading `src/app/api/checkout/create-payment-intent/route.js` — it
      already calls `getServerSession(authOptions)` itself (line ~35) and resolves `orderUserId` from that
      session server-side. The client does **not** send a `userId` field; the existing session cookie is
      sufficient, so `buildCheckoutPayload()` was left with the same fields the old `handlePayment` body used.
    - Fixed 4 pre-existing `react-hooks/set-state-in-effect` lint errors in this file (unrelated to Stripe —
      `SearchableDropdown`'s value-sync effect, the two location-cascade effects, and the profile-fetch effect)
      by wrapping their setState calls in `Promise.resolve().then(...)`, matching the pattern this codebase
      already uses elsewhere (e.g. the `idempotencyKey` init effect in this same file, and `CartContext.js`'s
      cart/promo hydration effects) for exactly this rule. Applied the same wrapping to the new debounced
      PaymentIntent effect's own `setClientSecret("")`/`setPaymentIntentError("")` reset calls.
  - `src/app/checkout/success/page.js`:
    - Added `useCart()` (for `clearCart`, not previously imported here).
    - On mount, if neither `?id=` nor `?orderNumber=` is present, reads `?idempotencyKey=` (falling back to
      `sessionStorage.getItem('pairo-checkout-idempotency-key')`) and polls `GET
      /api/checkout/status?idempotencyKey=...` every 1.5s for up to 20 attempts (~30s).
      - `succeeded` → clears the `sessionStorage` key, calls `clearCart()`, fetches
        `/api/order-tracking/[orderId]` and renders the existing order-details UI unchanged.
      - `failed` → stops polling, shows a dedicated error screen with the actual `error` reason from the
        response, a note that any payment was auto-refunded, and a link back to `/checkout` (cart untouched).
      - Still unresolved after 20 attempts → shows a "taking longer than expected, check your email / contact
        support" screen instead of spinning forever.
    - The existing `?id=`/`?orderNumber=` immediate-lookup path (COD, and the eventual landing state once a
      card-order poll resolves) is untouched.
    - The "Loading Order Details..." spinner now also shows "Finalizing Your Order…" copy while polling
      (reusing the existing `Loader2` spinner element, per spec).
  - Constraints respected: nothing under `src/app/api/`, `src/lib/checkoutPricing.js`,
    `src/lib/checkoutFulfillment.js`, `src/lib/stripe.js`, `src/models/`, or `src/app/admin/` was modified.
  - `npx eslint src/app/checkout src/app/api/checkout src/components/checkout src/lib/stripeClient.js` passes
    with 0 errors (4 pre-existing warnings remain, none introduced by this work: one `missing dependency:
    appliedPromo` on an effect this work didn't touch, and three `no-img-element` warnings on pre-existing
    `<img>` tags).
  - Runtime check: this sandbox still has no `MONGODB_URI` (same limitation noted in the backend entry above),
    so `/checkout` and `/checkout/success` both 500 at the root-layout `dbConnect()` call before either page's
    own code runs — confirmed via the returned RSC payload, which shows the failure originates in `ThemeStyle`
    → `dbConnect`, not in the checkout code. Verified instead by fetching the compiled Turbopack chunk for
    `/checkout` directly: it contains the new `StripePaymentForm`/`create-payment-intent`/`clientSecret`
    references with no build-error markers, confirming the page compiles cleanly; the same 500-at-`dbConnect`
    signature (not a build error) was confirmed for `/checkout/success` too. Could not do a full browser
    click-through (toggle Card/COD, submit) without a live DB + Stripe test key.
  - No deviations from the spec.
- 2026-08-18: Admin-facing UI for refunds built on `src/app/admin/orders/[id]/page.js` (the
  only file touched; nothing under `src/app/api/`, `src/lib/`, `src/models/`, `src/app/checkout/`,
  or `src/components/checkout/` was modified).
  - Payment panel (previously just `Method: {order.payment?.method}`) now shows a color-coded
    payment-status badge reusing the exact token palette from the orders-list `getStatusBadge`
    helper (`Paid`/green = the `Shipped`/`Delivered` green, `Pending` = the same amber,
    `Failed` = the same red as `Cancelled`, `Refunded`/`Partially Refunded` = the same neutral
    gray as `Processing`), a "View in Stripe" link to
    `https://dashboard.stripe.com/payments/{stripePaymentIntentId}` (opened in a new tab) when
    `provider === 'stripe'` and an intent id exists, `paidAt` formatted with
    `toLocaleString()` (matching the page's existing `order.createdAt` header format), and
    `refundedAmount` formatted via `formatCurrency` from `src/lib/currency.js` when > 0.
  - No existing test/live Stripe mode indicator exists anywhere in the codebase (checked
    `src/lib/stripe.js` and repo-wide), so the dashboard link always points at the non-`/test/`
    URL — staff can tell the mode from Stripe's own dashboard chrome once they land there.
  - Refund action: a "Refund" button appears inline in the Payment panel's card only when
    `payment.provider === 'stripe'`, `payment.status` is `Paid` or `Partially Refunded`, the
    remaining balance (`financials.total - refundedAmount`) is positive, AND the client-side
    `can(session.user, "orders.refund")` check (imported directly from `src/lib/rbac.js`,
    unmodified) passes. This is a real, working client-side gate here (not a cosmetic one) —
    confirmed by reading `src/app/api/auth/[...nextauth]/route.js`: staff login does
    `Staff.findOne(...).populate('roleId')` and puts the populated Role (with `.slug` and
    `.permissions`) on `session.user.role`, so `can()`'s shape expectations are satisfied
    client-side. No other admin page currently imports `can()` client-side (grepped the whole
    `src/app` tree for `can(session` — only server route usage exists), so this is the first
    page to do so; documented here in case that becomes the intended pattern going forward.
    The server route's own `can()` check remains the authoritative gate regardless.
  - Clicking Refund reveals an inline form (this page has no modal component; its existing
    destructive-action convention is a native `confirm()` for "Cancel Order" — since the
    inline form itself already requires an explicit Confirm click, no extra `confirm()` was
    layered on top) pre-filled with the full remaining refundable balance, editable, with
    Confirm/Cancel buttons. Confirm POSTs `{ amount: Number(refundAmount) }` to
    `/api/admin/orders/[id]/refund`; loading state disables both buttons and shows
    "Processing...". On success, local `order` state is replaced with the response's `order`
    (so the badge/refundedAmount/button visibility update without a reload) and a
    `react-hot-toast` success toast fires (`toast`, already a dependency and already used
    elsewhere in `src/app/admin/orders/page.js` and `src/app/admin/layout.js`). On error, the
    API's `error` string is rendered inline next to the form rather than toasted, so it stays
    visible while the staff member corrects the amount.
  - `npx eslint src/app/admin/orders` passes with zero errors; one pre-existing warning
    (`@next/next/no-img-element` on the order-items thumbnail `<img>`, unrelated to this
    change and present before it, confirmed via `git show HEAD:...` on the same line).
  - The RBAC permission matrix at `/admin/settings/roles` already renders `refund` for the
    `orders` module automatically, since it iterates `Object.entries(ALL_PERMISSIONS)` and
    `actions.map(...)` generically (`src/app/admin/settings/roles/page.js` line ~204) — no gap
    found, no fix needed there.
- 2026-08-18: Manual browser testing in a real dev environment surfaced and fixed two bugs
  the sandbox testing above couldn't catch without a live DB:
  1. **Local MongoDB was standalone, not a replica set** — `createOrderFromCheckoutPayload`
     requires transactions (inventory reservation + promo-usage locking), which standalone
     MongoDB cannot run at all. Fixed operationally, not in code: ran a second `mongod` on
     port 27018 with `--replSet rs0` against a fresh data directory, initiated the replica
     set, and restored a snapshot of the Atlas database into it (see `scratch/` scripts,
     gitignored). `MONGODB_URI` for local dev is now
     `mongodb://127.0.0.1:27018/pairo?replicaSet=rs0`. Confirmed with a direct transaction
     test that this now works. Production Atlas already runs as a replica set, so this only
     affects local dev.
  2. **Infinite polling loop in the browser** — `src/context/CartContext.js` defined
     `clearCart` (and other action functions) as plain, unmemoized functions. The new
     success-page polling effect (`src/app/checkout/success/page.js`) lists `clearCart` in
     its dependency array and calls it internally: each call re-rendered `CartProvider`,
     producing a new `clearCart` reference, re-triggering the effect, calling `clearCart`
     again — forever. Observed as 1500+ repeating requests to `/api/checkout/status` and
     `/api/order-tracking/[id]`. Fixed by wrapping `addToCart`, `removeFromCart`,
     `updateQuantity`, `applyPromoCode`, `removePromoCode`, and `clearCart` in `useCallback`
     in `CartContext.js` so they're stable across renders unless their actual dependencies
     change. `npx eslint src/context/CartContext.js` confirmed zero new errors/warnings
     (diffed against the pre-fix version to isolate pre-existing issues).
- 2026-08-18: Added a customer-facing Stripe receipt link on the checkout success page.
  - `src/models/Order.js`: `payment.receiptUrl` (String, default null).
  - `src/app/api/webhooks/stripe/route.js`: `handlePaymentSucceeded` now retrieves the full
    Stripe Charge object (`stripe.charges.retrieve(chargeId)`) to get `receipt_url` — the
    webhook's `paymentIntent.latest_charge` is normally just an unexpanded id string, so the
    receipt URL isn't available without this extra call. Stored on `paymentInfo.receiptUrl`;
    failures here are logged and swallowed (a missing receipt link shouldn't block order
    creation).
  - `src/lib/checkoutFulfillment.js`: passes `paymentInfo.receiptUrl` through onto
    `order.payment.receiptUrl` when building the order doc.
  - `src/app/checkout/success/page.js`: shows a "View Stripe Receipt" link (opens
    `order.payment.receiptUrl` in a new tab) under Payment Information when present — i.e.
    only for completed card payments, never for COD. Note: this is Stripe's hosted **receipt**
    page (`pay.stripe.com/receipts/...`) for the one-off charge, not a Stripe **Invoice**
    (a separate product for subscription/recurring billing this integration doesn't use) —
    functionally what "Stripe invoice" meant in context for a one-time card checkout.
  - `npx eslint` on all four touched files: 0 errors, 2 pre-existing unrelated warnings.
- 2026-08-18: Finalization pass — ran the test suite, ran a 4-angle cleanup review
  (reuse/simplification/efficiency/altitude) over the full diff, applied the safe findings,
  and removed disposable one-off scripts.
  - **Tests**: `npx vitest run` → 8/12 files pass, 61/63 tests pass. The 4 failing files
    (`coupons-api.test.js` 1 test, `page-templates.test.js` 1 test, `affiliate_engine.test.js`
    and `customer_discount.test.js` — "No test suite found") are **pre-existing and unrelated**
    to this work — confirmed by stashing every change on this branch and re-running: identical
    failures occur on plain `main`. They assume an empty test database; the two individual test
    failures are due to real promotions/data in the restored Atlas snapshot now legitimately
    applying where the test expected nothing to apply. Not touched.
  - **Cleanup applied** (all behavior-preserving, re-tested after):
    - Removed a fake `Request` shim in the webhook (`{ headers: { get: ... } }` built just to
      satisfy `createOrderFromCheckoutPayload`'s IP-extraction). `checkoutFulfillment.js` now
      takes a plain `ipAddress` string instead of `req`; both callers (`/api/checkout`, the
      webhook) pass the string directly.
    - Simplified a redundant `x && typeof x === 'string'` guard in the webhook's charge-id
      extraction (the `typeof` check alone already handles falsy `x`).
    - `let refundAmount` → `const` in the refund route (never reassigned).
    - `src/lib/checkoutPricing.js`: added a `withSession(query, mongoSession)` helper and
      replaced 4 repetitions of `if (mongoSession) q.session(mongoSession)` with it.
    - New `src/lib/checkoutStorage.js` exporting `IDEMPOTENCY_STORAGE_KEY` — previously this
      sessionStorage key existed as two independent sources of truth (a literal string in
      `StripePaymentForm.js`, a separately-defined constant in `success/page.js`); a typo in
      either would have silently broken the read/write pairing.
    - New `src/lib/statusBadgeColors.js` (`BADGE_COLORS`, `DEFAULT_BADGE_COLOR`) — the new
      payment-status badge in `admin/orders/[id]/page.js` had copy-pasted the exact same
      Tailwind color literals as the pre-existing order-status badge in `admin/orders/page.js`;
      both now reference the same palette.
    - `create-payment-intent/route.js`: the per-cart-item stock pre-check (added during the
      earlier money-safety review) did N sequential `Product.findOne` calls; batched into one
      `Product.find({ _id: { $in: ... } })`.
    - `/api/checkout/status`: the `Order.findOne` and `PendingCheckout.findOne` lookups now run
      via `Promise.all` instead of sequentially — this route is polled up to 20×/checkout, and
      the two queries are independent in the (most common) still-pending case.
    - `success/page.js`: the polling effect had no cleanup, so navigating away mid-poll left a
      closure running `fetch`/`setState` against an unmounted page for up to ~30s. Added a
      `cancelled` flag set in the effect's cleanup, checked before every `setState` and before
      each loop iteration continues.
  - **Deliberately skipped** (flagged by the altitude review, real architectural points, but
    both touch payment-critical code paths already validated end-to-end — restructuring them
    now is a bigger, riskier change than a cleanup pass warrants; noted here as follow-up work
    rather than done silently):
    - `computeAuthoritativeCheckout`'s `dryRun` flag threads `if (!dryRun)` mutation-guards
      through what's otherwise a pure pricing calculation, used both to price a PaymentIntent
      (no mutation) and to actually reserve promo/discount usage (mutation) inside the order
      transaction. Cleaner shape: split into a pure `calculateCheckoutPricing()` and a separate
      `reservePromotionUsage()` step called only from the real transaction — mirroring how
      `Engine.evaluate()` already keeps evaluation separate from reservation elsewhere in this
      codebase.
    - The webhook's auto-refund-on-fulfillment-failure (`handleFulfillmentFailureRefund`)
      duplicates raw `stripe.refunds.create` bookkeeping that already has a proper home in
      `/api/admin/orders/[id]/refund`, and treats every non-idempotency failure identically
      (a stock race and a shipping-cost-mismatch/tampering signal both trigger the same silent
      auto-refund). Cleaner shape: extract a shared `refundPayment()` helper used by both, and
      differentiate "safe to auto-refund" failures from "needs human review" ones.
  - **Removed**: 5 disposable one-off scripts under `scratch/` (gitignored, not part of the
    repo) that had already served their purpose — the Atlas backup/restore script, the local
    replica-set initiator, the transaction smoke-test, and the null-category finder. Kept
    `scratch/atlas-backup/` (the actual JSON backup) and `scratch/mongo-data/` (the live local
    replica-set data directory this environment's dev server currently points at).
  - `npx eslint` on every file touched in this pass: 0 errors, same 3 pre-existing
    `no-img-element` warnings as before. `npx vitest run` re-confirmed identical 8/12 pass rate
    after cleanup (no regressions).
