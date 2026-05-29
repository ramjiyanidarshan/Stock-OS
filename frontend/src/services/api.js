import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
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

// Team
export const getUsers = () => api.get('/team/users');
export const createUser = (data) => api.post('/team/users', data);
export const updateUser = (id, data) => api.put(`/team/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/team/users/${id}`);
export const getRoles = () => api.get('/team/roles');

export default api;
