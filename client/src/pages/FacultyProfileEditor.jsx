import { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/faculty-profile.css';

export default function FacultyProfileEditor() {
  const [faculty, setFaculty] = useState([]);
  const [selected, setSelected] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'faculty', department: '', maxWeeklyHours: 20,
    designation: ''
  });
  const [addError, setAddError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => { init(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const init = async () => {
    try {
      const [fRes, dRes, sRes] = await Promise.all([
        api.get('/users?role=faculty'),
        api.get('/departments'),
        api.get('/subjects')
      ]);
      setFaculty(fRes.data || []);
      setDepartments(dRes.data || []);
      setSubjects(sRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/users/${selected._id}`, selected);
      showToast('Profile updated successfully!');
      init();
    } catch (err) { showToast('Failed to save: ' + (err.response?.data?.message || err.message), 'error'); }
    finally { setSaving(false); }
  };

  const handleAddFaculty = async () => {
    setAddError('');
    if (!addForm.name.trim()) return setAddError('Name is required');
    if (!addForm.email.trim()) return setAddError('Email is required');
    if (!addForm.password || addForm.password.length < 6) return setAddError('Password must be at least 6 characters');
    if (!addForm.department) return setAddError('Department is required');

    try {
      setSaving(true);
      await api.post('/users', {
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        phone: addForm.phone.trim(),
        role: addForm.role,
        department: addForm.department,
        maxWeeklyHours: addForm.maxWeeklyHours,
        designation: addForm.designation
      });
      showToast(`Faculty "${addForm.name}" added successfully!`);
      setShowAddForm(false);
      setAddForm({ name: '', email: '', phone: '', password: '', role: 'faculty', department: '', maxWeeklyHours: 20, designation: '' });
      init();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add faculty');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}? They will no longer be able to login.`)) return;
    try {
      await api.delete(`/users/${id}`);
      showToast(`${name} deactivated`);
      if (selected?._id === id) setSelected(null);
      init();
    } catch (err) {
      showToast('Failed: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const filtered = faculty.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn" style={{ padding: 0 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600,
          maxWidth: 450, animation: 'fadeIn 0.3s'
        }}>{toast.msg}</div>
      )}

      {/* Page Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Faculty Profile Editor
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {faculty.length} faculty members · Manage profiles, roles, and departments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Search faculty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '8px 14px', fontSize: 13, width: 220,
              borderRadius: 8, border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)'
            }}
          />
          <button
            className="btn btn-primary"
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: 8
            }}
            onClick={() => { setShowAddForm(true); setSelected(null); }}
          >
            <span style={{ fontSize: 16 }}>+</span> Add Faculty
          </button>
        </div>
      </div>

      <div className="profile-layout" style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 20,
        minHeight: 500
      }}>
        {/* Faculty List Panel */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))',
            borderBottom: '1px solid var(--border-color)',
            fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>
            Faculty ({filtered.length})
          </div>
          <div style={{ overflow: 'auto', flex: 1, maxHeight: 600 }}>
            {filtered.map(f => {
              const deptName = typeof f.department === 'object' ? f.department?.code : departments.find(d => d._id === f.department)?.code;
              return (
                <div
                  key={f._id}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: '1px solid var(--border-color)',
                    background: selected?._id === f._id
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))'
                      : 'transparent',
                    borderLeft: selected?._id === f._id
                      ? '3px solid #6366f1'
                      : '3px solid transparent',
                    transition: 'all 0.15s'
                  }}
                  onClick={() => { setSelected({ ...f, department: typeof f.department === 'object' ? f.department?._id : f.department }); setShowAddForm(false); }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0
                  }}>
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                      whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'
                    }}>
                      {f.name}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'
                    }}>
                      {f.email}
                    </div>
                  </div>
                  {deptName && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 4, background: 'rgba(99,102,241,0.1)',
                      color: '#6366f1', flexShrink: 0
                    }}>
                      {deptName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Edit / Add / Empty */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: 24
        }}>
          {/* ═══ ADD NEW FACULTY FORM ═══ */}
          {showAddForm && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#6366f1' }}>
                    + Add New Faculty
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Create a new faculty account. They can login immediately.
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => { setShowAddForm(false); setAddError(''); }}
                >✕ Close</button>
              </div>

              {addError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444', fontSize: 13, fontWeight: 600
                }}>⚠️ {addError}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Full Name *</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.name}
                    onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Dr. John Doe"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Email *</label>
                  <input
                    className="form-input"
                    type="email"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.email}
                    onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="john.doe@vcet.edu.in"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Password *</label>
                  <input
                    className="form-input"
                    type="password"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.password}
                    onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Phone</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.phone}
                    onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Role *</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, width: '100%' }}
                    value={addForm.role}
                    onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                  >
                    <option value="faculty">Faculty</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="hod">HOD</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Department *</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, width: '100%' }}
                    value={addForm.department}
                    onChange={e => setAddForm(p => ({ ...p, department: e.target.value }))}
                  >
                    <option value="">— Select Department —</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Designation</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.designation}
                    onChange={e => setAddForm(p => ({ ...p, designation: e.target.value }))}
                    placeholder="Assistant Professor"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Max Weekly Hours</label>
                  <input
                    className="form-input"
                    type="number"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={addForm.maxWeeklyHours}
                    onChange={e => setAddForm(p => ({ ...p, maxWeeklyHours: parseInt(e.target.value) || 20 }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 20px', fontSize: 13, borderRadius: 8 }}
                  onClick={() => { setShowAddForm(false); setAddError(''); }}
                >Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '8px 24px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none'
                  }}
                  onClick={handleAddFaculty}
                  disabled={saving}
                >
                  {saving ? '⏳ Adding...' : '✓ Add Faculty'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ EDIT EXISTING FACULTY ═══ */}
          {selected && !showAddForm && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Edit: {selected.name}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Update profile information and role
                  </p>
                </div>
                <button
                  className="btn btn-sm"
                  style={{
                    padding: '4px 12px', fontSize: 11,
                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6
                  }}
                  onClick={() => handleDelete(selected._id, selected.name)}
                >
                  Deactivate
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Full Name</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={selected.name || ''}
                    onChange={e => setSelected(s => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Email</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={selected.email || ''}
                    onChange={e => setSelected(s => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Phone</label>
                  <input
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={selected.phone || ''}
                    onChange={e => setSelected(s => ({ ...s, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Role</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, width: '100%' }}
                    value={selected.role || 'faculty'}
                    onChange={e => setSelected(s => ({ ...s, role: e.target.value }))}
                  >
                    <option value="faculty">Faculty</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="hod">HOD</option>
                    <option value="admin">Admin</option>
                    <option value="principal">Principal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Department</label>
                  <select
                    className="form-select"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, width: '100%' }}
                    value={selected.department || ''}
                    onChange={e => setSelected(s => ({ ...s, department: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 700 }}>Max Weekly Hours</label>
                  <input
                    className="form-input"
                    type="number"
                    style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border-color)', width: '100%' }}
                    value={selected.maxWeeklyHours || 20}
                    onChange={e => setSelected(s => ({ ...s, maxWeeklyHours: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '8px 20px', fontSize: 13, borderRadius: 8 }}
                  onClick={() => setSelected(null)}
                >Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '8px 24px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                    background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none'
                  }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '⏳ Saving...' : '✓ Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ EMPTY STATE ═══ */}
          {!selected && !showAddForm && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', minHeight: 400, color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>👨‍🏫</div>
              <p style={{ fontSize: 15, fontWeight: 600 }}>Select a faculty member to edit</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Or click <strong>"+ Add Faculty"</strong> to create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
