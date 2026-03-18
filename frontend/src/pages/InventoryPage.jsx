import React, { useEffect, useState, useCallback } from 'react';
import { getInventoryOverview, getLocations, getCategories } from '../services/api';
import { Search, Filter, RefreshCw, AlertTriangle } from 'lucide-react';

const LocationTypeBadge = ({ type }) => {
  const map = { storage: 'badge-blue', damaged: 'badge-red', transit: 'badge-amber', quarantine: 'badge-purple' };
  return <span className={`badge ${map[type] || 'badge-gray'}`}>{type}</span>;
};

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [totalValuation, setTotalValuation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sku: '', location_id: '', category_id: '', low_stock_only: false });
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, low_stock_only: filters.low_stock_only ? 'true' : undefined };
      const [inv, locs, cats] = await Promise.all([
        getInventoryOverview(params),
        getLocations(),
        getCategories(),
      ]);
      setRows(inv.data.data);
      setTotalValuation(inv.data.totalValuation);
      setLocations(locs.data);
      setCategories(cats.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0);

  // Group by product for display
  const grouped = rows.reduce((acc, r) => {
    if (!acc[r.product_id]) {
      acc[r.product_id] = {
        product_id: r.product_id,
        product_name: r.product_name,
        sku: r.sku,
        category_name: r.category_name,
        reorder_point: r.reorder_point,
        purchase_unit: r.purchase_unit,
        totalQty: 0,
        totalVal: 0,
        locations: [],
      };
    }
    acc[r.product_id].totalQty += parseFloat(r.quantity);
    acc[r.product_id].totalVal += parseFloat(r.valuation);
    acc[r.product_id].locations.push(r);
    return acc;
  }, {});
  const products = Object.values(grouped);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Overview</div>
          <div className="page-subtitle">Real-time inventory across all locations</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', borderRadius: 8, padding: '8px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--accent-green)', marginBottom: 2 }}>TOTAL VALUATION</div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 16, fontWeight: 700, color: 'var(--accent-green)' }}>₹{fmt(totalValuation)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Search SKU / Name</label>
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input className="form-control" placeholder="Search..." value={filters.sku}
                  onChange={e => setFilters(p => ({ ...p, sku: e.target.value }))} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Location</label>
              <select className="form-control" value={filters.location_id}
                onChange={e => setFilters(p => ({ ...p, location_id: e.target.value }))}>
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Category</label>
              <select className="form-control" value={filters.category_id}
                onChange={e => setFilters(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
              <input type="checkbox" id="lowstock" checked={filters.low_stock_only}
                onChange={e => setFilters(p => ({ ...p, low_stock_only: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--accent-amber)' }} />
              <label htmlFor="lowstock" style={{ fontSize: 13, color: 'var(--accent-amber)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Low Stock Only
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ height: 300 }}><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="card"><div className="empty-state"><p>No inventory found. Perform a Stock-In operation to add stock.</p></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map(p => {
              const isLow = p.totalQty <= parseFloat(p.reorder_point);
              return (
                <div key={p.product_id} className="card" style={{ borderColor: isLow ? 'var(--accent-amber)' : 'var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{p.product_name}</span>
                        {isLow && <span className="badge badge-amber"><AlertTriangle size={10} style={{ marginRight: 3 }} />LOW STOCK</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sku}</span>
                        {p.category_name && <span className="badge badge-gray">{p.category_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Space Mono', fontSize: 20, fontWeight: 700, color: isLow ? 'var(--accent-amber)' : 'var(--accent-blue)' }}>
                        {fmt(p.totalQty)} <span style={{ fontSize: 13 }}>{p.purchase_unit}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Valuation: <span style={{ color: 'var(--accent-green)', fontFamily: 'Space Mono' }}>₹{fmt(p.totalVal)}</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reorder at: {fmt(p.reorder_point)} {p.purchase_unit}</div>
                    </div>
                  </div>

                  {/* Location breakdown */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.locations.map((loc, i) => (
                      <div key={i} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '8px 12px', minWidth: 160, flex: '1 1 160px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <LocationTypeBadge type={loc.location_type} />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{loc.location_name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loc.warehouse_name}</div>
                        {loc.batch_number && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Batch: <span className="mono">{loc.batch_number}</span>
                            {loc.expiry_date && <span style={{ color: 'var(--accent-amber)', marginLeft: 6 }}>Exp: {loc.expiry_date}</span>}
                          </div>
                        )}
                        <div style={{ fontFamily: 'Space Mono', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                          {fmt(loc.quantity)} {p.purchase_unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
