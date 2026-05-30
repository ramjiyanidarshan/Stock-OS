import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TeamPage from './pages/TeamPage';
import NotFound from './pages/NotFound';
import ModulesPage from './pages/ModulesPage';
import PermissionsPage from './pages/PermissionsPage';
import UsersPage from './pages/UsersPage';
import TransactionLogsPage from './pages/TransactionLogsPage';

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
      <BrowserRouter future={{ v7_startTransition: true }}>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1f2e', color: '#e2e8f0', border: '1px solid #2d3748' } }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            {/* <Route path="team" element={<ProtectedRoute permission="team.read"><TeamPage /></ProtectedRoute>} /> */}
            <Route path="team" element={<TeamPage />} />
            <Route path="access-control/modules" element={<ModulesPage />} />
            <Route path="access-control/permissions" element={<PermissionsPage />} />
            <Route path="access-control/users" element={<TeamPage />} />
            <Route path="logs" element={<TransactionLogsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
