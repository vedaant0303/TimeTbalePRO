import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function AutoGenerate() {
  const { academicYear } = useApp();
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [semType, setSemType] = useState('even');
  const [yearGroup, setYearGroup] = useState('senior');
  const [visibility, setVisibility] = useState({ visibleToStudents: false, visibleToFaculty: false, totalEntries: 0 });
  const [publishing, setPublishing] = useState(false);
  const [liveTimeSlots, setLiveTimeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [form, setForm] = useState({
    department: '', division: 'all',
    miniProjectDays: 1, miniProjectHoursPerDay: 2,
    includeDLOC: true,
    useWorkloadFromDB: true
  });

  const oddSems = { fe: [1], senior: [3, 5, 7] };
  const evenSems = { fe: [2], senior: [4, 6, 8] };
  const getActiveSems = () => {
    const bucket = semType === 'odd' ? oddSems : evenSems;
    return yearGroup === 'fe' ? bucket.fe : bucket.senior;
  };
  const getSemLabel = (sem) => {
    if (sem <= 2) return `Sem ${sem} (FE)`;
    if (sem <= 4) return `Sem ${sem} (SE)`;
    if (sem <= 6) return `Sem ${sem} (TE)`;
    return `Sem ${sem} (BE)`;
  };

  // Parse time string for sorting (hours 1-6 treated as PM)
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    if (hours >= 1 && hours <= 6) hours += 12;
    return hours * 60 + minutes;
  };

  // Fetch live time slots from DB
  const fetchTimeSlots = useCallback(async (deptId) => {
    if (!academicYear) return;
    const dept = deptId || form.department;
    setLoadingSlots(true);
    try {
      const params = dept
        ? `/timeslots?academicYear=${academicYear}&department=${dept}`
        : `/timeslots?academicYear=${academicYear}`;
      const res = await api.get(params);
      const data = res.data || [];
      data.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      setLiveTimeSlots(data);
    } catch (err) { console.error('Failed to fetch time slots:', err); }
    finally { setLoadingSlots(false); }
  }, [academicYear, form.department]);

  useEffect(() => {
    api.get('/departments').then(res => {
      setDepartments(res.data);
      const defaultDept = (user?.role === 'coordinator')
        ? (user.department?._id || user.department || res.data[0]?._id)
        : res.data[0]?._id;
      if (defaultDept) setForm(p => ({ ...p, department: defaultDept }));
    }).finally(() => setLoading(false));
  }, []);

  // Fetch time slots when dept or academicYear changes
  useEffect(() => {
    if (form.department) fetchTimeSlots(form.department);
  }, [form.department, academicYear, dataRefreshKey]);

  // Fetch visibility status when department or academicYear changes
  useEffect(() => {
    if (form.department && academicYear) {
      fetchVisibility();
    }
  }, [form.department, academicYear]);

  const fetchVisibility = async () => {
    try {
      const res = await api.get(`/timetable/visibility-status?department=${form.department}&academicYear=${academicYear}`);
      setVisibility(res.data);
    } catch (err) { console.error(err); }
  };

  // Force refresh all dependent data before generation
  const refreshAllData = async () => {
    await fetchTimeSlots();
    setDataRefreshKey(k => k + 1);
  };

  const selectedDept = departments.find(d => d._id === form.department);
  const divisions = selectedDept?.divisions || ['1'];
  const activeSems = getActiveSems();

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      // Always refresh all data from DB before generating
      await refreshAllData();

      const payload = {
        department: form.department,
        division: form.division,
        semester: 'all',
        academicYear: academicYear || '2025-2026',
        semesterType: semType,
        yearGroup,
        semesters: activeSems,
        // New fields
        miniProjectDays: parseInt(form.miniProjectDays) || 0,
        miniProjectHoursPerDay: parseInt(form.miniProjectHoursPerDay) || 2,
        includeDLOC: form.includeDLOC,
        useWorkloadFromDB: form.useWorkloadFromDB
      };
      const res = await api.post('/timetable/auto-generate', payload);
      setResult(res.data);
      fetchVisibility(); // Refresh visibility after generation
    } catch (err) {
      const errData = err.response?.data || {};
      setResult({
        error: errData.message || 'Generation failed. Check server logs.',
        details: errData.details || '',
        hint: errData.hint || ''
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishToStudents = async () => {
    setPublishing(true);
    try {
      await api.post('/timetable/publish-to-students', {
        department: form.department,
        academicYear,
        visible: !visibility.visibleToStudents
      });
      fetchVisibility();
    } catch (err) { console.error(err); }
    finally { setPublishing(false); }
  };

  const handlePublishToFaculty = async () => {
    setPublishing(true);
    try {
      await api.post('/timetable/publish-to-faculty', {
        department: form.department,
        academicYear,
        visible: !visibility.visibleToFaculty
      });
      fetchVisibility();
    } catch (err) { console.error(err); }
    finally { setPublishing(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 750, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Auto Generate Timetable</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Generates timetable using faculty workload from DB, with constraint-based scheduling (Mon–Fri, 8:15 AM – 5:30 PM)
      </p>

      {/* Step 1: Odd/Even */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="form-label" style={{ marginBottom: 8 }}>Step 1 — Semester Type</label>
        <div className="tab-group">
          <button className={`tab ${semType === 'odd' ? 'active' : ''}`} onClick={() => setSemType('odd')}>Odd (1,3,5,7)</button>
          <button className={`tab ${semType === 'even' ? 'active' : ''}`} onClick={() => setSemType('even')}>Even (2,4,6,8)</button>
        </div>
      </div>

      {/* Step 2: FE / Senior */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="form-label" style={{ marginBottom: 8 }}>Step 2 — Year Group</label>
        <div className="tab-group">
          <button className={`tab ${yearGroup === 'fe' ? 'active' : ''}`} onClick={() => setYearGroup('fe')}>FE — Sem {semType === 'odd' ? '1' : '2'}</button>
          <button className={`tab ${yearGroup === 'senior' ? 'active' : ''}`} onClick={() => setYearGroup('senior')}>SE/TE/BE — Sem {semType === 'odd' ? '3,5,7' : '4,6,8'}</button>
        </div>
      </div>

      {/* Step 3: Dept & Division */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="form-label" style={{ marginBottom: 8 }}>Step 3 — Department & Division</label>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department}
              onChange={e => { setForm(p => ({ ...p, department: e.target.value, division: 'all' })); setResult(null); }}
              style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Division</label>
            <select className="form-select" value={form.division} onChange={e => setForm(p => ({ ...p, division: e.target.value }))}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Step 4: Mini Project & DLOC */}
      <div className="card" style={{ marginBottom: 16, border: '1px solid var(--primary-400)' }}>
        <label className="form-label" style={{ marginBottom: 12, color: 'var(--primary-400)' }}>Step 4 — Mini Project & DLOC Slots</label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Mini Project Days / Week</label>
            <select className="form-select" value={form.miniProjectDays} onChange={e => setForm(p => ({ ...p, miniProjectDays: e.target.value }))}>
              {[0,1,2,3].map(n => <option key={n} value={n}>{n} day{n !== 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mini Project Hours / Day</label>
            <select className="form-select" value={form.miniProjectHoursPerDay} onChange={e => setForm(p => ({ ...p, miniProjectHoursPerDay: e.target.value }))}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n} hour{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.includeDLOC} onChange={e => setForm(p => ({ ...p, includeDLOC: e.target.checked }))} />
            Include DLOC Subject slots
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.useWorkloadFromDB} onChange={e => setForm(p => ({ ...p, useWorkloadFromDB: e.target.checked }))} />
            Use Faculty Workload from DB
          </label>
        </div>

        {parseInt(form.miniProjectDays) > 0 && (
          <div style={{ marginTop: 10, background: 'var(--bg-tertiary)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)' }}>
            Mini Project: <strong>{form.miniProjectDays} day(s) × {form.miniProjectHoursPerDay} hr(s) = {form.miniProjectDays * form.miniProjectHoursPerDay} total hrs/week</strong>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="card" style={{ marginBottom: 16, background: yearGroup === 'fe' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: yearGroup === 'fe' ? 'var(--warning-400)' : 'var(--accent-400)' }}>
              {yearGroup === 'fe' ? 'FE' : 'SE/TE/BE'} — {semType === 'odd' ? 'Odd' : 'Even'} Semester
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>{selectedDept?.code}</strong> •{' '}
              {form.division === 'all' ? `All Divs (${divisions.join(', ')})` : `Div ${form.division}`} •{' '}
              {activeSems.map(s => getSemLabel(s)).join(', ')} •{' '}
              <strong>Mon–Fri only</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {activeSems.map(s => <span key={s} className="badge badge-primary" style={{ fontSize: 11 }}>{getSemLabel(s)}</span>)}
          </div>
        </div>
      </div>

      {/* Time Slots Preview — Live from DB */}
      <div className="card" style={{ marginBottom: 16, background: 'var(--bg-tertiary)', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
            Time Slots Used (Mon–Fri) — <span style={{ color: 'var(--primary-400)' }}>Live from DB</span>
          </div>
          <button
            className="btn btn-sm"
            style={{ padding: '2px 10px', fontSize: 11, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}
            onClick={refreshAllData}
            disabled={loadingSlots}
          >
            {loadingSlots ? '⏳' : '🔄'} Refresh
          </button>
        </div>
        {liveTimeSlots.length === 0 ? (
          <div style={{ padding: '12px 0', color: '#ef4444', fontWeight: 600 }}>
            ⚠️ No time slots configured for {academicYear}. Please add time slots before generating.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {liveTimeSlots.map(s => (
                <span key={s._id} className={`badge ${s.isBreak ? 'badge-warning' : 'badge-info'}`}>
                  {s.startTime}-{s.endTime}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
              {liveTimeSlots.filter(s => !s.isBreak).length} teaching slots • {liveTimeSlots.filter(s => s.isBreak).length} breaks •
              {' '}{(() => {
                let pairs = 0;
                for (let i = 0; i < liveTimeSlots.length - 1; i++) {
                  if (!liveTimeSlots[i].isBreak && !liveTimeSlots[i + 1].isBreak && liveTimeSlots[i].endTime === liveTimeSlots[i + 1].startTime) pairs++;
                }
                return pairs;
              })()} consecutive pairs for practicals
            </div>
          </>
        )}
      </div>

      {/* Warning */}
      <div style={{ background: 'rgba(245,158,11,0.08)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 12, color: 'var(--warning-400)', border: '1px solid rgba(245,158,11,0.15)' }}>
        This will clear existing entries for the selected config and regenerate. Ensure faculty workload is saved first.
      </div>

      {/* Generate Button */}
      <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerate} disabled={generating}>
        {generating ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
            Generating...
          </span>
        ) : (
          `Generate ${yearGroup === 'fe' ? 'FE' : 'SE/TE/BE'} Timetable (Mon–Fri, ${semType === 'odd' ? 'Odd' : 'Even'})`
        )}
      </button>

      {/* ─── VISIBILITY CONTROL ─── */}
      {visibility.totalEntries > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header" style={{ marginBottom: 14 }}>
            <div>
              <div className="card-title">Timetable Visibility Control</div>
              <div className="card-subtitle">{visibility.totalEntries} entries for {selectedDept?.name || 'this department'} — {academicYear}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Display to Students button */}
            <button
              className="btn btn-lg"
              style={{
                flex: 1, minWidth: 200, justifyContent: 'center',
                background: visibility.visibleToStudents
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)' 
                  : 'linear-gradient(135deg, #6b7280, #9ca3af)',
                color: '#fff', border: 'none',
                boxShadow: visibility.visibleToStudents ? '0 4px 12px rgba(22,163,74,0.3)' : 'none'
              }}
              onClick={handlePublishToStudents}
              disabled={publishing}
            >
              {visibility.visibleToStudents ? 'Visible to Students ✓' : 'Display to Students'}
            </button>
            
            {/* Display to Faculty button */}
            <button
              className="btn btn-lg"
              style={{
                flex: 1, minWidth: 200, justifyContent: 'center',
                background: visibility.visibleToFaculty
                  ? 'linear-gradient(135deg, #2563eb, #3b82f6)' 
                  : 'linear-gradient(135deg, #6b7280, #9ca3af)',
                color: '#fff', border: 'none',
                boxShadow: visibility.visibleToFaculty ? '0 4px 12px rgba(37,99,235,0.3)' : 'none'
              }}
              onClick={handlePublishToFaculty}
              disabled={publishing}
            >
              {visibility.visibleToFaculty ? 'Visible to Faculty ✓' : 'Display to Faculty'}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            {!visibility.visibleToStudents && !visibility.visibleToFaculty && (
              <span>Timetable is currently hidden from students and faculty. Click above to make it visible.</span>
            )}
            {visibility.visibleToStudents && !visibility.visibleToFaculty && (
              <span>Students can see the timetable. Faculty cannot see it yet.</span>
            )}
            {!visibility.visibleToStudents && visibility.visibleToFaculty && (
              <span>Faculty can see the timetable. Students cannot see it yet.</span>
            )}
            {visibility.visibleToStudents && visibility.visibleToFaculty && (
              <span>Timetable is visible to both students and faculty. Click to hide.</span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="card" style={{ marginTop: 20 }}>
          {result.error ? (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '20px 24px'
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>
                {result.error}
              </div>
              {result.details && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{result.details}</p>
              )}
              {result.hint && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 16 }}>
                  {result.hint}
                </p>
              )}
              <a href="/workload" className="btn btn-primary" style={{ fontSize: 13 }}>
                Go to Faculty Workload
              </a>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--accent-400)' }}>Timetable Generated!</h3>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                  <div><div className="stat-value" style={{ color: 'var(--accent-400)' }}>{result.placed}</div><div className="stat-label">Placed</div></div>
                </div>
                <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                  <div><div className="stat-value">{result.totalRequired}</div><div className="stat-label">Required</div></div>
                </div>
                <div className="stat-card" style={{ flex: 1, minWidth: 120, borderColor: result.unplaced > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }}>
                  <div><div className="stat-value" style={{ color: result.unplaced > 0 ? 'var(--error-400)' : 'var(--accent-400)' }}>{result.unplaced}</div><div className="stat-label">Unplaced</div></div>
                </div>
              </div>

              {result.divisions?.length > 0 && (
                <div className="table-wrapper" style={{ marginBottom: 16 }}>
                  <table>
                    <thead><tr><th>Division</th><th>Semester</th><th>Placed</th><th>Unplaced</th><th>Total</th></tr></thead>
                    <tbody>
                      {result.divisions.map((d, i) => (
                        <tr key={i}>
                          <td>Div {d.division}</td>
                          <td>{getSemLabel(d.semester)}</td>
                          <td style={{ color: 'var(--accent-400)' }}>{d.placed}</td>
                          <td style={{ color: d.unplaced > 0 ? 'var(--error-400)' : 'var(--accent-400)' }}>{d.unplaced}</td>
                          <td>{d.required}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Clash Report */}
              {result.clashReport?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 10 }}>
                    {result.clashReport.length} Conflict{result.clashReport.length !== 1 ? 's' : ''} Detected
                  </h4>
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                    {result.clashReport.map((c, i) => (
                      <div key={i} style={{
                        padding: '10px 14px', fontSize: 12,
                        borderBottom: i < result.clashReport.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none',
                        background: i % 2 === 0 ? 'rgba(239,68,68,0.05)' : 'transparent'
                      }}>
                        <span style={{ fontWeight: 700, color: c.type === 'faculty' ? '#f97316' : '#ef4444' }}>
                          {c.type === 'faculty' ? '○' : '□'} {c.type.toUpperCase()}:
                        </span>{' '}
                        <span>{c.message}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    These conflicts occur with other departments' timetables. Adjust faculty assignments or re-generate to resolve.
                  </p>
                </div>
              )}

              <a href="/timetable-editor" className="btn btn-secondary">View in Editor</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
