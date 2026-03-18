import React, { useEffect, useState } from 'react';
import { getDashboardStats, getAlerts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Package, TrendingUp, TrendingDown, AlertTriangle, DollarSign, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'Space Mono' }}>{p.name}: {parseFloat(p.value).toFixed(2)}</div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([getDashboardStats(), getAlerts()]);
      setStats(s.data);
      setAlerts(a.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const trendData = (stats?.movementTrend || []).map(d => ({
    date: format(parseISO(d.date), 'MMM d'),
    'Stock In': parseFloat(d.stock_in || 0),
    'Stock Out': parseFloat(d.stock_out || 0),
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Welcome back, {user?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="page-body">
        {/* KPI Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><Package size={18} /></div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{fmt(stats?.totalProducts)}</div>
              <div className="stat-label">Active Products</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><TrendingUp size={18} /></div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{fmt(stats?.todayStockIn)}</div>
              <div className="stat-label">Today's Stock In</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><TrendingDown size={18} /></div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{fmt(stats?.todayStockOut)}</div>
              <div className="stat-label">Today's Stock Out</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><AlertTriangle size={18} /></div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>{fmt(stats?.lowStockAlerts)}</div>
              <div className="stat-label">Low Stock Alerts</div>
            </div>
          </div>
          <div className="stat-card" style={{ gridColumn: 'span 1' }}>
            <div className="stat-icon green"><DollarSign size={18} /></div>
            <div>
              <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: 18 }}>₹{fmt(stats?.totalValuation)}</div>
              <div className="stat-label">Inventory Valuation</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-grid" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Stock Movement — Last 7 Days</div>
            </div>
            {trendData.length === 0 ? (
              <div className="empty-state"><p>No movement data yet</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3fb950" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3fb950" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f85149" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Stock In" stroke="#3fb950" fill="url(#gIn)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Stock Out" stroke="#f85149" fill="url(#gOut)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Daily Comparison</div>
            </div>
            {trendData.length === 0 ? (
              <div className="empty-state"><p>No movement data yet</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Stock In" fill="#3fb950" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Stock Out" fill="#f85149" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">⚠ Active Low-Stock Alerts</div>
              <span className="badge badge-red">{alerts.length}</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Current Qty</th>
                    <th>Reorder Point</th>
                    <th>Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 10).map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.product_name}</strong></td>
                      <td><span className="mono" style={{ fontSize: 12 }}>{a.sku}</span></td>
                      <td>{a.category_name || '—'}</td>
                      <td><span style={{ color: 'var(--accent-red)', fontFamily: 'Space Mono', fontWeight: 700 }}>{parseFloat(a.current_qty).toFixed(2)}</span></td>
                      <td><span style={{ fontFamily: 'Space Mono' }}>{parseFloat(a.reorder_point).toFixed(2)}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(a.triggered_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
