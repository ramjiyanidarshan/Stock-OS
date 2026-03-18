/**
 * ============================================================
 * migrate.js — StockOS Inventory ERP
 * ============================================================
 * Drops and recreates all tables in correct dependency order.
 *
 * Usage:
 *   node migrate.js            → run migrations only
 *   node migrate.js --fresh    → DROP all tables first, then migrate
 *
 * Requires: .env with DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * ============================================================
 */

require('dotenv').config();
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'inventory_erp',
    timezone: 'UTC',
  },
  pool: { min: 1, max: 5 },
});

const isFresh = process.argv.includes('--fresh');

// ─── Drop order (reverse of FK dependencies) ─────────────────────────────────
const DROP_ORDER = [
  'low_stock_alerts',
  'stock_movements',
  'inventory',
  'batches',
  'products',
  'unit_conversions',
  'units',
  'categories',
  'virtual_locations',
  'warehouses',
  'users',
  'roles',
];

// ─── Migration steps ──────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    name: 'roles',
    run: () => knex.schema.createTableIfNotExists('roles', t => {
      t.increments('id').primary();
      t.string('name', 50).notNullable().unique()
        .comment('admin | warehouse_user | viewer');
      t.json('permissions').notNullable()
        .comment('JSON string array of permission keys, e.g. ["*"] or ["inventory.read"]');
      t.timestamps(true, true);
    }),
  },
  {
    name: 'users',
    run: () => knex.schema.createTableIfNotExists('users', t => {
      t.increments('id').primary();
      t.string('name', 100).notNullable();
      t.string('email', 150).notNullable().unique();
      t.string('password_hash', 255).notNullable();
      t.integer('role_id').unsigned().nullable()
        .references('id').inTable('roles').onDelete('SET NULL');
      t.string('department', 100).nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
      t.index(['email']);
      t.index(['role_id']);
    }),
  },
  {
    name: 'warehouses',
    run: () => knex.schema.createTableIfNotExists('warehouses', t => {
      t.increments('id').primary();
      t.string('name', 100).notNullable();
      t.string('address', 255).nullable();
      t.string('manager_name', 100).nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
    }),
  },
  {
    name: 'virtual_locations',
    run: () => knex.schema.createTableIfNotExists('virtual_locations', t => {
      t.increments('id').primary();
      t.integer('warehouse_id').unsigned().notNullable()
        .references('id').inTable('warehouses').onDelete('CASCADE');
      t.string('name', 100).notNullable()
        .comment('e.g. Main Store, Damaged Goods, On-Transit, Quarantine');
      t.enu('type', ['storage', 'transit', 'damaged', 'quarantine']).notNullable().defaultTo('storage');
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
      t.index(['warehouse_id']);
      t.index(['type']);
    }),
  },
  {
    name: 'categories',
    run: () => knex.schema.createTableIfNotExists('categories', t => {
      t.increments('id').primary();
      t.string('name', 100).notNullable();
      t.string('description', 255).nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
    }),
  },
  {
    name: 'units',
    run: () => knex.schema.createTableIfNotExists('units', t => {
      t.increments('id').primary();
      t.string('name', 50).notNullable()
        .comment('e.g. Crate, Piece, Kilogram, Litre, Box, Carton');
      t.string('abbreviation', 20).notNullable()
        .comment('e.g. CRT, PCS, KG, LTR, BOX, CTN');
      t.timestamps(true, true);
      t.unique(['abbreviation']);
    }),
  },
  {
    name: 'unit_conversions',
    run: () => knex.schema.createTableIfNotExists('unit_conversions', t => {
      t.increments('id').primary();
      t.integer('from_unit_id').unsigned().notNullable()
        .references('id').inTable('units').onDelete('CASCADE');
      t.integer('to_unit_id').unsigned().notNullable()
        .references('id').inTable('units').onDelete('CASCADE');
      t.decimal('factor', 15, 6).notNullable()
        .comment('1 from_unit = factor to_unit. e.g. 1 Crate = 24 Pieces → factor=24');
      t.timestamps(true, true);
      t.unique(['from_unit_id', 'to_unit_id']);
    }),
  },
  {
    name: 'products',
    run: () => knex.schema.createTableIfNotExists('products', t => {
      t.increments('id').primary();
      t.string('sku', 100).notNullable().unique()
        .comment('Stock Keeping Unit — must be globally unique');
      t.string('name', 200).notNullable();
      t.text('description').nullable();
      t.integer('category_id').unsigned().nullable()
        .references('id').inTable('categories').onDelete('SET NULL');
      t.integer('purchase_unit_id').unsigned().nullable()
        .references('id').inTable('units')
        .comment('Unit goods are bought/received in (e.g. Crate)');
      t.integer('sale_unit_id').unsigned().nullable()
        .references('id').inTable('units')
        .comment('Unit goods are sold/issued in (e.g. Piece) — may differ from purchase_unit');
      t.decimal('reorder_point', 15, 4).notNullable().defaultTo(0)
        .comment('Low-stock alert fires when total_qty <= this value (in purchase_unit)');
      t.decimal('purchase_price', 15, 4).notNullable().defaultTo(0)
        .comment('Default cost price per purchase_unit — overridden per batch');
      t.boolean('track_batches').notNullable().defaultTo(true)
        .comment('Whether batch numbers must be recorded for this product');
      t.boolean('track_expiry').notNullable().defaultTo(false)
        .comment('Whether expiry dates must be tracked per batch');
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
      t.index(['sku']);
      t.index(['category_id']);
      t.index(['is_active']);
    }),
  },
  {
    name: 'batches',
    run: () => knex.schema.createTableIfNotExists('batches', t => {
      t.increments('id').primary();
      t.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products').onDelete('CASCADE');
      t.string('batch_number', 100).notNullable()
        .comment('Supplier batch / lot number');
      t.date('manufacture_date').nullable();
      t.date('expiry_date').nullable()
        .comment('FIFO will still prioritise by created_at; expiry is for compliance tracking');
      t.decimal('purchase_price', 15, 4).notNullable()
        .comment('Actual cost price at time this batch was received — used for valuation');
      t.timestamps(true, true);
      t.unique(['product_id', 'batch_number']);
      t.index(['product_id']);
      t.index(['expiry_date']);
    }),
  },
  {
    name: 'inventory',
    run: () => knex.schema.createTableIfNotExists('inventory', t => {
      t.increments('id').primary();
      t.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products');
      t.integer('batch_id').unsigned().nullable()
        .references('id').inTable('batches');
      t.integer('virtual_location_id').unsigned().notNullable()
        .references('id').inTable('virtual_locations');
      t.decimal('quantity', 15, 4).notNullable().defaultTo(0)
        .comment('Current on-hand quantity in purchase_unit. Never goes negative.');
      t.timestamps(true, true);
      // One row per (product, batch, location) combination
      t.unique(['product_id', 'batch_id', 'virtual_location_id']);
      t.index(['product_id']);
      t.index(['virtual_location_id']);
    }),
  },
  {
    name: 'stock_movements',
    run: () => knex.schema.createTableIfNotExists('stock_movements', t => {
      t.increments('id').primary();
      t.enu('movement_type', ['stock_in', 'stock_out', 'adjustment', 'transfer'])
        .notNullable()
        .comment('stock_in=purchase receipt, stock_out=sale/usage, adjustment=physical count correction, transfer=between locations');
      t.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products');
      t.integer('batch_id').unsigned().nullable()
        .references('id').inTable('batches');
      t.integer('from_location_id').unsigned().nullable()
        .references('id').inTable('virtual_locations')
        .comment('Populated for stock_out, adjustment (decrease), transfer');
      t.integer('to_location_id').unsigned().nullable()
        .references('id').inTable('virtual_locations')
        .comment('Populated for stock_in, adjustment (increase), transfer');
      t.decimal('quantity', 15, 4).notNullable()
        .comment('Always positive. Direction is determined by movement_type.');
      t.integer('unit_id').unsigned().nullable()
        .references('id').inTable('units')
        .comment('Unit the movement was recorded in (may differ from purchase_unit)');
      t.decimal('quantity_in_purchase_unit', 15, 4).notNullable()
        .comment('Normalised quantity after unit conversion — used for all balance calculations');
      t.decimal('unit_price', 15, 4).nullable()
        .comment('Cost price per purchase_unit at time of movement — for valuation history');
      t.decimal('opening_balance', 15, 4).notNullable()
        .comment('Total product stock BEFORE this movement (across all locations)');
      t.decimal('closing_balance', 15, 4).notNullable()
        .comment('Total product stock AFTER this movement');
      t.string('reference_number', 100).nullable()
        .comment('PO number, sales invoice, GRN ref, etc.');
      t.text('reason').nullable()
        .comment('Mandatory for adjustments (min 5 chars). Describes why the change was made.');
      t.integer('performed_by').unsigned().nullable()
        .references('id').inTable('users');
      t.timestamp('performed_at').notNullable().defaultTo(knex.fn.now());
      // Indexes for common query patterns
      t.index(['product_id', 'batch_id', 'performed_at']); // FIFO lookups + product history
      t.index(['movement_type']);                           // filter by type
      t.index(['performed_at']);                            // date-range queries
      t.index(['reference_number']);                        // lookup by PO / invoice
    }),
  },
  {
    name: 'low_stock_alerts',
    run: () => knex.schema.createTableIfNotExists('low_stock_alerts', t => {
      t.increments('id').primary();
      t.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products');
      t.decimal('current_qty', 15, 4).notNullable()
        .comment('Quantity at the time the alert was triggered');
      t.decimal('reorder_point', 15, 4).notNullable()
        .comment('Snapshot of reorder_point at alert time');
      t.boolean('is_resolved').notNullable().defaultTo(false);
      t.timestamp('triggered_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('resolved_at').nullable()
        .comment('Auto-set when stock is replenished above reorder_point');
      t.index(['product_id', 'is_resolved']);
      t.index(['is_resolved']);
    }),
  },
];

// ─── Main runner ──────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  StockOS — Database Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Verify DB connection
  try {
    await knex.raw('SELECT 1');
    console.log(`✔  Connected to database: ${process.env.DB_NAME || 'inventory_erp'}\n`);
  } catch (err) {
    console.error('✘  Cannot connect to database:', err.message);
    console.error('   Check your .env file (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)');
    process.exit(1);
  }

  // --fresh: drop all tables
  if (isFresh) {
    console.log('⚠  --fresh flag detected. Dropping all tables...\n');
    await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of DROP_ORDER) {
      await knex.schema.dropTableIfExists(table);
      console.log(`   dropped → ${table}`);
    }
    await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
    console.log();
  }

  // Run each migration step
  console.log('Running migrations...\n');
  for (const step of MIGRATIONS) {
    const exists = await knex.schema.hasTable(step.name);
    if (exists && !isFresh) {
      console.log(`   skip   → ${step.name} (already exists)`);
    } else {
      await step.run();
      console.log(`   create → ${step.name}`);
    }
  }

  console.log('\n✅  Migrations complete.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Next step: node seed.js');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

migrate()
  .catch(err => { console.error('\n✘  Migration failed:', err.message); process.exit(1); })
  .finally(() => knex.destroy());
