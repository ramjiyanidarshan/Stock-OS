import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import ProductsPage from './pages/ProductsPage';
import MovementsPage from './pages/MovementsPage';
import StockOperationsPage from './pages/StockOperationsPage';
import WarehousePage from './pages/WarehousePage';
import TeamPage from './pages/TeamPage';
import AlertsPage from './pages/AlertsPage';

const ProtectedRoute = ({ children, permission }) => {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <div className="no-access">Access Denied</div>;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f2e', color: '#e2e8f0', border: '1px solid #2d3748' } }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="movements" element={<MovementsPage />} />
            <Route path="operations" element={<StockOperationsPage />} />
            <Route path="warehouses" element={<WarehousePage />} />
            <Route path="team" element={<ProtectedRoute permission="team.read"><TeamPage /></ProtectedRoute>} />
            <Route path="alerts" element={<AlertsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
