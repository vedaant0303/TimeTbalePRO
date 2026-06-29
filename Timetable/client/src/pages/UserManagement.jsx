import { useState, useEffect } from 'react';
import api from '../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: 'password123', role: 'faculty',
    department: '', phone: '', employeeId: ''
  });

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    try {
      const dRes = await api.get('/departments');
      setDepartments(dRes.data);
      await fetchUsers();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const params = roleFilter ? `?role=${roleFilter}` : '';
      const res = await api.get(`/users${params}`);
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      return showToast('Name and email are required', 'error');
    }
    if (!form.password || form.password.length < 6) {
      return showToast('Password must be at least 6 characters', 'error');
    }
    try {
      await api.post('/users', form);
      showToast(`User "${form.name}" created successfully!`);
      fetchUsers();
      setShowForm(false);
      setForm({ name: '', email: '', password: 'password123', role: 'faculty', department: '', phone: '', employeeId: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Error creating user', 'error');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      showToast('User deactivated');
      fetchUsers();
    } catch (err) {
      showToast('Failed to deactivate', 'error');
    }
  };

  const handleActivate = async (id) => {
    if (!confirm('Reactivate this user?')) return;
    try {
      await api.put(`/users/${id}/reactivate`);
      showToast('User reactivated successfully!');
      fetchUsers();
    } catch (err) {
      showToast('Failed to reactivate', 'error');
    }
  };

  const handleResetPassword = async (userId, email) => {
    if (!confirm(`Reset password for ${email} to "password123"?`)) return;
    try {
      await api.put(`/users/${userId}`, { resetPassword: 'password123' });
      showToast(`Password reset for ${email}`);
    } catch (err) {
      showToast('Failed to reset password', 'error');
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  const roles = ['principal', 'dean', 'hod', 'coordinator', 'faculty', 'student', 'admin'];

  return (
    <div className="animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">User Management</div>
            <div className="card-subtitle">{users.length} users registered</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ Add User</button>
        </div>

        <div className="tabs" style={{ marginBottom: '16px' }}>
          <button className={`tab ${roleFilter === '' ? 'active' : ''}`} onClick={() => setRoleFilter('')}>All</button>
          {roles.map(r => (
            <button key={r} className={`tab ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(r)} style={{ textTransform: 'capitalize' }}>{r}</button>
          ))}
        </div>

        {showForm && (
          <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid rgba(99,102,241,0.15)' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-300)' }}>Create New User</h4>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="e.g. Dr. John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" className="form-input" placeholder="e.g. john@vcet.edu.in" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="text" className="form-input" placeholder="Min 6 characters" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Default: password123</span>
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">None</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input className="form-input" placeholder="Optional" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="Optional" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>Create User</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Employee ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} style={!u.isActive ? { opacity: 0.6 } : {}}>
                  <td><span style={{ fontWeight: '600' }}>{u.name}</span></td>
                  <td style={{ fontSize: '12px' }}>{u.email}</td>
                  <td><span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                  <td>{u.department?.code || u.department?.name || '-'}</td>
                  <td>{u.employeeId || '-'}</td>
                  <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {u.isActive ? (
                        <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={() => handleDeactivate(u._id)}>Deactivate</button>
                      ) : (
                        <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={() => handleActivate(u._id)}>Activate</button>
                      )}
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={() => handleResetPassword(u._id, u.email)}>Reset Pwd</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
