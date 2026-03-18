const knex = require('../config/knex');

async function runMigrations() {
  console.log('Running migrations...');

  // Users & Roles
  await knex.schema.createTableIfNotExists('roles', t => {
    t.increments('id');
    t.string('name', 50).notNullable().unique(); // admin, warehouse_user, viewer
    t.json('permissions').notNullable(); // JSON array of permission keys
    t.timestamps(true, true);
  });

  await knex.schema.createTableIfNotExists('users', t => {
    t.increments('id');
    t.string('name', 100).notNullable();
    t.string('email', 150).notNullable().unique();
    t.string('password_hash').notNullable();
    t.integer('role_id').unsigned().references('id').inTable('roles').onDelete('SET NULL');
    t.string('department', 100);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Warehouses & Virtual Locations
  await knex.schema.createTableIfNotExists('warehouses', t => {
    t.increments('id');
    t.string('name', 100).notNullable();
    t.string('address').nullable();
    t.string('manager_name', 100).nullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTableIfNotExists('virtual_locations', t => {
    t.increments('id');
    t.integer('warehouse_id').unsigned().references('id').inTable('warehouses').onDelete('CASCADE');
    t.string('name', 100).notNullable(); // Main Store, Damaged Goods, On-Transit
    t.string('type', 50).defaultTo('storage'); // storage, transit, quarantine, damaged
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Product Categories
  await knex.schema.createTableIfNotExists('categories', t => {
    t.increments('id');
    t.string('name', 100).notNullable();
    t.string('description').nullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Units of Measure
  await knex.schema.createTableIfNotExists('units', t => {
    t.increments('id');
    t.string('name', 50).notNullable(); // Crate, Piece, Kg, Litre
    t.string('abbreviation', 20).notNullable();
    t.timestamps(true, true);
  });

  // Unit Conversions
  await knex.schema.createTableIfNotExists('unit_conversions', t => {
    t.increments('id');
    t.integer('from_unit_id').unsigned().references('id').inTable('units');
    t.integer('to_unit_id').unsigned().references('id').inTable('units');
    t.decimal('factor', 15, 6).notNullable(); // 1 Crate = 24 Pieces => factor=24
    t.timestamps(true, true);
  });

  // Products
  await knex.schema.createTableIfNotExists('products', t => {
    t.increments('id');
    t.string('sku', 100).notNullable().unique();
    t.string('name', 200).notNullable();
    t.text('description').nullable();
    t.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
    t.integer('purchase_unit_id').unsigned().references('id').inTable('units');
    t.integer('sale_unit_id').unsigned().references('id').inTable('units');
    t.decimal('reorder_point', 15, 4).defaultTo(0); // low-stock threshold in purchase unit
    t.decimal('purchase_price', 15, 4).defaultTo(0); // cost price per purchase unit
    t.boolean('track_batches').defaultTo(true);
    t.boolean('track_expiry').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Batches
  await knex.schema.createTableIfNotExists('batches', t => {
    t.increments('id');
    t.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    t.string('batch_number', 100).notNullable();
    t.date('manufacture_date').nullable();
    t.date('expiry_date').nullable();
    t.decimal('purchase_price', 15, 4).notNullable(); // price at time of purchase
    t.timestamps(true, true);
    t.unique(['product_id', 'batch_number']);
  });

  // Inventory (stock per batch per virtual location)
  await knex.schema.createTableIfNotExists('inventory', t => {
    t.increments('id');
    t.integer('product_id').unsigned().references('id').inTable('products');
    t.integer('batch_id').unsigned().references('id').inTable('batches');
    t.integer('virtual_location_id').unsigned().references('id').inTable('virtual_locations');
    t.decimal('quantity', 15, 4).notNullable().defaultTo(0); // in purchase unit
    t.timestamps(true, true);
    t.unique(['product_id', 'batch_id', 'virtual_location_id']);
  });

  // Stock Movements (immutable audit log)
  await knex.schema.createTableIfNotExists('stock_movements', t => {
    t.increments('id');
    t.string('movement_type', 50).notNullable(); // stock_in, stock_out, adjustment, transfer
    t.integer('product_id').unsigned().references('id').inTable('products');
    t.integer('batch_id').unsigned().references('id').inTable('batches').nullable();
    t.integer('from_location_id').unsigned().references('id').inTable('virtual_locations').nullable();
    t.integer('to_location_id').unsigned().references('id').inTable('virtual_locations').nullable();
    t.decimal('quantity', 15, 4).notNullable(); // always positive, direction from type
    t.integer('unit_id').unsigned().references('id').inTable('units'); // unit of this movement
    t.decimal('quantity_in_purchase_unit', 15, 4).notNullable(); // normalized
    t.decimal('unit_price', 15, 4).nullable();
    t.decimal('opening_balance', 15, 4).notNullable(); // before this movement
    t.decimal('closing_balance', 15, 4).notNullable(); // after this movement
    t.string('reference_number', 100).nullable(); // PO number, invoice, etc.
    t.text('reason').nullable(); // mandatory for adjustments
    t.integer('performed_by').unsigned().references('id').inTable('users');
    t.timestamp('performed_at').defaultTo(knex.fn.now());
    t.index(['product_id', 'batch_id', 'performed_at']); // for FIFO queries
    t.index(['movement_type']);
  });

  // Low Stock Alerts
  await knex.schema.createTableIfNotExists('low_stock_alerts', t => {
    t.increments('id');
    t.integer('product_id').unsigned().references('id').inTable('products');
    t.decimal('current_qty', 15, 4).notNullable();
    t.decimal('reorder_point', 15, 4).notNullable();
    t.boolean('is_resolved').defaultTo(false);
    t.timestamp('triggered_at').defaultTo(knex.fn.now());
    t.timestamp('resolved_at').nullable();
    t.index(['is_resolved']);
  });

  console.log('✅ All migrations complete.');
  await knex.destroy();
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
