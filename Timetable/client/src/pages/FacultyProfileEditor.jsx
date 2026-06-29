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

  useEffect(() => { init(); }, []);

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
      alert('Profile updated!');
      init();
    } catch (err) { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  const filtered = faculty.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="faculty-profile-page">
      <div className="page-header">
        <h1>Faculty Profile Editor</h1>
        <input className="search-input" placeholder="Search faculty..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="profile-layout">
        {/* Faculty List */}
        <div className="faculty-list-panel">
          {filtered.map(f => (
            <div key={f._id} className={`faculty-card ${selected?._id === f._id ? 'active' : ''}`}
              onClick={() => setSelected({ ...f })}>
              <div className="fc-avatar">{f.name?.[0]?.toUpperCase()}</div>
              <div className="fc-info">
                <strong>{f.name}</strong>
                <span>{f.email}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Panel */}
        {selected && (
          <div className="profile-edit-panel">
            <h2>Edit: {selected.name}</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input value={selected.name || ''} onChange={e => setSelected(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={selected.email || ''} onChange={e => setSelected(s => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={selected.phone || ''} onChange={e => setSelected(s => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={selected.role || 'faculty'} onChange={e => setSelected(s => ({ ...s, role: e.target.value }))}>
                  <option value="faculty">Faculty</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="hod">HOD</option>
                  <option value="admin">Admin</option>
                  <option value="principal">Principal</option>
                </select>
              </div>
              <div className="form-group">
                <label>Department</label>
                <select value={selected.department || ''} onChange={e => setSelected(s => ({ ...s, department: e.target.value }))}>
                  <option value="">— Select —</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Max Weekly Hours</label>
                <input type="number" value={selected.maxWeeklyHours || 20} onChange={e => setSelected(s => ({ ...s, maxWeeklyHours: parseInt(e.target.value) }))} />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {!selected && (
          <div className="empty-edit-panel">
            <p>Select a faculty member to edit their profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}
