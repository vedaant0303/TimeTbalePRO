import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const emptyForm = {
  name: '', code: '', department: '', semester: 5,
  credits: 3, weeklyHours: 3, type: 'theory',
  requiresLab: false, faculty: [], isDLOC: false, dlocSubjectName: ''
};

const semToYear = (sem) => {
  if (sem <= 2) return 'FE';
  if (sem <= 4) return 'SE';
  if (sem <= 6) return 'TE';
  return 'BE';
};

const yearToSems = { FE: [1, 2], SE: [3, 4], TE: [5, 6], BE: [7, 8] };
const yearLabels = { FE: 'First Year', SE: 'Second Year', TE: 'Third Year', BE: 'Fourth Year' };
const yearColors = {
  FE: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  SE: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  TE: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  BE: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
};

export default function Subjects() {
  const { user } = useAuth();
  const isCoordinator = user?.role === 'coordinator';
  const isHOD = user?.role === 'hod';
  const hasDeptFilter = (isCoordinator || isHOD) && user.department;

  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [facSearch, setFacSearch] = useState('');
  const [filterYear, setFilterYear] = useState(''); // year filter: FE, SE, TE, BE
  const [filterSemester, setFilterSemester] = useState(''); // specific semester filter

  useEffect(() => { fetchData(); }, []);
  // Re-fetch when filters change
  useEffect(() => { fetchData(); }, [filterYear, filterSemester]);

  const fetchData = async () => {
    try {
      const deptId = hasDeptFilter ? (user.department?._id || user.department) : '';
      let params = deptId ? `?department=${deptId}` : '?';

      // Add year/semester filter
      if (filterYear && !filterSemester) {
        params += `&year=${filterYear}`;
      } else if (filterSemester) {
        params += `&semester=${filterSemester}`;
      }

      const [sRes, dRes, fRes] = await Promise.all([
        api.get(`/subjects${params}`),
        api.get('/departments'),
        api.get('/users?role=faculty'),
      ]);
      setSubjects(sRes.data);
      setDepartments(dRes.data);
      setFaculty(fRes.data);
    } catch (err) {
      showToast('Failed to load data: ' + (err.response?.data?.message || err.message), 'error');
    } finally { setLoading(false); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('Subject name is required', 'error');
    if (!form.code.trim()) return showToast('Subject code is required', 'error');
    if (!form.department) return showToast('Please select a department', 'error');

    const payload = { ...form };
    if (payload.isDLOC && payload.dlocSubjectName) {
      payload.name = payload.dlocSubjectName;
    }
    delete payload.dlocSubjectName;

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/subjects/${editId}`, payload);
        showToast('Subject updated successfully');
      } else {
        await api.post('/subjects', payload);
        showToast('Subject saved successfully');
      }
      await fetchData();
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setFacSearch('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Save failed';
      showToast(msg, 'error');
    } finally { setSaving(false); }
  };

  const handleEdit = (s) => {
    setEditId(s._id);
    setForm({
      name: s.name || '',
      code: s.code || '',
      department: s.department?._id || s.department || '',
      semester: s.semester || 5,
      credits: s.credits || 3,
      weeklyHours: s.weeklyHours || 3,
      type: s.type || 'theory',
      requiresLab: s.requiresLab || false,
      faculty: s.faculty?.map(f => f._id || f) || [],
      isDLOC: s.isDLOC || false,
      dlocSubjectName: '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete subject "${name}"?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/subjects/${id}`);
      showToast('Subject deleted');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally { setDeleting(null); }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setFacSearch('');
  };

  const filteredFaculty = faculty.filter(f =>
    f.name.toLowerCase().includes(facSearch.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(facSearch.toLowerCase())
  );

  // Compute the auto-mapped year label from the form's semester
  const formYear = semToYear(form.semester);
  const formYearStyle = yearColors[formYear] || yearColors.FE;

  // Available semester options for the filter (based on selected year)
  const filterSemOptions = filterYear ? yearToSems[filterYear] : [1, 2, 3, 4, 5, 6, 7, 8];

  // Group subjects by year for display
  const subjectsByYear = {};
  subjects.forEach(s => {
    const yr = semToYear(s.semester);
    if (!subjectsByYear[yr]) subjectsByYear[yr] = [];
    subjectsByYear[yr].push(s);
  });

  // Count subjects per year
  const yearCounts = {};
  Object.keys(yearToSems).forEach(yr => {
    yearCounts[yr] = subjects.filter(s => yearToSems[yr].includes(s.semester)).length;
  });

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--error-400)' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>
          {toast.msg}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Subjects & Faculty Assignment</div>
            <div className="card-subtitle">{subjects.length} subjects configured</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCoordinator && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', border: 'none' }}
                onClick={() => {
                  setEditId(null);
                  setForm({ ...emptyForm, isDLOC: true, department: user.department?._id || user.department || '' });
                  setShowForm(true);
                }}
              >
                Add DLOC Subject
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => {
              if (showForm && !form.isDLOC) { handleCancel(); } else {
                setEditId(null);
                setForm({ ...emptyForm, department: isCoordinator ? (user.department?._id || user.department || '') : '' });
                setShowForm(true);
              }
            }}>+ Add Subject</button>
          </div>
        </div>

        {/* Year Filter Tabs */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>
            Filter by Year:
          </span>
          <button
            onClick={() => { setFilterYear(''); setFilterSemester(''); }}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s ease',
              border: !filterYear ? '2px solid var(--primary-400)' : '2px solid var(--border-color)',
              background: !filterYear ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
              color: !filterYear ? 'var(--primary-400)' : 'var(--text-secondary)'
            }}
          >
            All ({subjects.length})
          </button>
          {Object.entries(yearLabels).map(([yr, label]) => {
            const yrStyle = yearColors[yr];
            const isActive = filterYear === yr;
            const count = yearCounts[yr] || 0;
            return (
              <button
                key={yr}
                onClick={() => { setFilterYear(yr); setFilterSemester(''); }}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  border: isActive ? `2px solid ${yrStyle.color}` : '2px solid var(--border-color)',
                  background: isActive ? yrStyle.bg : 'var(--bg-tertiary)',
                  color: isActive ? yrStyle.color : 'var(--text-secondary)'
                }}
              >
                {yr} ({count})
              </button>
            );
          })}

          {/* Semester sub-filter when a year is selected */}
          {filterYear && (
            <>
              <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>|</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Sem:</span>
              {filterSemOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterSemester(filterSemester === String(s) ? '' : String(s))}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    border: filterSemester === String(s) ? `2px solid ${yearColors[filterYear].color}` : '1px solid var(--border-color)',
                    background: filterSemester === String(s) ? yearColors[filterYear].bg : 'transparent',
                    color: filterSemester === String(s) ? yearColors[filterYear].color : 'var(--text-muted)'
                  }}
                >
                  Sem {s}
                </button>
              ))}
            </>
          )}
        </div>

        {showForm && (
          <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16, border: form.isDLOC ? '2px solid #7c3aed' : '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: form.isDLOC ? '#a78bfa' : 'var(--primary-400)' }}>
                {form.isDLOC ? 'DLOC Subject' : editId ? 'Edit Subject' : '+ New Subject'}
                {form.isDLOC && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: 'var(--text-muted)' }}>(Coordinator Only)</span>}
              </div>
              {/* Auto-mapped Year Badge */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{
                  padding: '4px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: formYearStyle.bg, color: formYearStyle.color,
                  border: `1px solid ${formYearStyle.border}`
                }}>
                  📎 {formYear} — {yearLabels[formYear]}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  (auto-mapped from Sem {form.semester})
                </span>
              </div>
            </div>

            {form.isDLOC && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">DLOC Subject Name *</label>
                <input
                  className="form-input"
                  placeholder="Enter DLOC subject name..."
                  value={form.dlocSubjectName}
                  onChange={e => setForm(p => ({ ...p, dlocSubjectName: e.target.value, name: e.target.value }))}
                />
              </div>
            )}

            <div className="grid-2">
              {!form.isDLOC && (
                <div className="form-group">
                  <label className="form-label">Subject Name *</label>
                  <input className="form-input" placeholder="e.g. Data Structures" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Subject Code *</label>
                <input className="form-input" placeholder="e.g. CS301" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <select className="form-select" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={isCoordinator}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-select" value={form.semester} onChange={e => setForm(p => ({ ...p, semester: parseInt(e.target.value) }))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s} — {semToYear(s)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Credits</label>
                <input type="number" min={1} max={6} className="form-input" value={form.credits} onChange={e => setForm(p => ({ ...p, credits: parseInt(e.target.value) || 3 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Weekly Hours</label>
                <input type="number" min={1} max={10} className="form-input" value={form.weeklyHours} onChange={e => setForm(p => ({ ...p, weeklyHours: parseInt(e.target.value) || 3 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="theory">Theory</option>
                  <option value="practical">Practical</option>
                  <option value="tutorial">Tutorial</option>
                </select>
              </div>
            </div>

            {/* Faculty picker with search + scrollable list */}
            <div className="form-group">
              <label className="form-label">Assign Faculty</label>
              <input
                className="form-input"
                placeholder="Search faculty..."
                value={facSearch}
                onChange={e => setFacSearch(e.target.value)}
                style={{ marginBottom: 6 }}
              />
              <div style={{
                maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', padding: 4
              }}>
                {filteredFaculty.length === 0 && (
                  <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No faculty found</div>
                )}
                {filteredFaculty.map(f => {
                  const isSelected = form.faculty.includes(f._id);
                  return (
                    <div
                      key={f._id}
                      onClick={() => setForm(p => ({
                        ...p,
                        faculty: isSelected ? p.faculty.filter(id => id !== f._id) : [...p.faculty, f._id]
                      }))}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', borderRadius: 4,
                        background: isSelected ? 'var(--primary-400)' : 'transparent',
                        color: isSelected ? '#fff' : 'var(--text-primary)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 13, marginBottom: 2, transition: 'background 0.2s'
                      }}
                    >
                      <span>{f.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{f.email}</span>
                      {isSelected && <span>✓</span>}
                    </div>
                  );
                })}
              </div>
              {form.faculty.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                  Selected: {faculty.filter(f => form.faculty.includes(f._id)).map(f => f.name).join(', ')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update Subject' : 'Save Subject'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 750 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Dept</th>
                <th>Year</th>
                <th>Sem</th>
                <th>Credits</th>
                <th>Hrs</th>
                <th>Type</th>
                <th>Faculty</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No subjects found{filterYear ? ` for ${filterYear}` : ''}.{!filterYear && ' Click "+ Add Subject" to start.'}
                </td></tr>
              )}
              {subjects.map(s => {
                const yr = semToYear(s.semester);
                const yrStyle = yearColors[yr];
                return (
                  <tr key={s._id} style={{ opacity: deleting === s._id ? 0.5 : 1 }}>
                    <td><span style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{s.code}</span></td>
                    <td>
                      {s.name}
                      {s.isDLOC && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>DLOC</span>}
                    </td>
                    <td><span className="badge badge-info">{s.department?.code || '—'}</span></td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: yrStyle.bg, color: yrStyle.color
                      }}>
                        {yr}
                      </span>
                    </td>
                    <td>{s.semester}</td>
                    <td>{s.credits}</td>
                    <td>{s.weeklyHours}</td>
                    <td><span className={`badge ${s.type === 'practical' ? 'badge-success' : s.type === 'tutorial' ? 'badge-warning' : 'badge-primary'}`}>{s.type}</span></td>
                    <td style={{ fontSize: 12 }}>{s.faculty?.map(f => f.name).join(', ') || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleEdit(s)}>✏</button>
                        <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleDelete(s._id, s.name)} disabled={deleting === s._id}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
