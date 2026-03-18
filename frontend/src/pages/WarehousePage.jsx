import React, { useEffect, useState, useCallback } from 'react';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, getLocations, createLocation } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, MapPin, X, Building2 } from 'lucide-react';

const LOC_TYPES = ['storage', 'transit', 'damaged', 'quarantine'];

export default function WarehousePage() {
  const { can } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [tab, setTab] = useState('warehouses');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [w, l] = await Promise.all([getWarehouses(), getLocations()]);
    setWarehouses(w.data);
    setLocations(l.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWarehouseSave = async () => {
    setSaving(true);
    try {
      if (form.id) { await updateWarehouse(form.id, form); toast.success('Warehouse updated'); }
      else { await createWarehouse(form); toast.success('Warehouse created'); }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const handleLocationSave = async () => {
    setSaving(true);
    try {
      await createLocation(form);
      toast.success('Location created');
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteWH = async (id) => {
    if (!window.confirm('Archive this warehouse?')) return;
    try { await deleteWarehouse(id); toast.success('Archived'); load(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  const locTypeColor = (type) => {
    const m = { storage: 'badge-blue', transit: 'badge-amber', damaged: 'badge-red', quarantine: 'badge-purple' };
    return m[type] || 'badge-gray';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Warehouses & Locations</div>
          <div className="page-subtitle">Manage physical and virtual storage locations</div>
        </div>
        {can('warehouse.write') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setForm({ type: 'storage', warehouse_id: warehouses[0]?.id || '' }); setModal('location'); }}>
              <MapPin size={15} />New Location
            </button>
            <button className="btn btn-primary" onClick={() => { setForm({}); setModal('warehouse'); }}>
              <Plus size={15} />New Warehouse
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        <div className="tabs">
          <button className={`tab-btn ${tab === 'warehouses' ? 'active' : ''}`} onClick={() => setTab('warehouses')}><Building2 size={14} style={{ marginRight: 6 }} />Warehouses ({warehouses.length})</button>
          <button className={`tab-btn ${tab === 'locations' ? 'active' : ''}`} onClick={() => setTab('locations')}><MapPin size={14} style={{ marginRight: 6 }} />Virtual Locations ({locations.length})</button>
        </div>

        {tab === 'warehouses' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {warehouses.map(w => (
              <div key={w.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{w.name}</div>
                    {w.address && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{w.address}</div>}
                    {w.manager_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Manager: {w.manager_name}</div>}
                  </div>
                  {can('warehouse.write') && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setForm(w); setModal('warehouse'); }}><Edit size={13} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteWH(w.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                {/* Locations for this warehouse */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Virtual Locations</div>
                  {locations.filter(l => l.warehouse_id === w.id).map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${locTypeColor(l.type)}`}>{l.type}</span>
                      <span style={{ fontSize: 13 }}>{l.name}</span>
                    </div>
                  ))}
                  {locations.filter(l => l.warehouse_id === w.id).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No locations yet</div>
                  )}
                </div>
              </div>
            ))}
            {warehouses.length === 0 && <div className="card"><div className="empty-state"><p>No warehouses yet</p></div></div>}
          </div>
        )}

        {tab === 'locations' && (
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Location</th><th>Type</th><th>Warehouse</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {locations.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.name}</strong></td>
                      <td><span className={`badge ${locTypeColor(l.type)}`}>{l.type}</span></td>
                      <td>{l.warehouse_name}</td>
                      <td><span className="badge badge-green">Active</span></td>
                    </tr>
                  ))}
                  {locations.length === 0 && <tr><td colSpan={4}><div className="empty-state"><p>No locations</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Warehouse Modal */}
      {modal === 'warehouse' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{form.id ? 'Edit Warehouse' : 'New Warehouse'}</div>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Warehouse Name *</label>
                <input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group"><label className="form-label">Address</label>
                <input className="form-control" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-group"><label className="form-label">Manager Name</label>
                <input className="form-control" value={form.manager_name || ''} onChange={e => setForm(p => ({ ...p, manager_name: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleWarehouseSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {modal === 'location' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">New Virtual Location</div>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Warehouse *</label>
                <select className="form-control" value={form.warehouse_id || ''} onChange={e => setForm(p => ({ ...p, warehouse_id: e.target.value }))}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Location Name *</label>
                <input className="form-control" placeholder="e.g. Main Store, Damaged Goods..." value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-control" value={form.type || 'storage'} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {LOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLocationSave} disabled={saving}>{saving ? 'Saving...' : 'Create Location'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
