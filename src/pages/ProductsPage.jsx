import React, { useEffect, useState, useCallback } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, getUnits } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, X } from 'lucide-react';

const EMPTY = { name: '', sku: '', description: '', category_id: '', purchase_unit_id: '', sale_unit_id: '', purchase_price: '', reorder_point: '', track_batches: true, track_expiry: false };

export default function ProductsPage() {
  const { can } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, u] = await Promise.all([getProducts({ search, page, limit: 20 }), getCategories(), getUnits()]);
      setProducts(p.data.data);
      setTotal(p.data.total);
      setCategories(c.data);
      setUnits(u.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (p) => { setForm({ ...p, category_id: p.category_id || '', purchase_unit_id: p.purchase_unit_id || '', sale_unit_id: p.sale_unit_id || '' }); setModal('edit'); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await createProduct(form);
        toast.success('Product created');
      } else {
        await updateProduct(form.id, form);
        toast.success('Product updated');
      }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Archive this product?')) return;
    try { await deleteProduct(id); toast.success('Product archived'); load(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-subtitle">{total} active products</div>
        </div>
        {can('products.write') && (
          <button className="btn btn-primary" onClick={openCreate}><Plus size={15} />New Product</button>
        )}
      </div>

      <div className="page-body">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="search-input-wrap">
            <Search size={14} className="search-icon" />
            <input className="form-control" placeholder="Search by name or SKU..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <div className="card">
          {loading ? <div className="loading-screen" style={{ height: 200 }}><div className="spinner" /></div> :
            products.length === 0 ? <div className="empty-state"><p>No products found</p></div> : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Purchase Unit</th>
                      <th>Sale Unit</th>
                      <th>Price (₹)</th>
                      <th>Reorder Pt.</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td><span className="mono" style={{ fontSize: 12 }}>{p.sku}</span></td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.category_name ? <span className="badge badge-gray">{p.category_name}</span> : '—'}</td>
                        <td>{p.purchase_unit_abbr || '—'}</td>
                        <td>{p.sale_unit_abbr || '—'}</td>
                        <td style={{ fontFamily: 'Space Mono', fontSize: 13 }}>₹{parseFloat(p.purchase_price || 0).toFixed(2)}</td>
                        <td style={{ fontFamily: 'Space Mono', fontSize: 13 }}>{parseFloat(p.reorder_point || 0).toFixed(2)}</td>
                        <td>{p.track_batches ? <span className="badge badge-blue">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                        <td>{p.track_expiry ? <span className="badge badge-amber">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {can('products.write') && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Edit size={13} /></button>}
                            {can('products.write') && <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'New Product' : 'Edit Product'}</div>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-control" placeholder="PROD-001" value={form.sku}
                    onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-control" placeholder="Product Name" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-control" value={form.category_id}
                    onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Unit</label>
                  <select className="form-control" value={form.purchase_unit_id}
                    onChange={e => setForm(p => ({ ...p, purchase_unit_id: e.target.value }))}>
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sale Unit</label>
                  <select className="form-control" value={form.sale_unit_id}
                    onChange={e => setForm(p => ({ ...p, sale_unit_id: e.target.value }))}>
                    <option value="">Same as purchase</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹)</label>
                  <input type="number" className="form-control" placeholder="0.00" min="0" step="0.01" value={form.purchase_price}
                    onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Point</label>
                  <input type="number" className="form-control" placeholder="0" min="0" step="0.01" value={form.reorder_point}
                    onChange={e => setForm(p => ({ ...p, reorder_point: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-control" placeholder="Optional description" value={form.description || ''}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.track_batches} onChange={e => setForm(p => ({ ...p, track_batches: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }} />
                  Track Batch Numbers
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.track_expiry} onChange={e => setForm(p => ({ ...p, track_expiry: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-amber)', width: 16, height: 16 }} />
                  Track Expiry Dates
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'create' ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
