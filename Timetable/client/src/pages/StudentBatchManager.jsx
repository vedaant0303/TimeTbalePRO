import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';

export default function StudentBatchManager() {
  const { user } = useAuth();
  const { departments } = useApp();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);

  const deptId = user?.department?._id || user?.department || '';

  const [deptFilter, setDeptFilter] = useState(deptId || '');
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', rollNumber: '', semester: 2, division: '1', batch: 'B1',
    department: '', password: 'student123'
  });

  useEffect(() => {
    fetchStudents();
  }, [semFilter, deptFilter]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      let url = '/users/students';
      const params = [];
      const effectiveDept = deptFilter || deptId;
      if (effectiveDept) params.push(`department=${effectiveDept}`);
      if (semFilter) params.push(`semester=${semFilter}`);
      if (params.length) url += '?' + params.join('&');
      const { data } = await api.get(url);
      setStudents((data || []).map(s => ({ ...s, _modified: false })));
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const updateBatch = (studentId, batch) => {
    setStudents(prev => prev.map(s => s._id === studentId ? { ...s, batch, _modified: true } : s));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const modified = students.filter(s => s._modified);
    if (modified.length === 0) { showToast('No changes to save'); setSaving(false); return; }
    try {
      const updates = modified.map(s => ({ id: s._id, batch: s.batch }));
      await api.put('/users/students/batch/bulk', { updates });
      showToast(`Saved batch for ${updates.length} students`);
      setStudents(prev => prev.map(s => ({ ...s, _modified: false })));
    } catch (err) {
      showToast('Failed to save: ' + (err.response?.data?.message || err.message), 'error');
    } finally { setSaving(false); }
  };

  const handleAssignBatchBulk = (batch) => {
    const visible = filteredStudents;
    if (visible.length === 0) return showToast('No visible students to assign', 'error');
    if (!window.confirm(`Assign ${visible.length} visible students to ${batch}?`)) return;
    const visibleIds = new Set(visible.map(s => s._id));
    setStudents(prev => prev.map(s =>
      visibleIds.has(s._id) ? { ...s, batch, _modified: true } : s
    ));
    showToast(`Assigned ${visible.length} students to ${batch} (save to apply)`);
  };

  const handleAutoDistribute = () => {
    if (students.length === 0) return;
    if (!window.confirm('Automatically distribute all students evenly across B1-B4?')) return;
    const batches = ['B1', 'B2', 'B3', 'B4'];
    setStudents(prev => prev.map((s, i) => ({
      ...s, batch: batches[i % 4], _modified: true
    })));
    showToast('Auto-distributed students across B1-B4 (save to apply)');
  };

  const handleAddStudent = async () => {
    if (!studentForm.name || !studentForm.email) return showToast('Name and email are required', 'error');
    try {
      const payload = {
        ...studentForm,
        department: deptId || studentForm.department,
        semester: parseInt(studentForm.semester)
      };
      await api.post('/users/students', payload);
      showToast('Student added!');
      setShowAddStudent(false);
      resetStudentForm();
      fetchStudents();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add student', 'error');
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      name: '', email: '', rollNumber: '', semester: 2, division: '1', batch: 'B1',
      department: deptId, password: 'student123'
    });
  };

  const batchCounts = students.reduce((a, s) => { if (s.batch) a[s.batch] = (a[s.batch] || 0) + 1; return a; }, {});
  const modifiedCount = students.filter(s => s._modified).length;

  const filteredStudents = students.filter(s => {
    const matchSearch = !searchTerm ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.rollNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchBatch = !batchFilter || s.batch === batchFilter;
    return matchSearch && matchBatch;
  });

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Student Batch Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {students.length} students loaded
            {deptFilter && departments?.length > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--primary-400)', fontWeight: 600 }}>
                — {departments.find(d => d._id === deptFilter)?.name || 'All Departments'}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Department Filter — visible for non-coordinator roles */}
          {['admin', 'hod', 'principal', 'dean'].includes(user?.role) ? (
            <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {(departments || []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          ) : (
            <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
              🏢 {departments?.find(d => d._id === deptId)?.name || 'My Department'}
            </span>
          )}
          <select className="form-select" style={{ width: 'auto', minWidth: 100 }} value={semFilter} onChange={e => setSemFilter(e.target.value)}>
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => { resetStudentForm(); setShowAddStudent(true); }}>
            + Add Student
          </button>
          <button className="btn btn-secondary" onClick={handleAutoDistribute} title="Auto-distribute students evenly across B1-B4">
            Auto Distribute
          </button>
          {modifiedCount > 0 && (
            <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
              {saving ? 'Saving...' : `Save ${modifiedCount} Change${modifiedCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* Batch Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
        {['B1', 'B2', 'B3', 'B4'].map(b => (
          <div key={b} className="stat-card" onClick={() => setBatchFilter(prev => prev === b ? '' : b)}
            style={{ cursor: 'pointer', outline: batchFilter === b ? '2px solid var(--primary-400)' : 'none' }}>
            <div className="stat-icon purple">{b}</div>
            <div>
              <div className="stat-value">{batchCounts[b] || 0}</div>
              <div className="stat-label">Batch {b}</div>
            </div>
          </div>
        ))}
        <div className="stat-card" onClick={() => setBatchFilter('')} style={{ cursor: 'pointer', outline: !batchFilter ? '2px solid var(--primary-400)' : 'none' }}>
          <div className="stat-icon blue">Σ</div>
          <div>
            <div className="stat-value">{students.length}</div>
            <div className="stat-label">All Students</div>
          </div>
        </div>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 180, maxWidth: 300 }}
            placeholder="🔍 Search by name, roll, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bulk assign visible:</span>
          {['B1', 'B2', 'B3', 'B4'].map(b => (
            <button key={b} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => handleAssignBatchBulk(b)}>
              → {b}
            </button>
          ))}
        </div>

        {/* Student Table */}
        <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
          <table style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>#</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Name</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Roll No.</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Department</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Email</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Sem</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Div</th>
                <th style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Batch</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                  {students.length === 0 ? 'No students found. Add students using the button above.' : 'No students match your filter.'}
                </td></tr>
              )}
              {filteredStudents.map((s, i) => (
                <tr key={s._id} style={{ background: s._modified ? 'rgba(99,102,241,0.06)' : 'transparent' }}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.name}
                    {s._modified && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 9 }}>Modified</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.rollNumber || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10 }}>
                      {s.department?.code || s.department?.name || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</td>
                  <td style={{ fontSize: 13, textAlign: 'center' }}>{s.semester || '—'}</td>
                  <td style={{ fontSize: 13, textAlign: 'center' }}>{s.division || '—'}</td>
                  <td>
                    <select
                      className="form-select"
                      style={{ width: 80, padding: '4px 8px', fontSize: 11 }}
                      value={s.batch || ''}
                      onChange={e => updateBatch(s._id, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="B3">B3</option>
                      <option value="B4">B4</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {modifiedCount > 0 && (
          <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={fetchStudents} disabled={saving}>Discard</button>
            <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
              {saving ? 'Saving...' : `Save All (${modifiedCount})`}
            </button>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="modal-overlay" onClick={() => setShowAddStudent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">Add New Student</div>
              <button className="modal-close" onClick={() => setShowAddStudent(false)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" placeholder="Full name" value={studentForm.name}
                  onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" placeholder="email@vcet.edu.in" value={studentForm.email}
                  onChange={e => setStudentForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Roll Number</label>
                <input className="form-input" placeholder="e.g. 2101" value={studentForm.rollNumber}
                  onChange={e => setStudentForm(f => ({ ...f, rollNumber: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-select" value={studentForm.semester}
                  onChange={e => setStudentForm(f => ({ ...f, semester: e.target.value }))}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Division</label>
                <input className="form-input" placeholder="e.g. 1" value={studentForm.division}
                  onChange={e => setStudentForm(f => ({ ...f, division: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <select className="form-select" value={studentForm.batch}
                  onChange={e => setStudentForm(f => ({ ...f, batch: e.target.value }))}>
                  <option value="">None</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="B3">B3</option>
                  <option value="B4">B4</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" value={studentForm.password}
                  onChange={e => setStudentForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddStudent(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStudent}>Add Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
