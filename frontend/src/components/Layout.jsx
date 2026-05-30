import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, ArrowLeftRight, Warehouse, Users,
  Bell, LogOut, Boxes, ClipboardList, TrendingUp, Menu, X, ChevronDown, Lock, Shield, User, Train, FileInput
} from 'lucide-react';

const NAV = [
  { section: 'Dashboard' },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Access Control' },
  {
    label: 'Access Control',
    icon: Lock,
    submenu: [
      { to: '/access-control/modules', label: 'Modules', icon: Boxes },
      { to: '/access-control/permissions', label: 'Permissions', icon: Shield },
      { to: '/access-control/users', label: 'Users', icon: User },
    ],
  },
  { section: 'Log and Trace' },
  {
    label: 'Logs',
    icon: FileInput,
    submenu: [
      { to: '/log-and-trace/transactions', label: 'Transaction', icon: Train }
    ],
  },
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [alertCount] = useState(0);

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleSubmenu = (idx) => setExpandedMenu(expandedMenu === idx ? null : idx);

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo">
        <div className="brand">◈ StockOS</div>
        <div className="sub">Inventory ERP v1.0</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) return <div key={i} className="nav-section-label">{item.section}</div>;
          if (item.perm && !can(item.perm)) return null;

          if (item.submenu) {
            return (
              <div key={i} className="nav-parent-group">
                <button
                  onClick={() => toggleSubmenu(i)}
                  className="nav-item nav-parent"
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <item.icon size={15} />
                    {item.label}
                  </div>
                  <ChevronDown
                    size={15}
                    style={{
                      transform: expandedMenu === i ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>
                {expandedMenu === i && (
                  <div className="nav-submenu">
                    {item.submenu.map((subitem, subIdx) => (
                      <NavLink
                        key={subIdx}
                        to={subitem.to}
                        className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <subitem.icon size={14} />
                        {subitem.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={i}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={15} />
              {item.label}
              {item.badge && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role_name}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <SidebarContent />
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="main-content">
        {/* Mobile header */}
        <div style={{ display: 'none', padding: '12px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 12 }} className="mobile-header">
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <Menu size={20} />
          </button>
          <span style={{ fontFamily: 'Space Mono', fontSize: 13, color: 'var(--accent-blue)', fontWeight: 700 }}>◈ StockOS</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
