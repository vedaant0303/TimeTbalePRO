import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', employeeId: ''
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        employeeId: user.employeeId || ''
      });
    }
  }, [user]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleProfileUpdate = async () => {
    if (!form.name.trim()) return showToast('Name is required', 'error');
    setLoading(true);
    try {
      const res = await api.put(`/users/${user._id}`, {
        name: form.name,
        phone: form.phone,
        employeeId: form.employeeId
      });
      // Update local auth state
      if (setUser) setUser(prev => ({ ...prev, name: form.name, phone: form.phone, employeeId: form.employeeId }));
      showToast('Profile updated successfully!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally { setLoading(false); }
  };

  const handlePasswordChange = async () => {
    if (!passwords.newPassword || passwords.newPassword.length < 6) {
      return showToast('New password must be at least 6 characters', 'error');
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return showToast('Passwords do not match', 'error');
    }
    setLoading(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      showToast('Password changed successfully!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 640, margin: '0 auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Edit Profile</div>
            <div className="card-subtitle">Update your personal information</div>
          </div>
        </div>

        {/* User Identity */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          padding: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-400), var(--accent-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#fff'
          }}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
            <span className="badge badge-primary" style={{ marginTop: 4, textTransform: 'capitalize' }}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={form.email} disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Email cannot be changed</span>
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="Optional" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="Optional" value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-primary" onClick={handleProfileUpdate} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Change Password</div>
            <div className="card-subtitle">Update your login credentials</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" placeholder="Enter current password"
              value={passwords.currentPassword}
              onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" placeholder="Min 6 characters"
                value={passwords.newPassword}
                onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" placeholder="Repeat new password"
                value={passwords.confirmPassword}
                onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-primary" onClick={handlePasswordChange} disabled={loading}>
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
