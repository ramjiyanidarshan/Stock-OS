import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('erp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const seed = () => api.post('/auth/seed');

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getInventoryOverview = (params) => api.get('/inventory/overview', { params });
export const getAlerts = () => api.get('/inventory/alerts');

// Products
export const getProducts = (params) => api.get('/products', { params });
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// Categories
export const getCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Units
export const getUnits = () => api.get('/units');
export const createUnit = (data) => api.post('/units', data);
export const getConversions = () => api.get('/units/conversions');
export const createConversion = (data) => api.post('/units/conversions', data);

// Inventory movements
export const getMovements = (params) => api.get('/inventory/movements', { params });
export const stockIn = (data) => api.post('/inventory/stock-in', data);
export const stockOut = (data) => api.post('/inventory/stock-out', data);
export const stockAdjust = (data) => api.post('/inventory/adjust', data);
export const stockTransfer = (data) => api.post('/inventory/transfer', data);

// Warehouses & Locations
export const getWarehouses = () => api.get('/warehouses');
export const createWarehouse = (data) => api.post('/warehouses', data);
export const updateWarehouse = (id, data) => api.put(`/warehouses/${id}`, data);
export const deleteWarehouse = (id) => api.delete(`/warehouses/${id}`);
export const getLocations = (params) => api.get('/locations', { params });
export const createLocation = (data) => api.post('/locations', data);

// Team
export const getUsers = () => api.get('/team/users');
export const createUser = (data) => api.post('/team/users', data);
export const updateUser = (id, data) => api.put(`/team/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/team/users/${id}`);
export const getRoles = () => api.get('/team/roles');

export default api;
