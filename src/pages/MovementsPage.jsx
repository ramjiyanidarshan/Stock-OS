import React, { useEffect, useState, useCallback } from 'react';
import { getMovements, getLocations } from '../services/api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_BADGE = {
  stock_in: 'badge-green',
  stock_out: 'badge-red',
  adjustment: 'badge-amber',
  transfer: 'badge-cyan',
};
const TYPE_LABEL = {
  stock_in: '▼ Stock In',
  stock_out: '▲ Stock Out',
  adjustment: '⟺ Adjust',
  transfer: '→ Transfer',
};

export default function MovementsPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    sku: '', batch_number: '', movement_type: '', location_id: '', from_date: '', to_date: '', page: 1, limit: 30,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mv, locs] = await Promise.all([getMovements(filters), getLocations()]);
      setData(mv.data.data);
      setTotal(mv.data.total);
      setPages(mv.data.pages);
      setLocations(locs.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setPage = (p) => setFilters(f => ({ ...f, page: p }));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Audit Trail</div>
          <div className="page-subtitle">Immutable log of all stock movements</div>
        </div>
        <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: 'var(--text-muted)' }}>
          {total} records
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">SKU / Product</label>
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input className="form-control" placeholder="Search SKU..." value={filters.sku}
                  onChange={e => setFilters(f => ({ ...f, sku: e.target.value, page: 1 }))} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label">Batch Number</label>
              <input className="form-control" placeholder="BATCH-..." value={filters.batch_number}
                onChange={e => setFilters(f => ({ ...f, batch_number: e.target.value, page: 1 }))} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label className="form-label">Type</label>
              <select className="form-control" value={filters.movement_type}
                onChange={e => setFilters(f => ({ ...f, movement_type: e.target.value, page: 1 }))}>
                <option value="">All Types</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="adjustment">Adjustment</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="form-label">Location</label>
              <select className="form-control" value={filters.location_id}
                onChange={e => setFilters(f => ({ ...f, location_id: e.target.value, page: 1 }))}>
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="form-label">From Date</label>
              <input type="date" className="form-control" value={filters.from_date}
                onChange={e => setFilters(f => ({ ...f, from_date: e.target.value, page: 1 }))} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label className="form-label">To Date</label>
              <input type="date" className="form-control" value={filters.to_date}
                onChange={e => setFilters(f => ({ ...f, to_date: e.target.value, page: 1 }))} />
            </div>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading-screen" style={{ height: 300 }}><div className="spinner" /></div>
          ) : data.length === 0 ? (
            <div className="empty-state"><p>No movement records found</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Batch</th>
                    <th>From → To</th>
                    <th>Qty</th>
                    <th>Opening</th>
                    <th>Closing</th>
                    <th>Ref #</th>
                    <th>Reason</th>
                    <th>By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(m => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono', fontSize: 11 }}>{m.id}</td>
                      <td><span className={`badge ${TYPE_BADGE[m.movement_type] || 'badge-gray'}`}>{TYPE_LABEL[m.movement_type] || m.movement_type}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.product_name}</div>
                        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--text-muted)' }}>{m.sku}</div>
                      </td>
                      <td>
                        {m.batch_number ? (
                          <div>
                            <span className="mono" style={{ fontSize: 12 }}>{m.batch_number}</span>
                            {m.expiry_date && <div style={{ fontSize: 10, color: 'var(--accent-amber)' }}>Exp: {m.expiry_date}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {m.from_location_name && <span style={{ color: 'var(--accent-red)' }}>{m.from_location_name}</span>}
                        {m.from_location_name && m.to_location_name && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>}
                        {m.to_location_name && <span style={{ color: 'var(--accent-green)' }}>{m.to_location_name}</span>}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'Space Mono', fontWeight: 700, fontSize: 13,
                          color: m.movement_type === 'stock_in' ? 'var(--accent-green)' : m.movement_type === 'stock_out' ? 'var(--accent-red)' : 'var(--accent-amber)'
                        }}>
                          {m.movement_type === 'stock_in' ? '+' : m.movement_type === 'stock_out' ? '-' : '±'}
                          {parseFloat(m.quantity_in_purchase_unit).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'Space Mono', fontSize: 12, color: 'var(--text-muted)' }}>{parseFloat(m.opening_balance).toFixed(2)}</td>
                      <td style={{ fontFamily: 'Space Mono', fontSize: 12, fontWeight: 700 }}>{parseFloat(m.closing_balance).toFixed(2)}</td>
                      <td style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--text-muted)' }}>{m.reference_number || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160 }}>
                        <span title={m.reason}>{m.reason?.length > 30 ? m.reason.substring(0, 30) + '…' : m.reason || '—'}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.performed_by_name}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(m.performed_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination">
              <span className="page-info">Page {filters.page} of {pages} ({total} records)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(filters.page - 1)} disabled={filters.page <= 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === filters.page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(filters.page + 1)} disabled={filters.page >= pages}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
