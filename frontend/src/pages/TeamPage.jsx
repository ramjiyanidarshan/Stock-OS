import React, { useEffect, useState, useCallback } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, ShieldCheck, X } from 'lucide-react';

const ROLE_BADGE = { admin: 'badge-purple', warehouse_user: 'badge-blue', viewer: 'badge-gray' };

export default function TeamPage() {
  const { can, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const u = await getUsers();
    console.log(u);
    setUsers(u.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setForm({ name: '', email: '', password: '', role_id: '', department: '' }) || setModal('form');
  const openEdit = (u) => setForm({ ...u, password: '' }) || setModal('form');

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form.id) { await updateUser(form.id, form); toast.success('User updated'); }
      else { await createUser(form); toast.success('User created'); }
      setModal(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (id === me?.id) return toast.error('Cannot deactivate yourself');
    if (!window.confirm('Deactivate this user?')) return;
    try { await deleteUser(id); toast.success('User deactivated'); load(); }
    catch (e) { toast.error(e.response?.data?.error || e.message); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Team Members</div>
          <div className="page-subtitle">Manage users and departmental access</div>
        </div>
        {can('team.write') && (
          <button className="btn btn-primary" onClick={openCreate}><Plus size={15} />Add Member</button>
        )}
      </div>

      <div className="page-body">
        {/* Roles reference */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* {roles.map(r => (
            <div key={r.id} className="card" style={{ flex: '1 1 220px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShieldCheck size={14} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{r.name.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {r.permissions.map(p => (
                  <span key={p} className="badge badge-gray" style={{ fontSize: 10 }}>{p}</span>
                ))}
              </div>
            </div>
          ))} */}
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {users && users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{u.name?.[0]?.toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          {u.id === me?.id && <div style={{ fontSize: 10, color: 'var(--accent-blue)' }}>You</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[u.role_name] || 'badge-gray'}`}>{u.role_name?.replace('_', ' ')}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.department || '—'}</td>
                    <td><span className="badge badge-green">Active</span></td>
                    <td>
                      {/* {can('team.write') && ( */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Edit size={13} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>
                        </div>
                      {/* )} */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal === 'form' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{form.id ? 'Edit User' : 'Add Team Member'}</div>
              <button className="modal-close" onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Full Name *</label>
                  <input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group"><label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group"><label className="form-label">{form.id ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                  <input type="password" className="form-control" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="form-group"><label className="form-label">Role *</label>
                  <select className="form-control" value={form.role_id || ''} onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}>
                    <option value="">Select Role</option>
                    {/* {roles.map(r => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)} */}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Department</label>
                  <input className="form-control" placeholder="Warehouse, Procurement..." value={form.department || ''} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
