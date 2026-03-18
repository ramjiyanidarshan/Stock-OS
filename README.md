# ◈ StockOS — Inventory Management ERP

A production-grade Inventory ERP MVP built with Node.js + Express + Knex (MySQL) on the backend and React.js on the frontend.

---

## Architecture Overview

```
inventory-erp/
├── backend/                     # Node.js + Express + Knex
│   └── src/
│       ├── config/
│       │   ├── db.js            # Knex connection config
│       │   └── knex.js          # Knex singleton
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── inventory.controller.js
│       │   ├── products.controller.js
│       │   └── warehouse.controller.js
│       ├── middleware/
│       │   └── auth.js          # JWT + permission guard
│       ├── migrations/
│       │   └── run.js           # All DB table creation
│       ├── routes/
│       │   └── index.js         # All API routes
│       ├── services/
│       │   └── inventory.service.js  # Core business logic (FIFO, race-safe)
│       └── index.js             # Express app entry
│
└── frontend/                    # React.js
    └── src/
        ├── context/AuthContext.jsx
        ├── services/api.js       # Axios layer
        ├── components/Layout.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── InventoryPage.jsx
            ├── StockOperationsPage.jsx
            ├── MovementsPage.jsx
            ├── ProductsPage.jsx
            ├── WarehousePage.jsx
            ├── TeamPage.jsx
            └── AlertsPage.jsx
```

---

## Database Schema (11 Tables)

| Table | Purpose |
|---|---|
| `roles` | Permission sets (admin, warehouse_user, viewer) |
| `users` | Auth + department + role FK |
| `warehouses` | Physical warehouse locations |
| `virtual_locations` | Sub-locations (Main Store, Damaged Goods, On-Transit) |
| `categories` | Product categories |
| `units` | Units of measure (Crate, Piece, KG, Litre) |
| `unit_conversions` | Conversion factors between units |
| `products` | SKU, pricing, reorder point, batch/expiry flags |
| `batches` | Batch numbers, mfg/expiry dates, purchase price |
| `inventory` | Current qty per (product × batch × virtual_location) |
| `stock_movements` | Immutable audit log with opening/closing balance |
| `low_stock_alerts` | Auto-triggered when stock ≤ reorder point |

---

## Senior-Level Requirements — Implementation

### 1. Race Condition Prevention
Every stock mutation (stock-in, stock-out, adjustment, transfer) runs inside a **Knex transaction** with `SELECT ... FOR UPDATE` row-level locking.

```js
// inventory.service.js
const batches = await getFIFOBatches(productId, locationId, trx);
// ^ Uses .forUpdate() — locks rows
// Two concurrent stock-outs queue at DB level
// Second request sees updated qty and fails gracefully if zero
```

MySQL InnoDB serializes these at the row level — the second concurrent request either waits and succeeds (if stock still available) or fails with a clean error message.

### 2. FIFO Logic
```js
// Oldest batch first (created_at ASC = first purchased = first out)
.orderBy('batches.created_at', 'asc')
.forUpdate()
```
The service loops through FIFO-ordered batches, deducting from each until the requested quantity is fulfilled.

### 3. Immutable Audit Trail
Users **cannot edit stock counts directly**. Every change goes through:
- `stock_in` → creates movement log
- `stock_out` → creates movement log  
- `adjustment` → **requires mandatory reason**, records opening + closing balance
- `transfer` → records from/to locations

The `stock_movements` table is append-only. No UPDATE or DELETE operations are ever performed on it.

### 4. Unit Conversion
Products have a `purchase_unit` and a `sale_unit`. The `unit_conversions` table stores conversion factors (e.g., 1 Crate = 24 Pieces). The service normalizes all quantities to the purchase unit before storing.

### 5. RBAC — Departmental Access
| Permission | Admin | Warehouse User | Viewer |
|---|---|---|---|
| `inventory.read` | ✓ | ✓ | ✓ |
| `inventory.write` | ✓ | ✓ | ✗ |
| `inventory.adjust` | ✓ | ✓ | ✗ |
| `products.delete_category` | ✓ | ✗ | ✗ |
| `reports.costs` | ✓ | ✗ | ✗ |
| `team.write` | ✓ | ✗ | ✗ |

### 6. Low Stock Alerts
Automatically triggered after every stock-out or adjustment. If `total_qty <= reorder_point`, an alert is inserted. If stock is replenished above the reorder point, the alert is auto-resolved.

---

## Setup

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials

npm install
node src/migrations/run.js   # Create all tables
npm run dev                   # Start on port 5000
```

### Frontend
```bash
cd frontend
npm install
npm start   # Start on port 3000
```

### First Run
1. Open http://localhost:3000/login
2. Click **"Seed Demo Data"** button to create roles, users, sample warehouse, units, categories
3. Login with `admin@erp.com` / `Admin@123`

---

## API Reference

### Auth
```
POST /api/auth/login          { email, password }
GET  /api/auth/me             Bearer token required
POST /api/auth/seed           Create demo data
```

### Inventory
```
GET  /api/inventory/overview  ?sku=&location_id=&category_id=&low_stock_only=
GET  /api/inventory/movements ?sku=&batch_number=&movement_type=&location_id=&from_date=&to_date=
POST /api/inventory/stock-in  { productId, batchData, locationId, quantity, unitId, unitPrice, ... }
POST /api/inventory/stock-out { productId, locationId, quantity, unitId, ... }
POST /api/inventory/adjust    { productId, locationId, batchId, newQuantity, reason }
POST /api/inventory/transfer  { productId, batchId, fromLocationId, toLocationId, quantity }
GET  /api/inventory/alerts
GET  /api/dashboard/stats
```

### Products, Warehouses, Team
Standard CRUD at `/api/products`, `/api/categories`, `/api/units`, `/api/warehouses`, `/api/locations`, `/api/team/users`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Runtime | Node.js + Express |
| ORM / Query Builder | Knex.js |
| Database | MySQL (InnoDB — for row-level locking) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Validation | Joi |
| Frontend | React 18 + React Router 6 |
| Charts | Recharts |
| HTTP Client | Axios |
| Notifications | react-hot-toast |
| Icons | lucide-react |
| Fonts | Space Mono + DM Sans |
