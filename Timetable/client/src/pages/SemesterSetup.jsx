import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import '../styles/semester-setup.css';

export default function SemesterSetup() {
  const { user } = useAuth();
  const { departments } = useApp();
  const [configs, setConfigs] = useState([]);
  const [activeConfig, setActiveConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedSemType, setSelectedSemType] = useState('');
  const [toast, setToast] = useState(null);
  const [prereqStats, setPrereqStats] = useState({ rooms: 0, subjects: 0, faculty: 0, workloads: 0 });

  // Dynamic academic year: July-Dec = YYYY-(YYYY+1), Jan-June = (YYYY-1)-YYYY
  const getDefaultAcademicYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    if (month >= 7) return `${year}-${year + 1}`;
    return `${year - 1}-${year}`;
  };

  // Auto-detect odd/even: July-Dec=odd, Jan-June=even
  const getDefaultSemType = () => {
    const month = new Date().getMonth() + 1;
    return month >= 7 ? 'odd' : 'even';
  };

  const [form, setForm] = useState({
    semester: getDefaultSemType(),
    academicYear: getDefaultAcademicYear(),
    departments: [],
    effectiveFrom: '',
    termStartDate: '',
    termEndDate: ''
  });

  const stateLabels = {
    idle: { label: 'Idle', icon: '⏸', color: '#6b7280' },
    semester_init: { label: 'Setup', icon: '⚙', color: '#3b82f6' },
    rooms_configured: { label: 'Rooms', icon: '◻', color: '#8b5cf6' },
    workload_pending: { label: 'Workload', icon: '▤', color: '#f59e0b' },
    subject_config_pending: { label: 'Subjects', icon: '▦', color: '#f97316' },
    ready_to_generate: { label: 'Ready', icon: '✓', color: '#10b981' },
    generating: { label: 'Generating', icon: '↻', color: '#6366f1' },
    draft_generated: { label: 'Draft', icon: '✎', color: '#14b8a6' },
    pending_approval: { label: 'Approval', icon: '◷', color: '#eab308' },
    approved: { label: 'Approved', icon: '✓', color: '#22c55e' },
    rejected: { label: 'Rejected', icon: '✗', color: '#ef4444' },
    published: { label: 'Published', icon: '▶', color: '#0596d9' }
  };

  const stateOrder = Object.keys(stateLabels);

  useEffect(() => { fetchConfigs(); }, []);
  useEffect(() => { if (activeConfig) fetchPrereqStats(); }, [activeConfig]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/semester');
      setConfigs(data);
      const active = data.find(c => c.isActive);
      if (active) {
        setActiveConfig(active);
        setSelectedSemType(active.semester);
      } else if (data.length > 0) {
        setSelectedSemType(data[0].semester);
        setActiveConfig(data[0]);
      } else {
        setSelectedSemType(getDefaultSemType());
      }
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch prerequisite stats to validate state transitions dynamically
  const fetchPrereqStats = async () => {
    try {
      const deptId = user?.department?._id || user?.department;
      const [roomRes, subRes, facRes] = await Promise.all([
        api.get('/rooms').catch(() => ({ data: [] })),
        api.get(`/subjects${deptId ? `?department=${deptId}` : ''}`).catch(() => ({ data: [] })),
        api.get('/users?role=faculty').catch(() => ({ data: [] }))
      ]);
      setPrereqStats({
        rooms: roomRes.data?.length || 0,
        subjects: subRes.data?.length || 0,
        faculty: facRes.data?.length || 0
      });
    } catch (e) {
      console.warn('Prereq stats error:', e);
    }
  };

  const handleSelectSemType = (type) => {
    setSelectedSemType(type);
    const match = configs.find(c => c.semester === type);
    setActiveConfig(match || null);
  };

  const handleCreate = async () => {
    if (!form.academicYear) return showToast('Academic year is required', 'error');
    if (form.departments.length === 0) return showToast('Select at least one department', 'error');
    try {
      const { data } = await api.post('/semester', form);
      setActiveConfig(data);
      setConfigs(prev => [data, ...prev]);
      setShowCreate(false);
      setSelectedSemType(data.semester);
      showToast('Semester config created successfully!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create semester config', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!activeConfig) return;
    try {
      const { data } = await api.put(`/semester/${activeConfig._id}`, form);
      setActiveConfig(data);
      setShowEdit(false);
      fetchConfigs();
      showToast('Semester config updated!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update', 'error');
    }
  };

  const handleAdvanceState = async (newState) => {
    try {
      const { data } = await api.put(`/semester/${activeConfig._id}/state`, {
        newState,
        note: `Advanced to ${newState}`
      });
      setActiveConfig(data);
      fetchConfigs();
      showToast(`State advanced to "${stateLabels[newState]?.label}"`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to advance state', 'error');
    }
  };

  const handleReset = async () => {
    if (!activeConfig) return;
    if (!window.confirm('Reset this semester to idle? This will NOT delete any generated timetable data.')) return;
    try {
      const { data } = await api.put(`/semester/${activeConfig._id}/state`, {
        newState: 'idle',
        note: 'Manual reset to idle'
      });
      setActiveConfig(data);
      fetchConfigs();
      showToast('Semester reset to idle');
    } catch (err) {
      // If state machine doesn't allow direct transition to idle, force it via update
      try {
        await api.put(`/semester/${activeConfig._id}`, { generationState: 'idle' });
        fetchConfigs();
        showToast('Semester force-reset to idle');
      } catch (e) {
        showToast('Failed to reset: ' + (e.response?.data?.message || e.message), 'error');
      }
    }
  };

  const openEdit = () => {
    setForm({
      semester: activeConfig.semester,
      academicYear: activeConfig.academicYear,
      departments: (activeConfig.departments || []).map(d => d._id || d),
      effectiveFrom: activeConfig.effectiveFrom ? new Date(activeConfig.effectiveFrom).toISOString().split('T')[0] : '',
      termStartDate: activeConfig.termStartDate ? new Date(activeConfig.termStartDate).toISOString().split('T')[0] : '',
      termEndDate: activeConfig.termEndDate ? new Date(activeConfig.termEndDate).toISOString().split('T')[0] : ''
    });
    setShowEdit(true);
  };

  const currentIdx = activeConfig ? stateOrder.indexOf(activeConfig.generationState) : -1;

  const getActiveSemesters = () => {
    if (!activeConfig) return [];
    if (activeConfig.semester === 'odd') return [1, 3, 5, 7];
    return [2, 4, 6, 8];
  };

  // Get prerequisite description for each state
  const getPrereqInfo = (state) => {
    switch (state) {
      case 'rooms_configured':
        return { label: 'Rooms Available', value: prereqStats.rooms, ok: prereqStats.rooms > 0 };
      case 'workload_pending':
        return { label: 'Faculty Available', value: prereqStats.faculty, ok: prereqStats.faculty > 0 };
      case 'subject_config_pending':
        return { label: 'Subjects Available', value: prereqStats.subjects, ok: prereqStats.subjects > 0 };
      default:
        return null;
    }
  };

  const selectAllDepts = () => setForm(f => ({ ...f, departments: (departments || []).map(d => d._id) }));
  const deselectAllDepts = () => setForm(f => ({ ...f, departments: [] }));

  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="semester-setup">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <div className="page-header">
        <h1>Semester Setup</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeConfig && (
            <button className="btn btn-secondary" onClick={openEdit}>
              Edit Config
            </button>
          )}
          <button className="btn btn-primary" onClick={() => {
            setForm({
              semester: selectedSemType || getDefaultSemType(),
              academicYear: getDefaultAcademicYear(),
              departments: (departments || []).map(d => d._id),
              effectiveFrom: '', termStartDate: '', termEndDate: ''
            });
            setShowCreate(true);
          }}>
            + New Semester
          </button>
        </div>
      </div>

      {/* Odd / Even Tabs */}
      <div className="tab-group" style={{ marginBottom: 24 }}>
        <button
          className={`tab ${selectedSemType === 'odd' ? 'active' : ''}`}
          onClick={() => handleSelectSemType('odd')}
        >
          Odd Semester (1, 3, 5, 7)
        </button>
        <button
          className={`tab ${selectedSemType === 'even' ? 'active' : ''}`}
          onClick={() => handleSelectSemType('even')}
        >
          Even Semester (2, 4, 6, 8)
        </button>
      </div>

      {/* Info Banner */}
      {activeConfig && (
        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Academic Year</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{activeConfig.academicYear}</p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Type</p>
              <p style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>{activeConfig.semester} Semester</p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Active Semesters</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{getActiveSemesters().join(', ')}</p>
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Departments</p>
              <p style={{ fontSize: 16, fontWeight: 600 }}>
                {activeConfig.departments?.length || 0} selected
              </p>
            </div>
            {activeConfig.termStartDate && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Term Dates</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>
                  {new Date(activeConfig.termStartDate).toLocaleDateString()} — {activeConfig.termEndDate ? new Date(activeConfig.termEndDate).toLocaleDateString() : '...'}
                </p>
              </div>
            )}
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Year Groups</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="badge badge-warning">FE (Separate TT)</span>
                <span className="badge badge-primary">SE / TE / BE</span>
              </div>
            </div>
          </div>

          {/* Prerequisite Stats */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {[
              { label: 'Rooms', value: prereqStats.rooms, icon: '◻', color: prereqStats.rooms > 0 ? '#16a34a' : '#ef4444' },
              { label: 'Subjects', value: prereqStats.subjects, icon: '▦', color: prereqStats.subjects > 0 ? '#16a34a' : '#ef4444' },
              { label: 'Faculty', value: prereqStats.faculty, icon: '◉', color: prereqStats.faculty > 0 ? '#16a34a' : '#ef4444' }
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span>{s.icon}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}:</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State Machine Tracker */}
      {activeConfig && (
        <div className="state-tracker-card">
          <div className="state-tracker-header">
            <h2>Generation Workflow</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="state-badge" style={{
                background: stateLabels[activeConfig.generationState]?.color || '#6b7280'
              }}>
                {stateLabels[activeConfig.generationState]?.icon} {stateLabels[activeConfig.generationState]?.label}
              </span>
              {activeConfig.generationState !== 'idle' && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={handleReset}
                  title="Reset workflow back to idle"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="state-pipeline">
            {stateOrder.map((state, idx) => {
              const info = stateLabels[state];
              const isActive = state === activeConfig.generationState;
              const isPast = idx < currentIdx;
              const prereq = getPrereqInfo(state);
              return (
                <div key={state} className={`pipeline-step ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''}`} title={prereq ? `${prereq.label}: ${prereq.value}` : ''}>
                  <div className="step-dot" style={{ background: isPast || isActive ? info.color : 'var(--bg-tertiary)' }}>
                    {isPast ? '✓' : info.icon}
                  </div>
                  <span className="step-label">{info.label}</span>
                  {prereq && isActive && (
                    <span style={{ fontSize: 10, color: prereq.ok ? '#16a34a' : '#ef4444', marginTop: 2 }}>
                      {prereq.ok ? '✓' : '✗'} {prereq.value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="state-actions">
            {activeConfig.generationState === 'idle' && (
              <button className="btn btn-primary" onClick={() => handleAdvanceState('semester_init')}>
                Initialize Semester
              </button>
            )}
            {activeConfig.generationState === 'semester_init' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => handleAdvanceState('rooms_configured')}>
                  ✓ Rooms Configured → Next
                </button>
                <span style={{ fontSize: 12, color: prereqStats.rooms > 0 ? '#16a34a' : '#ef4444' }}>
                  ({prereqStats.rooms} rooms available)
                </span>
              </div>
            )}
            {activeConfig.generationState === 'rooms_configured' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => handleAdvanceState('workload_pending')}>
                  ✓ Confirm Rooms → Workload Upload
                </button>
                <span style={{ fontSize: 12, color: prereqStats.faculty > 0 ? '#16a34a' : '#ef4444' }}>
                  ({prereqStats.faculty} faculty available)
                </span>
              </div>
            )}
            {activeConfig.generationState === 'workload_pending' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => handleAdvanceState('subject_config_pending')}>
                  ✓ Workload Submitted → Batch Combine
                </button>
              </div>
            )}
            {activeConfig.generationState === 'subject_config_pending' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => handleAdvanceState('ready_to_generate')}>
                  ✓ All Approved → Ready
                </button>
                <span style={{ fontSize: 12, color: prereqStats.subjects > 0 ? '#16a34a' : '#ef4444' }}>
                  ({prereqStats.subjects} subjects configured)
                </span>
              </div>
            )}
            {activeConfig.generationState === 'ready_to_generate' && (
              <button className="btn-generate" onClick={async () => {
                handleAdvanceState('generating');
                try {
                  await api.post('/timetable/generate', { semesterId: activeConfig._id });
                  fetchConfigs();
                } catch (err) {
                  showToast(err.response?.data?.message || 'Generation failed', 'error');
                  fetchConfigs();
                }
              }}>
                Generate Timetable
              </button>
            )}
            {activeConfig.generationState === 'draft_generated' && (
              <button className="btn btn-primary" onClick={() => handleAdvanceState('pending_approval')}>
                Submit for Approval
              </button>
            )}
            {activeConfig.generationState === 'pending_approval' && ['principal', 'hod'].includes(user?.role) && (
              <div className="approval-btns">
                <button className="btn-approve" onClick={() => handleAdvanceState('approved')}>Approve</button>
                <button className="btn-reject" onClick={() => handleAdvanceState('rejected')}>Reject</button>
              </div>
            )}
            {activeConfig.generationState === 'approved' && (
              <button className="btn-publish" onClick={() => handleAdvanceState('published')}>Publish</button>
            )}
            {activeConfig.generationState === 'rejected' && (
              <button className="btn-warning" onClick={() => handleAdvanceState('draft_generated')}>Back to Draft</button>
            )}
          </div>

          {/* State History */}
          {(activeConfig.stateHistory || []).length > 0 && (
            <div className="state-history">
              <h3>State History</h3>
              <div className="history-list">
                {(activeConfig.stateHistory || []).slice().reverse().map((h, i) => (
                  <div key={i} className="history-item">
                    <span className="history-state">{stateLabels[h.state]?.icon} {stateLabels[h.state]?.label}</span>
                    <span className="history-time">{new Date(h.changedAt).toLocaleString()}</span>
                    {h.note && <span className="history-note">{h.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Config for this type */}
      {!activeConfig && selectedSemType && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>—</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>No {selectedSemType} semester configuration found.</p>
          <button className="btn btn-primary" onClick={() => {
            setForm(f => ({
              ...f,
              semester: selectedSemType,
              academicYear: getDefaultAcademicYear(),
              departments: (departments || []).map(d => d._id)
            }));
            setShowCreate(true);
          }}>
            Create {selectedSemType === 'odd' ? 'Odd' : 'Even'} Semester Config
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreate || showEdit) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setShowEdit(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{showEdit ? 'Edit Semester Config' : 'Create New Semester'}</div>
              <button className="modal-close" onClick={() => { setShowCreate(false); setShowEdit(false); }}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Semester Type</label>
              <select className="form-select" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} disabled={showEdit}>
                <option value="odd">Odd (Semesters 1, 3, 5, 7)</option>
                <option value="even">Even (Semesters 2, 4, 6, 8)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <select className="form-select" value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}>
                {(() => {
                  const now = new Date().getFullYear();
                  const options = [];
                  for (let y = now - 1; y <= now + 2; y++) {
                    options.push(`${y}-${y + 1}`);
                  }
                  return options.map(o => <option key={o} value={o}>{o}</option>);
                })()}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Departments</span>
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={selectAllDepts}>All</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={deselectAllDepts}>None</button>
                </div>
              </label>
              <div className="dept-checkboxes">
                {(departments || []).map(d => (
                  <label key={d._id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.departments.includes(d._id)}
                      onChange={e => {
                        if (e.target.checked) setForm(f => ({ ...f, departments: [...f.departments, d._id] }));
                        else setForm(f => ({ ...f, departments: f.departments.filter(id => id !== d._id) }));
                      }}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Term Start</label>
                <input className="form-input" type="date" value={form.termStartDate} onChange={e => setForm(f => ({ ...f, termStartDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Term End</label>
                <input className="form-input" type="date" value={form.termEndDate} onChange={e => setForm(f => ({ ...f, termEndDate: e.target.value }))} />
              </div>
            </div>

            <div className="card" style={{ padding: 14, marginTop: 8, marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Year Groups (auto-configured):</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-warning">FE → Separate Timetable</span>
                <span className="badge badge-primary">SE / TE / BE → Combined Schedule</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                {form.semester === 'odd' ? 'Odd: Sem 1 (FE) + Sem 3, 5, 7 (SE/TE/BE)' : 'Even: Sem 2 (FE) + Sem 4, 6, 8 (SE/TE/BE)'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setShowEdit(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={showEdit ? handleUpdate : handleCreate}>
                {showEdit ? 'Save Changes' : 'Create Semester'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
