import React, { useEffect, useState } from 'react';
import { getProducts, getLocations, getUnits, stockIn, stockOut, stockAdjust, stockTransfer } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ArrowRightLeft } from 'lucide-react';

const TABS = [
  { key: 'in', label: 'Stock In', icon: ArrowDownCircle, color: 'var(--accent-green)' },
  { key: 'out', label: 'Stock Out', icon: ArrowUpCircle, color: 'var(--accent-red)' },
  { key: 'adjust', label: 'Adjustment', icon: SlidersHorizontal, color: 'var(--accent-amber)' },
  { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft, color: 'var(--accent-cyan)' },
];

export default function StockOperationsPage() {
  const [tab, setTab] = useState('in');
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  // Stock In form
  const [inForm, setInForm] = useState({ productId: '', batchData: { batch_number: '', manufacture_date: '', expiry_date: '' }, locationId: '', quantity: '', unitId: '', unitPrice: '', referenceNumber: '', reason: '' });
  // Stock Out
  const [outForm, setOutForm] = useState({ productId: '', locationId: '', quantity: '', unitId: '', referenceNumber: '', reason: '' });
  // Adjust
  const [adjForm, setAdjForm] = useState({ productId: '', locationId: '', batchId: '', newQuantity: '', reason: '' });
  // Transfer
  const [trfForm, setTrfForm] = useState({ productId: '', batchId: '', fromLocationId: '', toLocationId: '', quantity: '', reason: '' });

  const [productBatches, setProductBatches] = useState([]);

  useEffect(() => {
    Promise.all([getProducts({ limit: 500 }), getLocations(), getUnits()]).then(([p, l, u]) => {
      setProducts(p.data.data);
      setLocations(l.data);
      setUnits(u.data);
    });
  }, []);

  const loadBatches = async (productId, setter) => {
    if (!productId) return;
    const p = products.find(pr => pr.id == productId);
    // Batches loaded via product detail - for simplicity we let user type batch for in, and select for out/adjust
    setter(p?.batches || []);
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (tab === 'in') {
        await stockIn({
          productId: parseInt(inForm.productId),
          batchData: inForm.batchData,
          locationId: parseInt(inForm.locationId),
          quantity: parseFloat(inForm.quantity),
          unitId: parseInt(inForm.unitId),
          unitPrice: parseFloat(inForm.unitPrice) || undefined,
          referenceNumber: inForm.referenceNumber,
          reason: inForm.reason,
        });
        toast.success('Stock In recorded successfully');
        setInForm({ productId: '', batchData: { batch_number: '', manufacture_date: '', expiry_date: '' }, locationId: '', quantity: '', unitId: '', unitPrice: '', referenceNumber: '', reason: '' });
      } else if (tab === 'out') {
        await stockOut({
          productId: parseInt(outForm.productId),
          locationId: parseInt(outForm.locationId),
          quantity: parseFloat(outForm.quantity),
          unitId: parseInt(outForm.unitId),
          referenceNumber: outForm.referenceNumber,
          reason: outForm.reason,
        });
        toast.success('Stock Out recorded. FIFO applied.');
        setOutForm({ productId: '', locationId: '', quantity: '', unitId: '', referenceNumber: '', reason: '' });
      } else if (tab === 'adjust') {
        await stockAdjust({
          productId: parseInt(adjForm.productId),
          locationId: parseInt(adjForm.locationId),
          batchId: adjForm.batchId ? parseInt(adjForm.batchId) : null,
          newQuantity: parseFloat(adjForm.newQuantity),
          reason: adjForm.reason,
        });
        toast.success('Stock adjusted with audit trail created');
        setAdjForm({ productId: '', locationId: '', batchId: '', newQuantity: '', reason: '' });
      } else if (tab === 'transfer') {
        await stockTransfer({
          productId: parseInt(trfForm.productId),
          batchId: trfForm.batchId ? parseInt(trfForm.batchId) : null,
          fromLocationId: parseInt(trfForm.fromLocationId),
          toLocationId: parseInt(trfForm.toLocationId),
          quantity: parseFloat(trfForm.quantity),
          reason: trfForm.reason,
        });
        toast.success('Transfer completed successfully');
        setTrfForm({ productId: '', batchId: '', fromLocationId: '', toLocationId: '', quantity: '', reason: '' });
      }
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const curTab = TABS.find(t => t.key === tab);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Operations</div>
          <div className="page-subtitle">Record movements with full audit trail</div>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="btn" style={{
                background: tab === t.key ? 'var(--bg-elevated)' : 'transparent',
                border: `1px solid ${tab === t.key ? t.color : 'var(--border)'}`,
                color: tab === t.key ? t.color : 'var(--text-secondary)',
              }}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ maxWidth: 640, borderColor: curTab.color }}>
          <div className="card-header">
            <div className="card-title" style={{ color: curTab.color, display: 'flex', alignItems: 'center', gap: 8 }}>
              <curTab.icon size={16} />{curTab.label} Operation
            </div>
          </div>

          {/* STOCK IN */}
          {tab === 'in' && (
            <div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={inForm.productId}
                    onChange={e => setInForm(p => ({ ...p, productId: e.target.value }))}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <select className="form-control" value={inForm.locationId}
                    onChange={e => setInForm(p => ({ ...p, locationId: e.target.value }))}>
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch Details</div>
                <div className="form-grid-3">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Batch Number *</label>
                    <input className="form-control" placeholder="BATCH-001" value={inForm.batchData.batch_number}
                      onChange={e => setInForm(p => ({ ...p, batchData: { ...p.batchData, batch_number: e.target.value } }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mfg Date</label>
                    <input type="date" className="form-control" value={inForm.batchData.manufacture_date}
                      onChange={e => setInForm(p => ({ ...p, batchData: { ...p.batchData, manufacture_date: e.target.value } }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-control" value={inForm.batchData.expiry_date}
                      onChange={e => setInForm(p => ({ ...p, batchData: { ...p.batchData, expiry_date: e.target.value } }))} />
                  </div>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" className="form-control" placeholder="0.00" min="0" step="0.01" value={inForm.quantity}
                    onChange={e => setInForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select className="form-control" value={inForm.unitId}
                    onChange={e => setInForm(p => ({ ...p, unitId: e.target.value }))}>
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input type="number" className="form-control" placeholder="0.00" min="0" step="0.01" value={inForm.unitPrice}
                    onChange={e => setInForm(p => ({ ...p, unitPrice: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference No.</label>
                  <input className="form-control" placeholder="PO-2024-001" value={inForm.referenceNumber}
                    onChange={e => setInForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Notes</label>
                <input className="form-control" placeholder="Purchase receipt from supplier..." value={inForm.reason}
                  onChange={e => setInForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
          )}

          {/* STOCK OUT */}
          {tab === 'out' && (
            <div>
              <div style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--accent-red)' }}>
                ⚡ FIFO applied automatically — oldest batches deducted first
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={outForm.productId}
                    onChange={e => setOutForm(p => ({ ...p, productId: e.target.value }))}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">From Location *</label>
                  <select className="form-control" value={outForm.locationId}
                    onChange={e => setOutForm(p => ({ ...p, locationId: e.target.value }))}>
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" className="form-control" placeholder="0.00" min="0" step="0.01" value={outForm.quantity}
                    onChange={e => setOutForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select className="form-control" value={outForm.unitId}
                    onChange={e => setOutForm(p => ({ ...p, unitId: e.target.value }))}>
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference No.</label>
                  <input className="form-control" placeholder="INV-2024-001" value={outForm.referenceNumber}
                    onChange={e => setOutForm(p => ({ ...p, referenceNumber: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <input className="form-control" placeholder="Sales dispatch / Usage..." value={outForm.reason}
                  onChange={e => setOutForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
          )}

          {/* ADJUSTMENT */}
          {tab === 'adjust' && (
            <div>
              <div style={{ background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--accent-amber)' }}>
                🔒 Stock Adjustments are immutable — a permanent audit log entry will be created with opening and closing balance
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={adjForm.productId}
                    onChange={e => setAdjForm(p => ({ ...p, productId: e.target.value }))}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <select className="form-control" value={adjForm.locationId}
                    onChange={e => setAdjForm(p => ({ ...p, locationId: e.target.value }))}>
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">New Quantity *</label>
                  <input type="number" className="form-control" placeholder="Exact count after physical check" min="0" step="0.01" value={adjForm.newQuantity}
                    onChange={e => setAdjForm(p => ({ ...p, newQuantity: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason * (min 5 characters)</label>
                <input className="form-control" placeholder="Physical count discrepancy found during audit..." value={adjForm.reason}
                  onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
          )}

          {/* TRANSFER */}
          {tab === 'transfer' && (
            <div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={trfForm.productId}
                    onChange={e => setTrfForm(p => ({ ...p, productId: e.target.value }))}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" className="form-control" placeholder="0.00" min="0" step="0.01" value={trfForm.quantity}
                    onChange={e => setTrfForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">From Location *</label>
                  <select className="form-control" value={trfForm.fromLocationId}
                    onChange={e => setTrfForm(p => ({ ...p, fromLocationId: e.target.value }))}>
                    <option value="">Select Source</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">To Location *</label>
                  <select className="form-control" value={trfForm.toLocationId}
                    onChange={e => setTrfForm(p => ({ ...p, toLocationId: e.target.value }))}>
                    <option value="">Select Destination</option>
                    {locations.filter(l => l.id != trfForm.fromLocationId).map(l => <option key={l.id} value={l.id}>{l.warehouse_name} — {l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input className="form-control" placeholder="Moving to damaged goods store / transit..." value={trfForm.reason}
                  onChange={e => setTrfForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
          )}

          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn" onClick={submit} disabled={loading}
              style={{ background: curTab.color, color: tab === 'adjust' ? '#000' : '#fff', border: 'none', padding: '10px 28px' }}>
              <curTab.icon size={15} />
              {loading ? 'Processing...' : `Submit ${curTab.label}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
