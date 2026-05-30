import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, ArrowRight, UserCheck, Boxes, Sparkles, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];

  return (
    <div className="page-shell">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="hero-eyebrow">StockOS - By DSP</span>
          <h1>Welcome back, {user?.name || 'System Admin'}.</h1>
          <p>
            StockOS is ready to help you manage stock, teams, and permissions from a single place.
            Start with the essentials and discover the insights that keep your warehouse running smoothly.
          </p>

          <div className="hero-cta">
            <Link to="/team" className="btn btn-primary">
              <UserCheck size={16} /> Manage Team
            </Link>
            <button className="btn btn-ghost" type="button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
              <Boxes size={16} /> Explore Dashboard
            </button>
          </div>

          <div className="hero-meta">
            <div className="meta-pill">
              <span>Role</span>
              <strong>{user?.role_name || 'Admin'}</strong>
            </div>
            <div className="meta-pill">
              <span>Workspace</span>
              <strong>Central Warehouse</strong>
            </div>
            <div className="meta-pill">
              <span>Permissions</span>
              <strong>{permissions.length} active</strong>
            </div>
          </div>
        </div>

        <div className="hero-artwork">
          <div className="artwork-card">
            <div className="artwork-grid">
              <div className="artwork-block large accent" />
              <div className="artwork-block" />
              <div className="artwork-block accent" />
              <div className="artwork-block" />
              <div className="artwork-block" />
              <div className="artwork-block accent" />
            </div>
            <div className="artwork-badge">
              <Sparkles size={16} /> Live inventory status
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card card-highlight highlight-strong">
          <div className="card-header">
            <div>
              <p className="card-label">Your role</p>
              <h2>{user?.role_name || 'Administrator'}</h2>
            </div>
            <ShieldCheck size={24} />
          </div>
          <p>Permissions are preloaded and the interface adapts to your access level. Use the sidebar to move quickly through the ERP.</p>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <p className="card-label">Quick start</p>
              <h2>Go to Team</h2>
            </div>
            <ArrowRight size={24} />
          </div>
          <p>Visit the team page to review users, update roles, and keep your operations aligned with current warehouse capacity.</p>
        </div>
      </div>
    </div>
  );
}
