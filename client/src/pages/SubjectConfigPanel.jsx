import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/subject-config.css';

export default function SubjectConfigPanel() {
  const { user } = useAuth();
  const [activeSemester, setActiveSemester] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDiv, setSelectedDiv] = useState('');
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availableBatches, setAvailableBatches] = useState(['B1', 'B2', 'B3', 'B4']);
  const [availableSubjects, setAvailableSubjects] = useState([]); // Subjects fetched from DB based on year
  const [allSubjects, setAllSubjects] = useState([]); // All subjects in Subjects section
  const [form, setForm] = useState({
    subject: { code: '', name: '', type: 'theory' },
    theoryHours: 0,
    theoryFacultyId: '',
    theoryRoomId: '',
    batches: [],
    isCombinedBatch: true, // Always true — this IS the batch combine section
    combinedGroups: [],
    fixedSlots: [],
    isCrossDeptFaculty: false
  });

  const subjectTypes = ['theory', 'practical', 'project', 'OE', 'DLOC', 'ILOC', 'honours', 'combined'];

  useEffect(() => { init(); }, []);
  useEffect(() => { if (selectedClass && activeSemester) fetchConfigs(); }, [selectedClass]);

  // Load batch labels from selected class
  useEffect(() => {
    if (selectedClass) {
      const cls = classes.find(c => c._id === selectedClass);
      if (cls?.batchLabels?.length > 0) {
        setAvailableBatches(cls.batchLabels);
      } else {
        setAvailableBatches(['B1', 'B2', 'B3', 'B4']);
      }
    }
  }, [selectedClass, classes]);

  const isOdd = activeSemester?.semester === 'odd';
  const yearToSemMap = useMemo(() => isOdd
    ? { FE: [1], SE: [3], TE: [5], BE: [7] }
    : { FE: [2], SE: [4], TE: [6], BE: [8] }
  , [isOdd]);

  // Fetch subjects from DB when year changes — so user picks from predefined subjects
  useEffect(() => {
    if (selectedYear) {
      const deptId = user?.department?._id || user?.department || '';
      const sems = yearToSemMap[selectedYear];
      if (sems && deptId) {
        api.get(`/subjects?department=${deptId}&semesters=${sems.join(',')}`)
          .then(res => setAvailableSubjects(res.data || []))
          .catch(() => setAvailableSubjects([]));
      } else if (sems) {
        api.get(`/subjects?semesters=${sems.join(',')}`)
          .then(res => setAvailableSubjects(res.data || []))
          .catch(() => setAvailableSubjects([]));
      }
    } else {
      // No year selected — load all subjects for the department
      const deptId = user?.department?._id || user?.department || '';
      if (deptId) {
        api.get(`/subjects?department=${deptId}`)
          .then(res => {
            let fetched = res.data || [];
            if (activeSemester) {
              const activeSems = isOdd ? [1, 3, 5, 7] : [2, 4, 6, 8];
              fetched = fetched.filter(s => activeSems.includes(s.semester));
            }
            setAvailableSubjects(fetched);
          })
          .catch(() => setAvailableSubjects([]));
      }
    }
  }, [selectedYear, user, activeSemester, yearToSemMap, isOdd]);

  const init = async () => {
    try {
      let semData = null;
      let facData = [];
      let roomData = [];

      try {
        const semRes = await api.get('/semester/active');
        semData = semRes.data;
      } catch (e) { console.warn('No active semester:', e.message); }

      try {
        const facRes = await api.get('/users?role=faculty');
        facData = facRes.data || [];
      } catch (e) { console.warn('Faculty load error:', e.message); }

      try {
        const roomRes = await api.get('/rooms');
        roomData = roomRes.data || [];
      } catch (e) { console.warn('Rooms load error:', e.message); }

      let subData = [];
      try {
        const deptId = user?.department?._id || user?.department || '';
        const fetchUrl = deptId ? `/subjects?department=${deptId}` : '/subjects';
        const subRes = await api.get(fetchUrl);
        subData = subRes.data || [];
      } catch (e) { console.warn('All subjects load error:', e.message); }

      setActiveSemester(semData);
      setFaculty(facData);
      setRooms(roomData);
      setAllSubjects(subData);

      let loadedClasses = [];
      try {
        const semId = semData?._id || 'none';
        const classRes = await api.get(`/subject-config/my-classes/${semId}`);
        if (classRes.data?.length > 0) loadedClasses = classRes.data;
      } catch (e) { console.warn('my-classes load error:', e.message); }

      if (loadedClasses.length === 0) {
        try {
          const classRes = await api.get('/classes');
          if (classRes.data?.length > 0) loadedClasses = classRes.data;
        } catch (e) { console.warn('classes fallback error:', e.message); }
      }

      if (loadedClasses.length === 0 && user?.department) {
        const deptId = user.department._id || user.department;
        try {
          await api.post('/classes/seed', { departmentId: deptId, divisions: 3 });
          const classRes = await api.get('/classes');
          if (classRes.data?.length > 0) loadedClasses = classRes.data;
        } catch (e) { console.warn('Auto-seed classes error:', e.message); }
      }

      setClasses(loadedClasses);
      if (loadedClasses.length > 0) {
        setSelectedClass(loadedClasses[0]._id);
      }
    } catch (err) {
      console.error('SubjectConfig init error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const { data } = await api.get(`/subject-config/${selectedClass}/${activeSemester._id}`);
      setConfigs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      if (!form.subject?.code || !form.subject?.name) {
        return alert('Subject code and name are required.');
      }

      let classId = selectedClass;
      if (!classId && classes.length > 0) {
        classId = classes[0]._id;
        setSelectedClass(classId);
      }
      if (!classId) {
        return alert('No class selected. Please create a class first from Semester Setup.');
      }
      if (!activeSemester?._id) {
        return alert('No active semester found. Please configure a semester first.');
      }

      // Validate combined groups
      if (form.combinedGroups.length === 0) {
        return alert('Please add at least one combined group with selected batches.');
      }
      for (const g of form.combinedGroups) {
        if (!g.batches || g.batches.length < 2) {
          return alert('Each combined group must have at least 2 batches selected.');
        }
      }

      // Build batches array from combined groups for backward compatibility
      // This ensures the timetable generator can still read batch info
      const allBatchesInGroups = new Set();
      form.combinedGroups.forEach(g => (g.batches || []).forEach(b => allBatchesInGroups.add(b)));

      const cleanCombinedGroups = form.combinedGroups.map(g => ({
        batches: g.batches,
        type: g.type || form.subject.type, // theory or practical
        ...(g.facultyId ? { facultyId: g.facultyId } : (form.theoryFacultyId ? { facultyId: form.theoryFacultyId } : {})),
        ...(g.labId ? { labId: g.labId } : {})
      }));

      const cleanFixedSlots = (form.fixedSlots || []).map(fs => ({
        day: fs.day, startTime: fs.startTime, endTime: fs.endTime,
        isLocked: fs.isLocked !== false,
        ...(fs.roomId ? { roomId: fs.roomId } : {})
      }));

      const cls = classes.find(c => c._id === classId);
      const deptId = cls?.department?._id || cls?.department || user?.department?._id || user?.department;

      if (!deptId) {
        return alert('Cannot determine department. Please ensure the class has a department assigned.');
      }

      const payload = {
        subject: form.subject,
        theoryHours: form.theoryHours || 0,
        ...(form.theoryFacultyId ? { theoryFacultyId: form.theoryFacultyId } : {}),
        ...(form.theoryRoomId ? { theoryRoomId: form.theoryRoomId } : {}),
        batches: [], // Not used directly anymore — combined groups replaces this
        isCombinedBatch: true, // Always true
        combinedGroups: cleanCombinedGroups,
        fixedSlots: cleanFixedSlots,
        isCrossDeptFaculty: form.isCrossDeptFaculty || false,
        semesterId: activeSemester._id,
        classId: classId,
        departmentId: deptId
      };

      if (editId) {
        await api.put(`/subject-config/${editId}`, payload);
      } else {
        await api.post('/subject-config', payload);
      }
      setShowModal(false);
      setEditId(null);
      resetForm();
      fetchConfigs();
    } catch (err) {
      console.error('Save error:', err.response?.data || err);
      alert(err.response?.data?.message || 'Failed to save subject. Check console for details.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject config?')) return;
    try {
      await api.delete(`/subject-config/${id}`);
      fetchConfigs();
    } catch (err) { alert('Failed to delete'); }
  };

  const handleSubmitAll = async () => {
    try {
      await api.put(`/subject-config/submit-all/${selectedClass}/${activeSemester._id}`);
      alert('All configs submitted to HOD for approval!');
      fetchConfigs();
    } catch (err) { alert('Failed to submit'); }
  };

  const handleApproveAll = async () => {
    try {
      await api.put(`/subject-config/approve-all/${selectedClass}/${activeSemester._id}`);
      alert('All configs approved!');
      fetchConfigs();
    } catch (err) { alert('Failed to approve'); }
  };

  const openEdit = (config) => {
    setEditId(config._id);
    setForm({
      subject: config.subject,
      theoryHours: config.theoryHours,
      theoryFacultyId: config.theoryFacultyId?._id || config.theoryFacultyId || '',
      theoryRoomId: config.theoryRoomId || '',
      batches: config.batches || [],
      isCombinedBatch: true,
      combinedGroups: (config.combinedGroups || []).map(g => ({
        batches: g.batches || [],
        type: g.type || config.subject.type || 'theory',
        facultyId: g.facultyId?._id || g.facultyId || '',
        labId: g.labId?._id || g.labId || ''
      })),
      fixedSlots: config.fixedSlots || [],
      isCrossDeptFaculty: config.isCrossDeptFaculty || false
    });
    setShowModal(true);
  };

  const resetForm = () => setForm({
    subject: { code: '', name: '', type: 'theory' },
    theoryHours: 0, theoryFacultyId: '', theoryRoomId: '',
    batches: [], isCombinedBatch: true, combinedGroups: [], fixedSlots: [], isCrossDeptFaculty: false
  });

  const addCombinedGroup = () => {
    setForm(f => ({
      ...f,
      combinedGroups: [...f.combinedGroups, {
        batches: [],
        type: f.subject.type || 'theory',
        facultyId: '',
        labId: ''
      }]
    }));
  };

  const removeCombinedGroup = (idx) => {
    setForm(f => ({
      ...f,
      combinedGroups: f.combinedGroups.filter((_, i) => i !== idx)
    }));
  };

  const toggleBatchInGroup = (groupIdx, batchLabel) => {
    setForm(f => {
      const groups = [...f.combinedGroups];
      const group = { ...groups[groupIdx] };
      if (group.batches.includes(batchLabel)) {
        group.batches = group.batches.filter(b => b !== batchLabel);
      } else {
        group.batches = [...group.batches, batchLabel];
      }
      groups[groupIdx] = group;
      return { ...f, combinedGroups: groups };
    });
  };

  const addFixedSlot = () => {
    setForm(f => ({
      ...f,
      fixedSlots: [...f.fixedSlots, { day: 'Monday', startTime: '08:15', endTime: '09:15', roomId: '', isLocked: true }]
    }));
  };

  const totalHours = configs.reduce((sum, c) => {
    const pracHrs = (c.batches || []).reduce((s, b) => s + (b.hours || 0), 0);
    return sum + (c.theoryHours || 0) + pracHrs;
  }, 0);

  const allDraft = configs.every(c => c.status === 'draft');
  const allSubmitted = configs.every(c => c.status === 'submitted');

  const yearOptions = [...new Set(classes.map(c => c.year))].sort();
  const selectedClassObj = classes.find(c => c._id === selectedClass);

  const yearToSem = useMemo(() => isOdd
    ? { 'FE': 1, 'SE': 3, 'TE': 5, 'BE': 7 }
    : { 'FE': 2, 'SE': 4, 'TE': 6, 'BE': 8 }
  , [isOdd]);

  const getDynamicSem = useCallback((clsYear, clsSem) => {
    const year = clsYear || (selectedClassObj?.year || selectedYear);
    if (year && yearToSem[year]) {
      return yearToSem[year];
    }
    if (clsSem !== undefined && clsSem !== null) {
      if (isOdd) {
        return clsSem % 2 === 0 ? clsSem - 1 : clsSem;
      } else {
        return clsSem % 2 !== 0 ? clsSem + 1 : clsSem;
      }
    }
    return '—';
  }, [selectedClassObj, selectedYear, yearToSem, isOdd]);

  const currentSem = getDynamicSem(null, selectedClassObj?.semester);

  const filteredClasses = classes.filter(c => {
    if (selectedYear && c.year !== selectedYear) return false;
    if (selectedDiv && c.divisionNumber?.toString() !== selectedDiv) return false;
    return true;
  });
  const divOptions = [...new Set(classes.filter(c => !selectedYear || c.year === selectedYear).map(c => c.divisionNumber?.toString()))].sort();

  const handleYearChange = (yr) => {
    setSelectedYear(yr);
    setSelectedDiv('');
    const match = classes.find(c => c.year === yr);
    if (match) setSelectedClass(match._id);
  };
  const handleDivChange = (dv) => {
    setSelectedDiv(dv);
    const match = classes.find(c => c.year === (selectedYear || c.year) && c.divisionNumber?.toString() === dv);
    if (match) setSelectedClass(match._id);
  };

  useEffect(() => {
    if (classes.length > 0 && !selectedYear) {
      const firstClass = classes.find(c => c._id === selectedClass) || classes[0];
      setSelectedYear(firstClass.year || '');
      setSelectedDiv(firstClass.divisionNumber?.toString() || '');
    }
  }, [classes, selectedClass]);

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="subject-config-page">
      <div className="page-header">
        <h1>Batch Combine</h1>
        <div className="header-filters" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            YEAR
            <select value={selectedYear} onChange={e => handleYearChange(e.target.value)} style={{ minWidth: 80 }}>
              <option value="">All</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            SEMESTER
            <span style={{ padding: '6px 12px', background: 'rgba(59,130,246,0.15)', borderRadius: 6, color: '#60a5fa', fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>
              {activeSemester ? `${activeSemester.semester} sem (Sem ${currentSem})` : `Sem ${currentSem}`}
            </span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            DIVISION
            <select value={selectedDiv} onChange={e => handleDivChange(e.target.value)} style={{ minWidth: 80 }}>
              <option value="">All</option>
              {divOptions.map(d => <option key={d} value={d}>Div {d}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
            CLASS
            <select value={selectedClass} onChange={e => {
              setSelectedClass(e.target.value);
              const cls = classes.find(c => c._id === e.target.value);
              if (cls) { setSelectedYear(cls.year); setSelectedDiv(cls.divisionNumber?.toString() || ''); }
            }} style={{ minWidth: 140 }}>
              {(filteredClasses.length > 0 ? filteredClasses : classes).map(c => {
                const displaySem = getDynamicSem(c.year, c.semester);
                return (
                  <option key={c._id} value={c._id}>{c.name} (Sem {displaySem})</option>
                );
              })}
            </select>
          </label>
        </div>
      </div>



      {/* Subject Table */}
      <div className="config-table-card">
        <table className="config-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Theory hrs</th>
              <th>Faculty</th>
              <th>Combined Groups</th>
              <th>Fixed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => (
              <tr key={c._id} className={c.status === 'approved' ? 'approved-row' : ''}>
                <td><strong>{c.subject.code}</strong></td>
                <td>{c.subject.name}</td>
                <td><span className={`type-badge type-${c.subject.type}`}>{c.subject.type}</span></td>
                <td>{c.theoryHours || 0}</td>
                <td>{faculty.find(f => f._id === (c.theoryFacultyId?._id || c.theoryFacultyId))?.name || '—'}</td>
                <td>
                  {(c.combinedGroups || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {c.combinedGroups.map((g, i) => (
                        <span key={i} style={{
                          display: 'inline-flex', gap: 4, alignItems: 'center',
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: (g.type || c.subject.type) === 'practical' ? 'rgba(245,158,11,.12)' : 'rgba(59,130,246,.12)',
                          color: (g.type || c.subject.type) === 'practical' ? '#f59e0b' : '#60a5fa'
                        }}>
                          <span style={{ textTransform: 'uppercase', fontSize: 9, opacity: 0.7 }}>
                            {g.type || c.subject.type}
                          </span>
                          {(g.batches || []).join(' + ')}
                        </span>
                      ))}
                    </div>
                  ) : '—'}
                </td>
                <td>{(c.fixedSlots || []).length > 0 ? '📌' : '—'}</td>
                <td>
                  <button className="btn-sm" onClick={() => openEdit(c)} disabled={c.status === 'approved'}>Edit</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(c._id)} disabled={c.status === 'approved'}>×</button>
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr><td colSpan={8} className="empty-row">No subjects configured. Click "+ Add Subject" to start.</td></tr>
            )}
          </tbody>
        </table>

        <div className="table-actions">
          <button className="btn-primary" onClick={() => { resetForm(); setEditId(null); setShowModal(true); }}>+ Add Subject</button>
          {configs.length > 0 && allDraft && user?.role === 'coordinator' && (
            <button className="btn-submit" onClick={handleSubmitAll}>Submit All to HOD</button>
          )}
          {configs.length > 0 && allSubmitted && user?.role === 'hod' && (
            <button className="btn-approve" onClick={handleApproveAll}>Approve All</button>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-wide" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit' : 'Add'} Subject — Batch Combine</h2>
            
            {/* Subject Selection — pick from predefined subjects */}
            {availableSubjects.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
                  Select Subject {selectedYear ? `(${selectedYear} — Sem ${yearToSemMap[selectedYear]?.join(', ')})` : ''}
                </label>
                <SearchableSelect
                  options={availableSubjects.map(s => ({
                    value: s._id,
                    label: `${s.code} — ${s.name}`,
                    subtitle: `${s.type} | Sem ${s.semester} | ${s.weeklyHours} hrs/wk`
                  }))}
                  value={availableSubjects.find(s => s.code === form.subject.code)?._id || ''}
                  onChange={(subjectId) => {
                    const sub = availableSubjects.find(s => s._id === subjectId);
                    if (sub) {
                      setForm(f => ({
                        ...f,
                        subject: { code: sub.code, name: sub.name, type: sub.type || 'theory' },
                        theoryHours: sub.weeklyHours || sub.theoryHours || 0,
                        theoryFacultyId: sub.faculty?.[0]?._id || sub.faculty?.[0] || f.theoryFacultyId
                      }));
                    }
                  }}
                  placeholder="— Search and select a subject —"
                />
                {form.subject.code && (
                  <div style={{
                    marginTop: 8, padding: '8px 14px', borderRadius: 8, fontSize: 12,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                    color: '#10b981', display: 'flex', gap: 12, alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 700 }}>✓ {form.subject.code}</span>
                    <span>{form.subject.name}</span>
                    <span className={`type-badge type-${form.subject.type}`} style={{ fontSize: 10, padding: '1px 6px' }}>{form.subject.type}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '12px 16px', marginBottom: 16, borderRadius: 8,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                color: '#f59e0b', fontSize: 12
              }}>
                ⚠ No subjects found for {selectedYear || 'this year'}. Please add subjects in the <strong>Subjects</strong> section first, or enter manually below.
              </div>
            )}

            {/* Manual fallback / additional details with autocomplete datalists */}
            <div className="form-grid">
              <div className="form-group">
                <label>Subject Code</label>
                <input 
                  list="subject-codes-list"
                  value={form.subject.code} 
                  onChange={e => {
                    const val = e.target.value;
                    const found = allSubjects.find(s => s.code.toLowerCase() === val.toLowerCase() || s.code === val);
                    if (found) {
                      setForm(f => ({
                        ...f,
                        subject: { code: found.code, name: found.name, type: found.type || 'theory' },
                        theoryHours: found.weeklyHours || found.theoryHours || 0,
                        theoryFacultyId: found.faculty?.[0]?._id || found.faculty?.[0] || f.theoryFacultyId
                      }));
                    } else {
                      setForm(f => ({ ...f, subject: { ...f.subject, code: val } }));
                    }
                  }} 
                  placeholder="e.g. CS301" 
                />
                <datalist id="subject-codes-list">
                  {allSubjects.map(s => (
                    <option key={s._id} value={s.code}>{s.name} (Sem {s.semester})</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Subject Name</label>
                <input 
                  list="subject-names-list"
                  value={form.subject.name} 
                  onChange={e => {
                    const val = e.target.value;
                    const found = allSubjects.find(s => s.name.toLowerCase() === val.toLowerCase() || s.name === val);
                    if (found) {
                      setForm(f => ({
                        ...f,
                        subject: { code: found.code, name: found.name, type: found.type || 'theory' },
                        theoryHours: found.weeklyHours || found.theoryHours || 0,
                        theoryFacultyId: found.faculty?.[0]?._id || found.faculty?.[0] || f.theoryFacultyId
                      }));
                    } else {
                      setForm(f => ({ ...f, subject: { ...f.subject, name: val } }));
                    }
                  }} 
                  placeholder="e.g. Data Structures" 
                />
                <datalist id="subject-names-list">
                  {allSubjects.map(s => (
                    <option key={s._id} value={s.name}>{s.code} (Sem {s.semester})</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.subject.type} onChange={e => setForm(f => ({ ...f, subject: { ...f.subject, type: e.target.value } }))}>
                  {subjectTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Theory Hours/week</label>
                <input type="number" value={form.theoryHours} onChange={e => setForm(f => ({ ...f, theoryHours: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label>Faculty</label>
                <SearchableSelect
                  options={faculty.map(f => ({ value: f._id, label: f.name, subtitle: f.email }))}
                  value={form.theoryFacultyId}
                  onChange={(val) => setForm(f => ({ ...f, theoryFacultyId: val }))}
                  placeholder="— Select Faculty —"
                />
              </div>
            </div>

            {/* Combined Groups — the core of batch combining */}
            <div className="section-header" style={{ marginTop: 24 }}>
              <h3>🔗 Combined Batch Groups</h3>
              <button className="btn-sm" onClick={addCombinedGroup} style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 600
              }}>+ Add Group</button>
            </div>
            <div style={{
              padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 12,
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
              color: 'var(--text-muted)'
            }}>
              💡 Select which batches should be combined for this subject. For example, combine B1 + B2 for a joint theory/practical session.
            </div>

            {form.combinedGroups.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13,
                background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px dashed var(--border-color)'
              }}>
                No combined groups added. Click "+ Add Group" to select batches to combine.
              </div>
            )}

            {form.combinedGroups.map((group, gIdx) => (
              <div key={gIdx} style={{
                padding: '14px 16px', marginBottom: 10, borderRadius: 10,
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Group {gIdx + 1}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={group.type || form.subject.type}
                      onChange={e => {
                        const groups = [...form.combinedGroups];
                        groups[gIdx] = { ...groups[gIdx], type: e.target.value };
                        setForm(f => ({ ...f, combinedGroups: groups }));
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="theory">Theory</option>
                      <option value="practical">Practical</option>
                    </select>
                    <button className="btn-sm btn-danger" onClick={() => removeCombinedGroup(gIdx)} 
                      style={{ padding: '4px 10px', fontSize: 12 }}>×</button>
                  </div>
                </div>

                {/* Batch Selection Toggles */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', 
                    textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                    Select Batches to Combine
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {availableBatches.map(bl => {
                      const isSelected = group.batches.includes(bl);
                      // Check if batch is used in another group
                      const usedInOtherGroup = form.combinedGroups.some((g, i) => i !== gIdx && g.batches.includes(bl));
                      return (
                        <button
                          key={bl}
                          type="button"
                          disabled={usedInOtherGroup}
                          onClick={() => toggleBatchInGroup(gIdx, bl)}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: usedInOtherGroup ? 'not-allowed' : 'pointer',
                            border: isSelected
                              ? '2px solid #8b5cf6'
                              : usedInOtherGroup
                                ? '2px solid rgba(100,100,100,0.2)'
                                : '2px solid var(--border-color)',
                            background: isSelected
                              ? 'rgba(139,92,246,0.15)'
                              : usedInOtherGroup
                                ? 'rgba(100,100,100,0.05)'
                                : 'var(--bg-primary)',
                            color: isSelected
                              ? '#8b5cf6'
                              : usedInOtherGroup
                                ? 'var(--text-muted)'
                                : 'var(--text-secondary)',
                            opacity: usedInOtherGroup ? 0.5 : 1,
                            transition: 'all 0.2s ease',
                            minWidth: 50,
                            textAlign: 'center'
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{bl}
                          {usedInOtherGroup && <span style={{ fontSize: 9, display: 'block', marginTop: 2 }}>in use</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lab room — only for practical type */}
                {(group.type || form.subject.type) === 'practical' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Lab Room:</label>
                    <select
                      value={group.labId || ''}
                      onChange={e => {
                        const groups = [...form.combinedGroups];
                        groups[gIdx] = { ...groups[gIdx], labId: e.target.value };
                        setForm(f => ({ ...f, combinedGroups: groups }));
                      }}
                      style={{
                        flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
                        border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="">— Select Lab —</option>
                      {rooms.filter(r => r.type === 'lab').map(r => (
                        <option key={r._id} value={r._id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Show selected batches summary */}
                {group.batches.length > 0 && (
                  <div style={{
                    marginTop: 10, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: (group.type || form.subject.type) === 'practical'
                      ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.08)',
                    color: (group.type || form.subject.type) === 'practical'
                      ? '#f59e0b' : '#60a5fa',
                    border: `1px solid ${(group.type || form.subject.type) === 'practical'
                      ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`
                  }}>
                    {(group.type || form.subject.type).toUpperCase()}: {group.batches.join(' + ')} will be taught together
                  </div>
                )}
              </div>
            ))}

            {/* Fixed Slots */}
            <div className="section-header">
              <h3>Fixed Slots</h3>
              <button className="btn-sm" onClick={addFixedSlot}>+ Fixed Slot</button>
            </div>
            {form.fixedSlots.map((fs, idx) => (
              <div key={idx} className="fixed-slot-row">
                <select value={fs.day} onChange={e => {
                  const slots = [...form.fixedSlots];
                  slots[idx].day = e.target.value;
                  setForm(f => ({ ...f, fixedSlots: slots }));
                }}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => <option key={d}>{d}</option>)}
                </select>
                <input value={fs.startTime} onChange={e => {
                  const slots = [...form.fixedSlots];
                  slots[idx].startTime = e.target.value;
                  setForm(f => ({ ...f, fixedSlots: slots }));
                }} placeholder="08:15" />
                <input value={fs.endTime} onChange={e => {
                  const slots = [...form.fixedSlots];
                  slots[idx].endTime = e.target.value;
                  setForm(f => ({ ...f, fixedSlots: slots }));
                }} placeholder="09:15" />
                <button className="btn-sm btn-danger" onClick={() => {
                  setForm(f => ({ ...f, fixedSlots: f.fixedSlots.filter((_, i) => i !== idx) }));
                }}>×</button>
              </div>
            ))}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
