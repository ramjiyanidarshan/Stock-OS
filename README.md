# ◈ StockOS — Inventory Management ERP

A production-grade Inventory ERP MVP built with **Node.js + Express + Knex (MySQL)** on the backend and **React.js** on the frontend. Designed to handle real-world warehouse complexity: batch & expiry tracking, FIFO deduction, unit conversion, immutable audit trails, departmental access control, and race-safe concurrent stock operations.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Database Schema](#database-schema)
3. [Setup & Installation](#setup--installation)
4. [Migration Guide](#migration-guide)
5. [Seeding Guide](#seeding-guide)
6. [Login Credentials](#login-credentials)
7. [API Reference](#api-reference)
8. [Core Modules](#core-modules)
9. [Senior-Level Technical Answers](#senior-level-technical-answers)
10. [Tech Stack](#tech-stack)

---

## Project Structure

```
stockos/
│
├── backend/
│   ├── .env.example                    ← Copy to .env and fill DB credentials
│   ├── migrate.js                      ← Standalone migration runner
│   ├── seed.js                         ← Standalone seeder with full demo data
│   ├── package.json
│   └── src/
│       ├── index.js                    ← Express app entry point
│       ├── config/
│       │   ├── db.js                   ← Knex connection config
│       │   └── knex.js                 ← Knex singleton
│       ├── middleware/
│       │   └── auth.js                 ← JWT verify + permission guard
│       ├── controllers/
│       │   ├── auth.controller.js      ← Login, /me
│       │   ├── inventory.controller.js ← Stock ops + dashboard
│       │   ├── products.controller.js  ← Products, categories, units
│       │   └── warehouse.controller.js ← Warehouses, locations, team
│       ├── routes/
│       │   └── index.js                ← All routes with permission guards
│       └── services/
│           └── inventory.service.js    ← FIFO, FOR UPDATE locks, unit conversion
│
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── index.js
        ├── index.css                   ← Global styles (dark industrial theme)
        ├── App.jsx                     ← Router + protected routes
        ├── context/AuthContext.jsx     ← JWT state + can() helper
        ├── services/api.js             ← Axios instance + all API calls
        ├── components/Layout.jsx       ← Sidebar navigation shell
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx       ← KPIs, charts, live alert table
            ├── InventoryPage.jsx       ← Stock by product/location/batch
            ├── StockOperationsPage.jsx ← Stock-In/Out/Adjust/Transfer
            ├── MovementsPage.jsx       ← Immutable audit trail
            ├── ProductsPage.jsx        ← Product CRUD
            ├── WarehousePage.jsx       ← Warehouses + virtual locations
            ├── TeamPage.jsx            ← Users + role reference
            └── AlertsPage.jsx          ← Low-stock alerts
```

---

## Database Schema

12 tables in FK dependency order:

| Table | Purpose |
|---|---|
| `roles` | Named permission sets: `admin`, `warehouse_user`, `viewer` |
| `users` | Authenticated staff with role FK and department |
| `warehouses` | Physical warehouse locations |
| `virtual_locations` | Sub-locations within a warehouse: Main Store, Damaged Goods, On-Transit, Quarantine |
| `categories` | Product groupings — only `admin` can delete |
| `units` | Units of measure: Piece, Crate, KG, Litre, Box, Carton, etc. |
| `unit_conversions` | Conversion factors between units (e.g. 1 Crate = 24 Pieces) |
| `products` | SKU, purchase price, reorder point, batch/expiry tracking flags |
| `batches` | Batch numbers with manufacture date, expiry date, and per-batch price |
| `inventory` | Current on-hand quantity per (product × batch × virtual_location) |
| `stock_movements` | **Immutable** append-only audit log with opening/closing balance |
| `low_stock_alerts` | Auto-triggered when stock ≤ reorder point, auto-resolved on replenishment |

### Key Design Decisions

- `inventory.quantity` is always stored in the product's **purchase unit** — unit conversion happens at write time
- `stock_movements` is never UPDATEd or DELETEd — it is the permanent historical record
- `batches.purchase_price` captures the **actual cost at receipt time**, enabling accurate historical valuation even if the product's base price changes later
- `virtual_locations.type` enum (`storage`, `transit`, `damaged`, `quarantine`) enables location-aware business rules

---

## Setup & Installation

### Prerequisites

- Node.js v18+
- MySQL 8.0+ (InnoDB engine — required for row-level locking)
- npm

### 1. Clone and install dependencies

```bash
cd stockos/backend && npm install
cd stockos/frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=inventory_erp
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

### 3. Create the database

```sql
CREATE DATABASE inventory_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run migrations + seeder

```bash
cd backend
npm run setup       # runs migrate.js then seed.js in one shot
```

Or separately:

```bash
npm run migrate     # create all 12 tables
npm run seed        # populate with demo data
```

### 5. Start servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev    # http://localhost:5000

# Terminal 2 — Frontend
cd frontend && npm start     # http://localhost:3000
```

---

## Migration Guide

`backend/migrate.js` creates all 12 tables in correct FK dependency order. Fully idempotent — safe to run multiple times.

### Commands

```bash
node migrate.js              # Create tables (skips existing)
node migrate.js --fresh      # DROP all + recreate (dev only — destructive)

npm run migrate
npm run migrate:fresh
```

### Output

```
── Roles ──────────────────────────────────────────────
   create → roles
   create → users

── Warehouses & Locations ─────────────────────────────
   create → warehouses
   create → virtual_locations

── Product Master ──────────────────────────────────────
   create → categories
   create → units
   create → unit_conversions
   create → products
   create → batches

── Inventory & Movements ───────────────────────────────
   create → inventory
   create → stock_movements
   create → low_stock_alerts

✅  Migrations complete.
    Next step: node seed.js
```

On re-run against an existing database, each step prints `skip → tablename (already exists)`.

### `--fresh` flag

Disables FK checks, drops all 12 tables in reverse dependency order, then recreates them. Use during development when you need a completely clean slate.

```
⚠  Drops: low_stock_alerts → stock_movements → inventory →
           batches → products → unit_conversions → units →
           categories → virtual_locations → warehouses → users → roles
```

> **Never run `--fresh` in production.**

---

## Seeding Guide

`backend/seed.js` populates the database with a complete realistic demo dataset that exercises every feature of the system.

### Commands

```bash
node seed.js              # Seed (skips rows that already exist — safe to re-run)
node seed.js --force      # Truncate all data tables, then re-seed from scratch

npm run seed
npm run seed:force
npm run setup             # migrate + seed in one shot
```

### What gets seeded

```
── Roles (3) ──────────────────────────────────────────────────────────
   admin           permissions: ["*"]
   warehouse_user  permissions: [inventory.read/write/adjust, products.read, ...]
   viewer          permissions: [inventory.read, products.read, reports.read, ...]

── Users (5) ──────────────────────────────────────────────────────────
   admin@erp.com   Admin@123       admin           Administration
   priya@erp.com   Warehouse@123   warehouse_user  Warehouse
   ravi@erp.com    Warehouse@123   warehouse_user  Procurement
   meera@erp.com   Viewer@123      viewer          Finance
   arjun@erp.com   Viewer@123      viewer          Logistics

── Warehouses (2) + Virtual Locations (6) ─────────────────────────────
   Main Warehouse
     → Main Store        (storage)
     → Damaged Goods     (damaged)
     → Quarantine Bay    (quarantine)
     → Dispatch Area     (transit)
   Transit Depot
     → Receiving Dock    (storage)
     → On-Transit Hold   (transit)

── Categories (5) ─────────────────────────────────────────────────────
   Electronics · FMCG · Pharmaceuticals · Raw Materials · Packaging

── Units of Measure (8) ───────────────────────────────────────────────
   Piece (PCS) · Crate (CRT) · Box (BOX) · Carton (CTN)
   Kilogram (KG) · Gram (GM) · Litre (LTR) · Millilitre (ML)

── Unit Conversions (6) ───────────────────────────────────────────────
   1 Crate    = 24 Pieces
   1 Carton   = 12 Boxes
   1 Box      = 6 Pieces
   1 Carton   = 72 Pieces  (12 × 6)
   1 Kilogram = 1000 Grams
   1 Litre    = 1000 Millilitres

── Products (12) ──────────────────────────────────────────────────────
   ELEC-001  USB-C Charging Cable 2m          Electronics
   ELEC-002  Wireless Bluetooth Earbuds        Electronics
   ELEC-003  10000mAh Power Bank               Electronics
   FMCG-001  Basmati Rice Premium 5kg          FMCG          expiry tracked
   FMCG-002  Cold-Pressed Coconut Oil 1L       FMCG          expiry tracked
   FMCG-003  Green Tea Bags (25 pack)          FMCG          expiry tracked
   PHRM-001  Paracetamol 500mg Tabs ×10        Pharmaceuticals
   PHRM-002  Surgical Gloves (L) ×100          Pharmaceuticals
   RAWM-001  Stainless Steel Wire 1mm          Raw Materials  no batch tracking
   RAWM-002  HDPE Granules Natural             Raw Materials
   PACK-001  Corrugated Box 30×20×15cm         Packaging
   PACK-002  Bubble Wrap Roll 50m              Packaging

── Batches + Stock-In Movements (15) ──────────────────────────────────
   15 purchase receipts across all products including:
   - Batch numbers, manufacture dates, expiry dates
   - Per-batch purchase prices for accurate valuation
   - Opening/closing balance recorded on every movement
   - PO reference numbers: PO-2024-001 through PO-2024-015

── Stock-Out Movements (10) ───────────────────────────────────────────
   FIFO applied — oldest batch deducted first.
   Simulated sales: Flipkart, Amazon, hospital orders, work orders.

── Stock Adjustments (2) ──────────────────────────────────────────────
   FMCG-002  −2 CTN  "leaking bottles found during audit"
   PACK-001  +5 CTN  "miscounted in GRN, corrected"

── Low-Stock Alerts (up to 2) ─────────────────────────────────────────
   PHRM-002  Surgical Gloves  — qty ≤ reorder point after hospital sales
   FMCG-003  Green Tea Bags   — qty ≤ reorder point after retail sales
```

### `--force` flag

Truncates all data tables (disables FK checks first), then re-seeds from scratch. Use to reset to a known demo state without dropping table structure.

---

## Login Credentials

| Email | Password | Role | Department | Access Level |
|---|---|---|---|---|
| `admin@erp.com` | `Admin@123` | admin | Administration | Full access to all modules |
| `priya@erp.com` | `Warehouse@123` | warehouse_user | Warehouse | Stock operations, products, reports |
| `ravi@erp.com` | `Warehouse@123` | warehouse_user | Procurement | Stock operations, products, reports |
| `meera@erp.com` | `Viewer@123` | viewer | Finance | Read-only: inventory + reports |
| `arjun@erp.com` | `Viewer@123` | viewer | Logistics | Read-only: inventory + reports |

---

## API Reference

All routes prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Authentication

```
POST /api/auth/login
     Body:    { email, password }
     Returns: { token, user: { id, name, email, role_name, permissions[] } }

GET  /api/auth/me
     Returns: current authenticated user

POST /api/auth/seed
     Creates default roles, users, sample master data (dev convenience)
```

### Dashboard

```
GET /api/dashboard/stats
    Permission: reports.read
    Returns: {
      totalProducts, lowStockAlerts,
      todayStockIn, todayStockOut,
      totalValuation,
      movementTrend: [{ date, stock_in, stock_out }]  ← last 7 days
    }
```

### Inventory

```
GET  /api/inventory/overview
     Permission: inventory.read
     Query: ?sku=&location_id=&category_id=&low_stock_only=true
     Returns: { data[], totalValuation }

GET  /api/inventory/movements
     Permission: inventory.read
     Query: ?sku=&batch_number=&movement_type=stock_in|stock_out|adjustment|transfer
            &location_id=&from_date=&to_date=&page=1&limit=30
     Returns: { data[], total, page, pages }

POST /api/inventory/stock-in
     Permission: inventory.write
     Body: {
       productId, locationId, quantity, unitId,
       batchData: { batch_number, manufacture_date?, expiry_date? },
       unitPrice?, referenceNumber?, reason
     }

POST /api/inventory/stock-out
     Permission: inventory.write
     Body: { productId, locationId, quantity, unitId, referenceNumber?, reason }
     Note: FIFO applied automatically across batches

POST /api/inventory/adjust
     Permission: inventory.adjust
     Body: { productId, locationId, batchId?, newQuantity, reason }
     Note: reason is mandatory (min 5 chars). Creates immutable audit entry.

POST /api/inventory/transfer
     Permission: inventory.write
     Body: { productId, batchId?, fromLocationId, toLocationId, quantity, reason? }

GET  /api/inventory/alerts
     Permission: alerts.read
     Returns: active (unresolved) low-stock alerts
```

### Products

```
GET    /api/products             ?search=&category_id=&page=&limit=
POST   /api/products             Permission: products.write
PUT    /api/products/:id         Permission: products.write
DELETE /api/products/:id         Permission: products.write  (soft delete)
GET    /api/products/:id         Returns product + all batches

GET    /api/categories
POST   /api/categories           Permission: products.write
DELETE /api/categories/:id       Permission: products.delete_category  (admin only)

GET    /api/units
POST   /api/units                Permission: products.write
GET    /api/units/conversions
POST   /api/units/conversions    Body: { from_unit_id, to_unit_id, factor }
```

### Warehouses & Locations

```
GET    /api/warehouses
POST   /api/warehouses           { name, address?, manager_name? }
PUT    /api/warehouses/:id
DELETE /api/warehouses/:id       Soft delete

GET    /api/locations            ?warehouse_id=
POST   /api/locations            { warehouse_id, name, type: storage|transit|damaged|quarantine }
PUT    /api/locations/:id
DELETE /api/locations/:id
```

### Team

```
GET    /api/team/users
POST   /api/team/users           { name, email, password, role_id, department? }
PUT    /api/team/users/:id
DELETE /api/team/users/:id       Soft delete
GET    /api/team/roles           Returns roles with parsed permissions[]
```

---

## Core Modules

### 1. Authentication & Role-Based Access Control

JWT-based authentication. On login the server returns a signed token. Every protected route passes through `authenticate` middleware which verifies the token and attaches the full user with parsed permissions to `req.user`.

`authorize(...permissions)` guards verify the user holds all required permissions before the controller executes:

```js
// Only admins can delete categories
router.delete('/categories/:id',
  authenticate,
  authorize('products.delete_category'),
  prod.deleteCategory
);
```

**Permission matrix:**

| Permission | Admin | Warehouse User | Viewer |
|---|---|---|---|
| `inventory.read` | ✓ | ✓ | ✓ |
| `inventory.write` | ✓ | ✓ | ✗ |
| `inventory.adjust` | ✓ | ✓ | ✗ |
| `products.read` | ✓ | ✓ | ✓ |
| `products.write` | ✓ | ✗ | ✗ |
| `products.delete_category` | ✓ | ✗ | ✗ |
| `warehouse.read` | ✓ | ✓ | ✓ |
| `warehouse.write` | ✓ | ✗ | ✗ |
| `team.read` | ✓ | ✓ | ✗ |
| `team.write` | ✓ | ✗ | ✗ |
| `reports.read` | ✓ | ✓ | ✓ |
| `reports.costs` | ✓ | ✗ | ✗ |
| `alerts.read` | ✓ | ✓ | ✓ |

### 2. Batch & Expiry Tracking with FIFO

Every stock-in creates or reuses a `batch` row. The `inventory` table holds one row per `(product, batch, virtual_location)`. A product's total stock is the sum of all its inventory rows.

FIFO is implemented by ordering batches `created_at ASC` during stock-out:

```js
.orderBy('batches.created_at', 'asc')   // oldest batch first
.orderBy('batches.expiry_date', 'asc')  // tie-break: soonest expiry
.forUpdate()
```

### 3. Unit Conversion

Products have a `purchase_unit` (how received) and a `sale_unit` (how issued). The service normalizes all quantities to purchase units before storing:

```
// 1 Crate = 24 Pieces → factor = 24
// Stock-out of 48 PCS for a product bought in CRT:
// 48 ÷ 24 = 2 CRT deducted from inventory
```

### 4. Immutable Audit Trail

`stock_movements` is append-only. No UPDATE or DELETE is ever performed on it. Every stock change records:

- `opening_balance` — total stock before the movement
- `closing_balance` — total stock after the movement
- `reason` — mandatory for adjustments (min 5 characters)
- `performed_by` — FK to the user who made the change
- `performed_at` — exact timestamp

Users cannot edit a stock count. To correct an error they must perform a **Stock Adjustment**, which creates its own audit entry. The complete history of every balance change is permanently preserved.

### 5. Low-Stock Alert System

After every stock mutation, `checkLowStock()` runs inside the same transaction:

```
total_qty <= reorder_point  →  insert low_stock_alerts row (if not already open)
total_qty >  reorder_point  →  resolve any open alert (auto-dismiss)
```

Alerts appear on the Dashboard and Alerts page, and auto-resolve when stock is replenished — no manual action required.

---

## Senior-Level Technical Answers

### Race Condition Prevention

**Q: How does your backend handle two users trying to Stock-Out the last remaining item at the exact same millisecond?**

**The problem without protection:**

```
User A reads inventory.quantity = 1  ✓ passes availability check
User B reads inventory.quantity = 1  ✓ passes availability check  ← race
User A deducts → quantity = 0
User B deducts → quantity = -1                                    ← OVERSOLD
```

Node.js is single-threaded but both requests live on the async event loop concurrently. Without explicit database-level protection, both can read the same pre-update value before either commits.

**The solution — 3 defensive layers:**

**Layer 1: `knex.transaction()` — ACID boundary**

Every stock mutation runs inside a database transaction. This guarantees atomicity (all steps succeed or all roll back) and consistency. However, two concurrent transactions can still both read the same pre-update value, so a transaction alone is not sufficient.

**Layer 2: `SELECT ... FOR UPDATE` — Pessimistic row locking**

Inside the transaction, an exclusive InnoDB row lock is acquired on every inventory row to be modified:

```js
return trx('inventory')
  .join('batches', ...)
  .where('inventory.product_id', productId)
  .where('inventory.virtual_location_id', locationId)
  .where('inventory.quantity', '>', 0)
  .orderBy('batches.created_at', 'asc')
  .forUpdate();              // ← SELECT ... FOR UPDATE
```

What InnoDB does at the database level:

```
t=0ms  User A starts transaction, issues FOR UPDATE → lock granted
t=0ms  User B starts transaction, issues FOR UPDATE → BLOCKED (queued by InnoDB)

t=3ms  User A reads qty=1, passes check, deducts, commits → lock released
t=3ms  User B unblocked, re-reads qty=0 (committed live value)
t=3ms  User B availability check fails → clean HTTP 400 returned to client
```

The lock is held for the transaction duration and released automatically on commit or rollback.

**Layer 3: Post-lock availability re-check**

After acquiring the lock, the available quantity is re-summed from the now-locked rows and verified again:

```js
const lockedBatches = await getFIFOBatchesLocked(productId, locationId, trx);

// Read live committed value — not a pre-lock snapshot
const totalAvailable = lockedBatches.reduce(
  (sum, b) => sum + parseFloat(b.quantity), 0
);

if (totalAvailable < qtyInPurchaseUnit) {
  throw new Error('Insufficient stock. Another transaction may have just consumed the remaining stock.');
}
```

Between the HTTP request arriving and the lock being granted, another transaction may have already committed a deduction. Reading inside the locked context gives the live committed value, not a stale snapshot.

**Why not optimistic locking?**
Optimistic locking (version columns + retry on conflict) works when conflicts are rare. In a warehouse during peak dispatch hours, concurrent stock-outs of the same SKU are expected and frequent. Retrying would cause request storms. Pessimistic locking queues requests — safer and more predictable.

**Why not a Redis mutex?**
A distributed lock adds infrastructure complexity and a new failure mode (Redis unavailability). MySQL InnoDB row locks are atomic with the data change itself — the lock and the write live in the same ACID transaction with no extra moving parts.

**Result:** It is impossible for `inventory.quantity` to go below zero through concurrent requests. The second concurrent request either waits and succeeds (if stock is still available) or receives a clean error. No overselling. No negative inventory.

---

### Data Visualization — Inventory Valuation

The Dashboard displays **Total Inventory Valuation** — the sum of `(quantity × batch_purchase_price)` across every live inventory row.

Because each batch stores the price at the time it was physically received (`batches.purchase_price`), the valuation reflects actual cost — not the current product list price. This means if you bought a batch at ₹1,800 and later updated the product price to ₹2,000, the old batch is still valued at ₹1,800.

```sql
SELECT SUM(inv.quantity * COALESCE(b.purchase_price, p.purchase_price)) AS valuation
FROM inventory inv
JOIN products p ON inv.product_id = p.id
LEFT JOIN batches b ON inv.batch_id = b.id
```

This query is served from `GET /api/dashboard/stats` and also broken down per-product on the Stock Overview page where each location/batch row shows its individual valuation contribution.

---

### Search & Filter — High-Performance Filtering

All filtering is pushed to MySQL — no in-memory filtering in Node. The Audit Trail endpoint supports:

```
GET /api/inventory/movements
    ?sku=ELEC
    &batch_number=B2401
    &movement_type=stock_out
    &location_id=2
    &from_date=2024-01-01
    &to_date=2024-12-31
    &page=1
    &limit=30
```

Performance indexes on `stock_movements`:

```js
t.index(['product_id', 'batch_id', 'performed_at']); // history + FIFO queries
t.index(['movement_type']);                           // type filter
t.index(['performed_at']);                            // date range queries
t.index(['reference_number']);                        // PO / invoice lookup
```

Products are indexed on `sku` and `category_id`. The Stock Overview aggregates across the join at the DB level before returning results.

---

### Mobile-Ready UI

The frontend is designed for warehouse staff on tablets and phones:

- `stats-grid` uses `repeat(auto-fit, minmax(200px, 1fr))` — collapses from 5-column to 2-column to 1-column
- Stock Operations forms collapse to single-column on mobile
- Sidebar hides at ≤768px and is replaced with a hamburger overlay menu
- All data tables wrapped in `overflow-x: auto` for horizontal scroll on small screens
- Form controls and buttons sized at minimum 40px height for touch use
- Fully usable at 375px (iPhone SE), 768px (tablet landscape), 1280px+ (desktop)

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend Runtime | Node.js 18+ + Express 4 | Non-blocking I/O for concurrent warehouse requests |
| Query Builder | Knex.js 3 | SQL control with `.forUpdate()` row locking and transaction API |
| Database | MySQL 8 (InnoDB) | Row-level locking required for race-safe stock operations |
| Authentication | JWT + bcryptjs | Stateless auth — scales horizontally without session store |
| Input Validation | Joi | Schema-based request validation |
| Frontend | React 18 + React Router 6 | Component model suits complex ERP form workflows |
| Charts | Recharts | Composable charts on D3 — area, bar, responsive containers |
| HTTP Client | Axios | Interceptors for token injection and 401 auto-redirect |
| Notifications | react-hot-toast | Non-blocking feedback for stock operations |
| Icons | lucide-react | Consistent lightweight SVG icons |
| Fonts | Space Mono + DM Sans | Space Mono for data/numbers; DM Sans for UI prose |