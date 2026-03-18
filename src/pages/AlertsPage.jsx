import React, { useEffect, useState } from 'react';
import { getAlerts } from '../services/api';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await getAlerts(); setAlerts(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Low Stock Alerts</div>
          <div className="page-subtitle">Products below their reorder point</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} />Refresh</button>
      </div>
      <div className="page-body">
        {loading ? <div className="loading-screen" style={{ height: 200 }}><div className="spinner" /></div> :
          alerts.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <CheckCircle size={48} style={{ color: 'var(--accent-green)', opacity: 1, marginBottom: 12 }} />
                <p style={{ color: 'var(--accent-green)', fontSize: 16, fontWeight: 600 }}>All Clear!</p>
                <p style={{ marginTop: 4 }}>No products are below their reorder point.</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)', borderRadius: 8 }}>
                <AlertTriangle size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <span style={{ color: 'var(--accent-amber)', fontSize: 13, fontWeight: 600 }}>
                  {alerts.length} product{alerts.length !== 1 ? 's' : ''} require immediate restocking
                </span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Product</th><th>SKU</th><th>Category</th><th>Current Stock</th><th>Reorder Point</th><th>Deficit</th><th>Since</th></tr>
                  </thead>
                  <tbody>
                    {alerts.map(a => {
                      const deficit = parseFloat(a.reorder_point) - parseFloat(a.current_qty);
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.product_name}</strong></td>
                          <td><span className="mono" style={{ fontSize: 12 }}>{a.sku}</span></td>
                          <td>{a.category_name || '—'}</td>
                          <td><span style={{ fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent-red)', fontSize: 14 }}>{parseFloat(a.current_qty).toFixed(2)}</span></td>
                          <td><span style={{ fontFamily: 'Space Mono', fontSize: 13 }}>{parseFloat(a.reorder_point).toFixed(2)}</span></td>
                          <td><span style={{ fontFamily: 'Space Mono', fontWeight: 700, color: 'var(--accent-amber)', fontSize: 13 }}>-{deficit.toFixed(2)}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(a.triggered_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
    </>
  );
}
