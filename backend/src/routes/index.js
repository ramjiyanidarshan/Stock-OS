const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const auth = require('../controllers/auth.controller');
const inv = require('../controllers/inventory.controller');
const prod = require('../controllers/products.controller');
const wh = require('../controllers/warehouse.controller');

// Public
router.post('/auth/login', auth.login);
router.post('/auth/seed', auth.seed); // Remove in production

// Auth
router.get('/auth/me', authenticate, auth.me);

// Dashboard
router.get('/dashboard/stats', authenticate, authorize('reports.read'), inv.getDashboardStats);
router.get('/inventory/overview', authenticate, authorize('inventory.read'), inv.getInventoryOverview);
router.get('/inventory/alerts', authenticate, authorize('alerts.read'), inv.getAlerts);

// Stock movements
router.get('/inventory/movements', authenticate, authorize('inventory.read'), inv.getMovements);
router.post('/inventory/stock-in', authenticate, authorize('inventory.write'), inv.stockIn);
router.post('/inventory/stock-out', authenticate, authorize('inventory.write'), inv.stockOut);
router.post('/inventory/adjust', authenticate, authorize('inventory.adjust'), inv.stockAdjust);
router.post('/inventory/transfer', authenticate, authorize('inventory.write'), inv.stockTransfer);

// Products
router.get('/products', authenticate, authorize('products.read'), prod.list);
router.get('/products/:id', authenticate, authorize('products.read'), prod.get);
router.post('/products', authenticate, authorize('products.write'), prod.create);
router.put('/products/:id', authenticate, authorize('products.write'), prod.update);
router.delete('/products/:id', authenticate, authorize('products.write'), prod.delete);

// Categories (delete requires special permission)
router.get('/categories', authenticate, prod.listCategories);
router.post('/categories', authenticate, authorize('products.write'), prod.createCategory);
router.delete('/categories/:id', authenticate, authorize('products.delete_category'), prod.deleteCategory);

// Units & Conversions
router.get('/units', authenticate, prod.listUnits);
router.post('/units', authenticate, authorize('products.write'), prod.createUnit);
router.get('/units/conversions', authenticate, prod.listConversions);
router.post('/units/conversions', authenticate, authorize('products.write'), prod.createConversion);

// Warehouses
router.get('/warehouses', authenticate, authorize('warehouse.read'), wh.listWarehouses);
router.post('/warehouses', authenticate, authorize('warehouse.write'), wh.createWarehouse);
router.put('/warehouses/:id', authenticate, authorize('warehouse.write'), wh.updateWarehouse);
router.delete('/warehouses/:id', authenticate, authorize('warehouse.write'), wh.deleteWarehouse);

// Virtual Locations
router.get('/locations', authenticate, authorize('warehouse.read'), wh.listLocations);
router.post('/locations', authenticate, authorize('warehouse.write'), wh.createLocation);
router.put('/locations/:id', authenticate, authorize('warehouse.write'), wh.updateLocation);
router.delete('/locations/:id', authenticate, authorize('warehouse.write'), wh.deleteLocation);

// Team
router.get('/team/users', authenticate, authorize('team.read'), wh.listUsers);
router.post('/team/users', authenticate, authorize('team.write'), wh.createUser);
router.put('/team/users/:id', authenticate, authorize('team.write'), wh.updateUser);
router.delete('/team/users/:id', authenticate, authorize('team.write'), wh.deleteUser);
router.get('/team/roles', authenticate, wh.listRoles);

module.exports = router;
