import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, getMe } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_token');
    if (token) {
      getMe().then(r => setUser(r.data.user || r.data)).catch(() => localStorage.removeItem('erp_token')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const r = await apiLogin({ email, password });
    localStorage.setItem('erp_token', r.data.token);
    setUser(r.data.user);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    setUser(null);
  };

  const can = (...perms) => {
    if (!user) return false;
    const up = user.permissions || [];
    if (up.includes('*')) return true;
    return perms.every(p => up.includes(p));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
