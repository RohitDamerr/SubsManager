# Brightloop — Subscription Management System

One platform to run a subscription business end to end: products and plans, quotations, subscriptions, automatic recurring invoices, discounts, taxes, payments and revenue reporting, with a customer self-service portal.

**Stack:** Node.js (ES modules) + Express + MongoDB (official driver, no ORM) on the API; React + Vite + React Router + TanStack Query on the client.

---

## Quick start

### 1. Prerequisites

- Node.js 20.6+ (the API loads `.env` with Node's built-in `--env-file`)
- MongoDB Community Server running locally on `mongodb://localhost:27017`

A plain standalone MongoDB is fine for development. Multi-document writes run inside transactions when MongoDB is a replica set; on a standalone server they run without one and the API logs a warning (see [Transactions](#transactions)).

### 2. Configure

Create `.env` in the **project root** (copy `server/.env.example`) and set at least:

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/brightloop
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=8h
CLIENT_ORIGIN=http://localhost:5173
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Leave the `SMTP_*` values empty in development: emails (password reset, invoices) go to an [Ethereal](https://ethereal.email) test inbox and the preview link is printed in the API log.

### 3. Install, seed, run

```bash
npm install            # root tooling (concurrently)
npm run install:all    # server + client dependencies
npm run seed           # demo users, taxes, products, plans, discounts, a template
npm run dev            # API on :4000 and client on :5173
```

Open http://localhost:5173.

### Demo accounts (created by `npm run seed`)

| Role     | Email                     | Password       |
|----------|---------------------------|----------------|
| Admin    | admin@brightloop.com      | `Admin@123`    |
| Staff    | staff@brightloop.com      | `Staff@123`    |
| Customer | customer@brightloop.com   | `Customer@123` |

In development the login page has one-click buttons that fill these in.

### Scripts

| Command (from root)        | What it does |
|----------------------------|--------------|
| `npm run dev`              | API (with `--watch`) and client together |
| `npm run dev:server`       | API only |
| `npm run dev:client`       | Client only |
| `npm run seed`             | Idempotent demo data |
| `npm run seed -- 10000`    | Demo data plus 10,000 bulk subscriptions for load testing |

---

## How it works

### Roles and access (RBAC)

There are three roles, stored on `users.role`. Customers sign up themselves; only an admin can create staff or admin accounts.

| Capability | Admin | Staff | Customer |
|---|---|---|---|
| Create staff accounts | ✓ | — | — |
| Products, variants, plans, taxes | Create / edit | Read | — |
| Product cost price and margin | ✓ | — | — |
| Discount rules | Create / edit | Read | — |
| Quotation templates | Create / edit | Create / edit | — |
| Subscriptions | All | All (create, move through states, renew) | Own only: read, pause, close (if the plan allows) |
| Invoices | All | All (confirm, cancel, send, print) | Own only, non-draft: read, print |
| Payments | All | Record and view | Own only |
| Dashboard and reports | ✓ | ✓ | — |
| Manual billing run | ✓ | — | — |

Access is enforced on the server, which is the source of truth:

- `authenticate` checks the JWT and loads the user, then `authorize(...roles)` checks the role on every route.
- Customer data is scoped inside the services. A customer's list queries are always filtered to their own customer id, and opening someone else's record returns 403.
- Staff never receive `costPrice` from the products API.

The client mirrors the same matrix in one file, `client/src/auth/roles.js`. The routes, the sidebar and the action buttons are all generated from it, so they always agree:

- After login, admin and staff land on `/dashboard` and customers on `/portal`.
- A signed-out visitor to a protected page is sent to `/login` and returned to that page after signing in, provided their role may open it.
- A signed-in user who opens `/login` or `/register` goes to their home page.
- A role that opens a page it may not use sees a 403 page.
- Logging out, or an expired token, clears the client cache so one user's data never shows for the next.

### A subscription's life

```
DRAFT → QUOTATION → CONFIRMED → ACTIVE ⇄ PAUSED → CLOSED
```

1. **Catalog.** The admin sets up taxes, products (sales price, cost price, notes, and variants such as "brand: Odoo +₹560"), and plans. A plan has a price, a billing period (daily, weekly, monthly or yearly), a minimum quantity, availability dates, and flags for auto-close, early close, pause and renew.
2. **Quotation template** (optional). A plan plus preset product lines, valid for N days.
3. **Create subscription.** Staff pick a customer and a plan, then either a template or individual product lines. The unit price (product price plus variant extra) and the tax rate are copied onto each line, so later catalog changes never rewrite history. The subscription gets a number like `SUB-000123`. A plan outside its availability dates cannot be used.
4. **Quotation.** Sending it starts the validity window from the template (default 30 days). An expired quotation cannot be confirmed; move it back to draft and send it again.
5. **Active.** Activation puts the subscription into billing from its start date. Pause takes it out of billing. Resume continues after the last billed period and skips the paused time.
6. **Renew** (if the plan allows). Extends the expiry by one more term of the same length. If billing had stopped at the old expiry, it resumes.
7. **Closed.** Closed manually (early close if the plan allows), or automatically by the nightly job when the term ends on an auto-close plan.

The subscription detail page shows this as a progress bar. Its action buttons come from the server's `allowedTransitions`, which takes into account the role, the plan flags and quotation expiry.

### Billing run

The billing run starts nightly at 02:00 (node-cron inside the API). An admin can also start it with **Run billing now** on the dashboard (`POST /billing/run`).

1. **Lock.** A document in `locks` with a TTL stops two runs from overlapping.
2. **Select due subscriptions.** It picks `status: ACTIVE, nextInvoiceDate <= today` in batches of 500, using a partial index, so nothing is scanned that isn't due. Using `<=` means a missed night is caught up and no period is skipped.
3. **Load discounts.** Active discounts are loaded **once** for the whole run.
4. **Build invoices in memory.** Each invoice gets the lines and a snapshot of the customer's name, email and billing address. Discounts are applied, then tax is calculated on the discounted amounts, then totals.
5. **Write each batch together.** It inserts the invoices, claims discount usage, and moves each subscription's `nextInvoiceDate` to the end of the billed period. Periods follow the calendar: monthly means the same day next month.
6. **No double billing.** A unique index on `(subscriptionId, periodStart)` for billable invoices prevents it, so running the job twice is safe. If a batch fails, its subscriptions are retried one at a time.
7. **End of term.** When a period would start on or after the expiry date, billing stops for that subscription.

Invoices start as **DRAFT**. Staff confirm them (`DRAFT → CONFIRMED`), and an invoice becomes **PAID** automatically when payments reach its total. Cancelling is allowed only if nothing has been paid. It releases the discount usage and lets the period be billed again.

### Discounts

Only the admin creates discount rules. A rule is **fixed** or **percent**, applies to **specific products** or to the **whole invoice**, and can have a minimum purchase, a minimum quantity, start and end dates, and a usage limit.

Nobody attaches a discount by hand. At invoice time the engine finds the rules that qualify:

1. Per line: the single best product discount.
2. Then: the single best whole-invoice discount, calculated on the subtotal after line discounts.
3. A fixed discount never takes a line below zero.
4. Tax is calculated after discounts.

Each use of a discount is claimed with one atomic update, so the last remaining use cannot be taken twice. Every use is recorded in `discountRedemptions`.

### Payments

Staff record a payment against a confirmed invoice with its method (cash, bank transfer, card, UPI, cheque), amount, date and a note. The update cannot push the amount paid above the invoice total, even if two people record a payment at the same time. The **Payments** page lists every payment with date and method filters and a total. Customers see the same page as **My Payments**, limited to their own payments.

### Reporting

The dashboard shows:

- Active subscriptions
- MRR (every subscription stores its monthly equivalent: yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12)
- Revenue received this month
- Amount outstanding
- Overdue count, plus the overdue list sorted by days late

A date filter drives the revenue total, the chart and a breakdown by payment method. "Overdue" is calculated when needed (confirmed invoices past their due date) rather than stored.

### Performance

List pages use keyset pagination, so page 500 loads as fast as page 1. Related names are joined only for the rows on the current page, or come from snapshots stored on the record. All indexes are created at startup in `server/db/ensureIndexes.js`. Every list and dashboard query uses an index.

---

## Project structure

```
.env                      # shared config (loaded by the API)
server/
  db/ensureIndexes.js     # every index, created at startup
  db/seed.js              # demo + bulk data
  src/
    app.js                # Express, middleware, route mounting
    server.js             # connect → indexes → container → scheduler → listen
    config/               # env, Mongo client, dependency container
    core/                 # BaseRepository, TransactionManager, StateMachine, Money, Pagination, BillingPeriod
    middleware/           # authenticate, authorize, validate (zod), errorHandler
    modules/<name>/       # Controller → Service → Repository per module:
                          # auth, catalog, tax, discount, template, subscription, invoice, billing, payment, report
client/
  src/
    api/                  # axios instance (JWT, 401 handling) + one module per resource
    auth/                 # AuthContext, route guards, roles.js (RBAC matrix)
    components/           # Layout, DataTable, StatusBadge, Modal, DateRange, LineEditor, BarChart…
    pages/                # public/, dashboard/, staff/, admin/, portal/, account/
```

Each backend module follows the same layering. Controllers only handle HTTP. Business rules live in services and small domain classes (state machines, the discount engine, the tax engine, the invoice builder). Repositories own the queries. Dependencies are wired once in `config/container.js`.

## API overview

All endpoints are under `/api/v1` and use JSON with a `Authorization: Bearer <token>` header. Lists accept `limit` and `cursor` and return `{ data, nextCursor }`.

Every list also takes `q` for search. Search text is always matched literally, never as a regex.

- **Subscriptions and invoices:** number prefix (`42`, `SUB-42`) or customer name or email
- **Payments:** invoice number or customer
- **Catalog and team lists:** name, and email for staff

In the UI, search text and filters are kept in the page URL (for example `/invoices?q=acme&status=CONFIRMED&from=2026-10-01`). A refresh or a shared link opens the same view.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`; `GET /auth/me` |
| Team | `GET/POST /users/staff` (admin); `GET /customers` (admin, staff) |
| Catalog | `/products` (+ `POST /products/:id/variants`), `/plans`, `/taxes`, `/discounts`, `/quotation-templates` |
| Subscriptions | `GET/POST /subscriptions`, `GET /subscriptions/:id`, `POST /subscriptions/:id/transition`, `POST /subscriptions/:id/renew` |
| Invoices | `GET /invoices` (`status`, `overdue`, `customerId`, `q`, `from`, `to`), `GET /invoices/:id`, `POST /invoices/:id/confirm, /cancel, /send`, `GET /invoices/:id/print` |
| Payments | `GET /payments` (`from`, `to`, `method`), `GET/POST /invoices/:id/payments` |
| Billing | `POST /billing/run` (admin) |
| Reports | `GET /reports/summary`, `/reports/revenue?from=&to=&groupBy=day\|month`, `/reports/overdue` |

Login, register and the password-reset endpoints are rate-limited (30 requests per 15 minutes). Every request body is validated with strict zod schemas, which reject unknown keys.

## Transactions

Writes that touch several collections (registration, billing batches, payments, invoice cancellation) go through `TransactionManager`. On a replica set they are atomic. On a standalone `mongod` the code runs the same steps without a transaction, which is fine for development. For production, run MongoDB as a replica set: a single node is enough.

```yaml
# mongod.cfg
replication:
  replSetName: rs0
```

Then run `rs.initiate()` once and use `MONGO_URI=mongodb://localhost:27017/brightloop?replicaSet=rs0`.
