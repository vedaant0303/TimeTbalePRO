import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import { getSocket } from '../services/socket';

export default function Workload() {
  const { user } = useAuth();
  const { academicYear, departments } = useApp();
  const isCoordinator = user?.role === 'coordinator';

  // --- data ---
  const [workloadData, setWorkloadData] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [activeSem, setActiveSem] = useState(null);
  const [allSemesters, setAllSemesters] = useState([]);
  const [semType, setSemType] = useState('even'); // 'odd' or 'even'
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // --- form for adding workload ---
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    facultyId: '', subjectId: '', _editSubjectId: '',
    className: '', semester: '',
    theoryHours: 3, practicalBatches: 0, practicalHoursPerBatch: 2,
    miniProjectHours: 0, majorProjectHours: 0,
    extraLoad: 0, extraLoadDescription: '',
    isDLOC: false, dlocSubjectName: ''
  });

  const isEven = semType === 'even';
  const classOptions = [
    { label: 'FE', semester: isEven ? 2 : 1 },
    { label: 'SE-1', semester: isEven ? 4 : 3 }, { label: 'SE-2', semester: isEven ? 4 : 3 }, { label: 'SE-3', semester: isEven ? 4 : 3 },
    { label: 'TE-1', semester: isEven ? 6 : 5 }, { label: 'TE-2', semester: isEven ? 6 : 5 }, { label: 'TE-3', semester: isEven ? 6 : 5 },
    { label: 'BE', semester: isEven ? 8 : 7 },
    { label: 'TE Honors', semester: isEven ? 6 : 5 }, { label: 'BE Honors', semester: isEven ? 8 : 7 }
  ];

  useEffect(() => { fetchInit(); }, []);
  useEffect(() => { if (activeSem) fetchWorkload(); }, [deptFilter, activeSem]);

  // Real-time: listen for workload updates from timetable editor
  useEffect(() => {
    const socket = getSocket();
    const handleWorkloadUpdate = (data) => {
      console.log('[Workload] Real-time update received for faculty:', data.facultyId);
      fetchWorkload(); // Refresh the table
      showToast('Workload updated from timetable assignment', 'success');
    };
    socket.on('workload-updated', handleWorkloadUpdate);
    return () => socket.off('workload-updated', handleWorkloadUpdate);
  }, [deptFilter, activeSem]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchInit = async () => {
    try {
      // Fetch all semesters + active
      const [semActiveRes, semAllRes] = await Promise.all([
        api.get('/semester/active'),
        api.get('/semester')
      ]);
      setActiveSem(semActiveRes.data);
      setAllSemesters(semAllRes.data || []);
      const dept = (user.role === 'hod' || user.role === 'coordinator')
        ? (user.department?._id || user.department || '') : '';
      setDeptFilter(dept);

      // Fetch faculty from BOTH User and Faculty collections
      const [userFacRes, facModelRes, subRes] = await Promise.all([
        api.get('/users?role=faculty'),
        api.get('/users/faculty'),
        dept ? api.get(`/subjects?department=${dept}`) : api.get('/subjects'),
      ]);
      // Merge: Faculty model entries take priority, dedupe by email
      const userFac = userFacRes.data || [];
      const facModel = facModelRes.data || [];
      const seenEmails = new Set();
      const merged = [];
      // Add Faculty model entries first
      for (const f of facModel) {
        if (f.email) seenEmails.add(f.email.toLowerCase());
        merged.push({ _id: f._id, name: f.name, email: f.email, designation: f.designation, source: 'faculty' });
      }
      // Add User entries not already in Faculty
      for (const u of userFac) {
        if (u.email && !seenEmails.has(u.email.toLowerCase())) {
          merged.push({ _id: u._id, name: u.name, email: u.email, designation: u.designation || 'Faculty', source: 'user' });
        }
      }
      setFaculty(merged);
      setSubjects(subRes.data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleSemChange = (semId) => {
    const sem = allSemesters.find(s => s._id === semId);
    if (sem) setActiveSem(sem);
  };

  const handleDeleteOne = async (workloadId, facultyName) => {
    if (!window.confirm(`Delete workload for ${facultyName}?`)) return;
    try {
      await api.delete(`/workload/${workloadId}`);
      showToast(`Deleted workload for ${facultyName}`);
      await fetchWorkload();
    } catch (err) { showToast(err.response?.data?.message || 'Delete failed', 'error'); }
  };

  const handleClearAll = async () => {
    try {
      const params = new URLSearchParams();
      if (activeSem?._id) params.set('semesterId', activeSem._id);
      if (deptFilter) params.set('department', deptFilter);
      await api.delete(`/workload/clear/all?${params}`);
      showToast('All workload cleared');
      setConfirmClear(false);
      await fetchWorkload();
    } catch (err) { showToast(err.response?.data?.message || 'Clear failed', 'error'); }
  };

  const fetchWorkload = async () => {
    try {
      const params = new URLSearchParams();
      if (deptFilter) params.set('department', deptFilter);
      if (activeSem?._id) params.set('semesterId', activeSem._id);
      if (academicYear) params.set('academicYear', academicYear);
      const res = await api.get(`/workload?${params}`);
      setWorkloadData(res.data || []);
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    if (!form.facultyId) return showToast('Select a faculty member', 'error');
    if (!form.subjectId && !form.isDLOC) return showToast('Select a subject', 'error');
    if (!activeSem?._id) return showToast('No active semester found', 'error');

    setSaving(true);
    try {
      const selectedSubject = subjects.find(s => s._id === form.subjectId);
      const allocation = {
        subjectId: form.subjectId || undefined,
        subjectCode: form.isDLOC ? 'DLOC' : (selectedSubject?.code || ''),
        subjectName: form.isDLOC ? form.dlocSubjectName : (selectedSubject?.name || ''),
        className: form.className || '',
        semester: parseInt(form.semester) || 0,
        theoryLoad: parseInt(form.theoryHours) || 0,
        practicalLoad: {
          batch1: form.practicalBatches >= 1 ? parseInt(form.practicalHoursPerBatch) || 0 : 0,
          batch2: form.practicalBatches >= 2 ? parseInt(form.practicalHoursPerBatch) || 0 : 0,
          batch3: form.practicalBatches >= 3 ? parseInt(form.practicalHoursPerBatch) || 0 : 0,
          batch4: form.practicalBatches >= 4 ? parseInt(form.practicalHoursPerBatch) || 0 : 0,
        },
        extraLoad: parseInt(form.extraLoad) || 0,
        extraLoadDescription: form.extraLoadDescription || ''
      };

      // If editing, merge the updated allocation into existing allocations
      let allAllocations = [allocation];
      if (editId) {
        const existingWl = workloadData.find(w => w._id === editId);
        if (existingWl && existingWl.allocations?.length > 0) {
          // Replace the specific allocation being edited (match by subjectId) or add new
          const editSubjId = form._editSubjectId || (allocation.subjectId || '');
          allAllocations = existingWl.allocations.map(a => {
            const aSubjId = a.subjectId?._id || a.subjectId || '';
            if (aSubjId.toString() === editSubjId.toString()) {
              return allocation; // Replace old allocation with edited one
            }
            return a;
          });
          // If editing subject wasn't found (new subject), add it
          if (!existingWl.allocations.some(a => {
            const aSubjId = a.subjectId?._id || a.subjectId || '';
            return aSubjId.toString() === editSubjId.toString();
          })) {
            allAllocations.push(allocation);
          }
        }
      }

      const payload = {
        facultyId: form.facultyId,
        semesterId: activeSem._id,
        department: deptFilter,
        allocations: allAllocations,
        miniProjectLoad: parseInt(form.miniProjectHours) || 0,
        majorProjectLoad: parseInt(form.majorProjectHours) || 0,
      };

      await api.post('/workload', payload);
      showToast(editId ? 'Workload updated' : 'Workload saved to database');

      await fetchWorkload();
      resetForm();
    } catch (err) {
      showToast('' + (err.response?.data?.message || err.message), 'error');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({
      facultyId: '', subjectId: '', _editSubjectId: '',
      className: '', semester: '',
      theoryHours: 3, practicalBatches: 0, practicalHoursPerBatch: 2,
      miniProjectHours: 0, majorProjectHours: 0,
      extraLoad: 0, extraLoadDescription: '',
      isDLOC: false, dlocSubjectName: ''
    });
  };

  const handleEdit = (w) => {
    const alloc = w.allocations?.[0] || {};
    const pracBatches = [alloc.practicalLoad?.batch1, alloc.practicalLoad?.batch2,
      alloc.practicalLoad?.batch3, alloc.practicalLoad?.batch4].filter(v => v > 0).length;
    setEditId(w._id);
    setForm({
      facultyId: w.facultyId?._id || w.facultyId || '',
      subjectId: alloc.subjectId?._id || alloc.subjectId || '',
      _editSubjectId: alloc.subjectId?._id || alloc.subjectId || '',
      className: alloc.className || '',
      semester: alloc.semester || '',
      theoryHours: alloc.theoryLoad || 0,
      practicalBatches: pracBatches,
      practicalHoursPerBatch: alloc.practicalLoad?.batch1 || 2,
      miniProjectHours: w.miniProjectLoad || 0,
      majorProjectHours: w.majorProjectLoad || 0,
      extraLoad: alloc.extraLoad || 0,
      extraLoadDescription: alloc.extraLoadDescription || '',
      isDLOC: (alloc.subjectCode || '').includes('DLOC'),
      dlocSubjectName: (alloc.subjectCode || '').includes('DLOC') ? alloc.subjectName : ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Format
  const displayData = workloadData.map(w => {
    if (w.facultyId) {
      const facName = w.facultyId?.name || 'Unknown';
      const allocSubjects = (w.allocations || []).map(a => a.subjectCode || a.subjectName).filter(Boolean);
      return {
        _raw: w, id: w._id, name: facName,
        designation: w.facultyId?.designation || '',
        subjects: [...new Set(allocSubjects)],
        totalLoad: w.totalTeachingLoad || 0,
        miniProject: w.miniProjectLoad || 0,
        majorProject: w.majorProjectLoad || 0,
        extraLoad: w.extraTotal || 0,
        allocations: w.allocations || [],
        status: w.status
      };
    }
    return {
      _raw: w, id: w.faculty?._id, name: w.faculty?.name || 'Unknown',
      subjects: w.subjects || [], totalLoad: w.totalHours || 0,
      dayWise: w.dayWise || {}, isOverloaded: w.isOverloaded
    };
  });

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--error-400)' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Faculty Workload</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isCoordinator ? 'Input & manage faculty workload assignments → saved to DB' : 'View faculty workload'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Semester Selector */}
          {allSemesters.length > 0 && (
            <select className="form-select" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
              value={activeSem?._id || ''}
              onChange={e => handleSemChange(e.target.value)}>
              {allSemesters.map(s => (
                <option key={s._id} value={s._id}>{s.academicYear} — {s.semester} sem {s.isActive ? '(Active)' : ''}</option>
              ))}
            </select>
          )}
          {/* Odd/Even Toggle */}
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--border-color)', fontSize: 12
          }}>
            <button onClick={() => setSemType('odd')} style={{
              padding: '6px 14px', border: 'none', cursor: 'pointer', fontWeight: 600,
              background: semType === 'odd' ? 'var(--primary-400)' : 'transparent',
              color: semType === 'odd' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}>Odd Sem</button>
            <button onClick={() => setSemType('even')} style={{
              padding: '6px 14px', border: 'none', cursor: 'pointer', fontWeight: 600,
              background: semType === 'even' ? 'var(--primary-400)' : 'transparent',
              color: semType === 'even' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}>Even Sem</button>
          </div>
          {isCoordinator && (
            <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? '× Close' : '+ Add Workload'}
            </button>
          )}
          {isCoordinator && displayData.length > 0 && (
            confirmClear ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', fontSize: 11 }} onClick={handleClearAll}>Confirm Clear All</button>
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirmClear(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', fontSize: 11 }} onClick={() => setConfirmClear(true)}>Clear All</button>
            )
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16, position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200, maxWidth: 350 }}>
            <label className="form-label">Department</label>
            <select className="form-select" style={{ position: 'relative', zIndex: 20 }}
              value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              disabled={['hod', 'coordinator'].includes(user.role)}>
              {!['hod', 'coordinator'].includes(user.role) && <option value="">All Departments</option>}
              {(departments || []).map(d => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchWorkload}>Refresh</button>
        </div>
      </div>

      {/* Coordinator Input Form */}
      {showForm && isCoordinator && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--primary-400)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--primary-400)' }}>
            {editId ? 'Edit Workload' : '+ Add Faculty Workload'}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Faculty *</label>
              <SearchableSelect
                options={faculty.map(f => ({ value: f._id, label: f.name, subtitle: f.email }))}
                value={form.facultyId}
                onChange={(val) => setForm(p => ({ ...p, facultyId: val }))}
                placeholder="Select Faculty"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={form.isDLOC} onChange={e => setForm(p => ({ ...p, isDLOC: e.target.checked }))} />
                  DLOC Subject
                </label>
              </label>
              {form.isDLOC ? (
                <input className="form-input" placeholder="DLOC Subject Name"
                  value={form.dlocSubjectName} onChange={e => setForm(p => ({ ...p, dlocSubjectName: e.target.value }))} />
              ) : (
                <select className="form-select" value={form.subjectId} onChange={e => setForm(p => ({ ...p, subjectId: e.target.value }))}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name} ({s.type})</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Class (Year-Division) *</label>
              <select className="form-select" value={form.className} onChange={e => {
                const opt = classOptions.find(c => c.label === e.target.value);
                setForm(p => ({ ...p, className: e.target.value, semester: opt?.semester || '' }));
              }}>
                <option value="">Select Class</option>
                {classOptions.map(c => <option key={c.label} value={c.label}>{c.label} (Sem {c.semester})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Theory Hours / Week</label>
              <input type="number" className="form-input" min={0} max={10}
                value={form.theoryHours} onChange={e => setForm(p => ({ ...p, theoryHours: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Practical Batches (0–4)</label>
              <select className="form-select" value={form.practicalBatches} onChange={e => setForm(p => ({ ...p, practicalBatches: parseInt(e.target.value) }))}>
                {[0,1,2,3,4].map(n => <option key={n} value={n}>{n} batch{n !== 1 ? 'es' : ''}</option>)}
              </select>
            </div>

            {form.practicalBatches > 0 && (
              <div className="form-group">
                <label className="form-label">Practical Hrs / Batch</label>
                <input type="number" className="form-input" min={1} max={6}
                  value={form.practicalHoursPerBatch} onChange={e => setForm(p => ({ ...p, practicalHoursPerBatch: e.target.value }))} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Mini Project Hours / Week</label>
              <input type="number" className="form-input" min={0} max={8}
                value={form.miniProjectHours} onChange={e => setForm(p => ({ ...p, miniProjectHours: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Major Project Hours / Week</label>
              <input type="number" className="form-input" min={0} max={8}
                value={form.majorProjectHours} onChange={e => setForm(p => ({ ...p, majorProjectHours: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Extra Teaching Load (hrs)</label>
              <input type="number" className="form-input" min={0} max={10}
                value={form.extraLoad} onChange={e => setForm(p => ({ ...p, extraLoad: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Extra Load Description</label>
              <input className="form-input" placeholder="e.g. 3hrs SE-2 OS lectures"
                value={form.extraLoadDescription} onChange={e => setForm(p => ({ ...p, extraLoadDescription: e.target.value }))} />
            </div>
          </div>

          {/* Calculated preview */}
          <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 14, fontSize: 13 }}>
            <strong>Preview:</strong>{' '}
            {form.className && <span style={{ color: 'var(--primary-400)' }}>[{form.className}] </span>}
            Theory: {form.theoryHours || 0} hrs +{' '}
            Practical: {form.practicalBatches * (form.practicalHoursPerBatch || 0)} hrs +{' '}
            Mini Proj: {form.miniProjectHours || 0} hrs +{' '}
            Major Proj: {form.majorProjectHours || 0} hrs +{' '}
            Extra: {form.extraLoad || 0} hrs ={' '}
            <strong style={{ color: 'var(--primary-400)' }}>
              {(parseInt(form.theoryHours) || 0) + (form.practicalBatches * (parseInt(form.practicalHoursPerBatch) || 0)) + (parseInt(form.miniProjectHours) || 0) + (parseInt(form.majorProjectHours) || 0) + (parseInt(form.extraLoad) || 0)} hrs/week
            </strong>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Update' : 'Save to DB'}
            </button>
            <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {/* Workload Table */}
      {displayData.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}></div>
          <h3 style={{ marginBottom: 8 }}>No Workload Data</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {isCoordinator ? 'Click "+ Add Workload" to assign faculty their teaching load.' : 'No workload records found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon purple"></div>
              <div><div className="stat-value">{displayData.length}</div><div className="stat-label">Faculty</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"></div>
              <div><div className="stat-value">{Math.round(displayData.reduce((s, d) => s + d.totalLoad, 0) / displayData.length)}</div><div className="stat-label">Avg Load</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"></div>
              <div><div className="stat-value">{displayData.reduce((s, d) => s + d.totalLoad, 0)}</div><div className="stat-label">Total Hrs</div></div>
            </div>
          </div>

          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Faculty</th>
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>Subjects</th>
                  <th style={thStyle}>Theory + Practical</th>
                  <th style={thStyle}>Extra</th>
                  <th style={thStyle}>Mini P</th>
                  <th style={thStyle}>Major P</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Status</th>
                  {isCoordinator && <th style={thStyle}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayData.map((d, i) => {
                  const theoryTotal = d.allocations?.reduce((s, a) => s + (a.theoryLoad || 0), 0) || 0;
                  const pracTotal = d.allocations?.reduce((s, a) => {
                    const p = a.practicalLoad || {};
                    return s + (p.batch1 || 0) + (p.batch2 || 0) + (p.batch3 || 0) + (p.batch4 || 0);
                  }, 0) || 0;
                  const extraTotal = d.allocations?.reduce((s, a) => s + (a.extraLoad || 0), 0) || 0;
                  const loadPercent = Math.min((d.totalLoad / 22) * 100, 100);
                  const isHigh = d.totalLoad > 20;
                  const classNames = [...new Set((d.allocations || []).map(a => a.className).filter(Boolean))];

                  return (
                    <tr key={d.id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        {d.designation && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.designation}</div>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {classNames.length > 0 ? classNames.map((c, j) => (
                            <span key={j} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: c.startsWith('SE') ? '#dbeafe' : c.startsWith('TE') ? '#fef3c7' : '#dcfce7', color: c.startsWith('SE') ? '#1e40af' : c.startsWith('TE') ? '#92400e' : '#166534', fontWeight: 600 }}>{c}</span>
                          )) : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {d.subjects.map((s, j) => (
                            <span key={j} className="badge badge-primary" style={{ fontSize: 10, padding: '2px 6px' }}>{s}</span>
                          ))}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--primary-400)' }}>{theoryTotal}T</span> + <span style={{ color: 'var(--warning-400)' }}>{pracTotal}P</span>
                      </td>
                      <td style={tdStyle}>
                        {extraTotal > 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>+{extraTotal}</span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                      </td>
                      <td style={tdStyle}>{d.miniProject || 0}</td>
                      <td style={tdStyle}>{d.majorProject || 0}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: isHigh ? 'var(--error-400)' : 'var(--text-primary)' }}>{d.totalLoad}</span>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, minWidth: 40 }}>
                            <div style={{
                              width: `${loadPercent}%`, height: '100%', borderRadius: 3,
                              background: isHigh ? 'var(--error-400)' : loadPercent > 80 ? 'var(--warning-400)' : 'var(--primary-400)',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span className={`badge ${d.status === 'approved' ? 'badge-success' : d.status === 'submitted' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 10 }}>
                          {d.status || 'draft'}
                        </span>
                      </td>
                      {isCoordinator && (
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => handleEdit(d._raw)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 11, background: '#ef4444', color: '#fff' }}
                              onClick={() => handleDeleteOne(d._raw._id, d.name)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '10px 8px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 };
const tdStyle = { padding: '10px 8px', verticalAlign: 'middle' };
