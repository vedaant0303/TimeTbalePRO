import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DEFAULT_SLOTS = [
  { slotNumber: 1, startTime: '8:15', endTime: '9:15', isBreak: false, breakType: 'none' },
  { slotNumber: 2, startTime: '9:15', endTime: '10:15', isBreak: false, breakType: 'none' },
  { slotNumber: 3, startTime: '10:15', endTime: '11:15', isBreak: false, breakType: 'none' },
  { slotNumber: 4, startTime: '11:15', endTime: '11:30', isBreak: true, breakType: 'short' },
  { slotNumber: 5, startTime: '11:30', endTime: '12:30', isBreak: false, breakType: 'none' },
  { slotNumber: 6, startTime: '12:30', endTime: '1:30', isBreak: false, breakType: 'none' },
  { slotNumber: 7, startTime: '1:30', endTime: '2:30', isBreak: true, breakType: 'lunch' },
  { slotNumber: 8, startTime: '2:30', endTime: '3:30', isBreak: false, breakType: 'none' },
  { slotNumber: 9, startTime: '3:30', endTime: '4:30', isBreak: false, breakType: 'none' },
  { slotNumber: 10, startTime: '4:30', endTime: '5:30', isBreak: false, breakType: 'none' },
];

export default function TimeSlots() {
  const { academicYear } = useApp();
  const { user } = useAuth();
  const isCoordinator = user?.role === 'coordinator';
  const isHOD = user?.role === 'hod';
  const hasDeptFilter = (isCoordinator || isHOD) && user.department;

  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState(hasDeptFilter ? (user.department?._id || user.department) : '');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');

  const YEAR_OPTIONS = [
    { value: '', label: 'All Years' },
    { value: 2, label: 'SE (2nd Year)' },
    { value: 3, label: 'TE (3rd Year)' },
    { value: 4, label: 'BE (4th Year)' },
  ];

  const getSemesterOptions = (yr) => {
    if (!yr) return [];
    const y = parseInt(yr);
    const odd = (y - 1) * 2 + 1;
    const even = odd + 1;
    return [
      { value: '', label: 'Both Semesters' },
      { value: odd, label: `Sem ${odd} (Odd)` },
      { value: even, label: `Sem ${even} (Even)` },
    ];
  };

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startTime: '', endTime: '', isBreak: false, breakType: 'none' });
  const [toast, setToast] = useState(null);
  const [editId, setEditId] = useState(null);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [redistributing, setRedistributing] = useState(false);
  const [impactData, setImpactData] = useState(null);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [slotsChanged, setSlotsChanged] = useState(false);

  useEffect(() => { if (academicYear) fetchSlots(); }, [academicYear, filterDept, filterYear, filterSem]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Parse time string (e.g. '8:15', '1:30', '03:30') to minutes for sorting
  // Hours 1-6 are treated as PM since college schedules run ~8 AM to ~6 PM
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    if (hours >= 1 && hours <= 6) hours += 12;
    return hours * 60 + minutes;
  };

  const fetchSlots = async () => {
    try {
      let url = `/timeslots?academicYear=${academicYear}`;
      if (filterDept) url += `&department=${filterDept}`;
      if (filterYear) url += `&year=${filterYear}`;
      if (filterSem) url += `&semester=${filterSem}`;
      const [slotsRes, deptsRes] = await Promise.all([
        api.get(url),
        api.get('/departments')
      ]);
      const data = slotsRes.data || [];
      data.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      setSlots(data);
      setDepartments(deptsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Validate hours allocation
  const handleValidate = async () => {
    if (!filterDept) return showToast('Please select a department first to validate', 'error');
    setValidating(true);
    try {
      const params = new URLSearchParams();
      if (academicYear) params.append('academicYear', academicYear);
      params.append('department', filterDept);
      const res = await api.get(`/timetable/validate-hours?${params}`);
      setValidation(res.data);
      if (res.data.valid) {
        showToast('✅ All subject hours are properly allocated!');
      } else {
        showToast(`⚠️ Found ${res.data.errors} error(s) and ${res.data.warnings} warning(s)`, 'error');
      }
    } catch (err) {
      showToast('Validation failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally { setValidating(false); }
  };

  // Redistribute hours after slot changes
  const handleRedistribute = async () => {
    if (!filterDept) return showToast('Please select a department first', 'error');
    if (!window.confirm('This will redistribute timetable entries to fix hour allocations and ensure practicals are in consecutive slots. Continue?')) return;
    setRedistributing(true);
    try {
      const payload = { department: filterDept };
      if (academicYear) payload.academicYear = academicYear;
      const res = await api.post('/timetable/redistribute', payload);
      showToast(`✅ ${res.data.message}`);
      setSlotsChanged(false);
      setValidation(null);
      // Re-validate after redistribution
      setTimeout(() => handleValidate(), 500);
    } catch (err) {
      showToast('Redistribution failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally { setRedistributing(false); }
  };

  // Check impact before deleting
  const checkImpactAndDelete = async (id) => {
    try {
      const res = await api.get(`/timeslots/impact/${id}`);
      if (res.data.totalAffected > 0) {
        setImpactData(res.data);
        setPendingDeleteId(id);
        setShowImpactModal(true);
      } else {
        // No impact — safe to delete directly
        if (!window.confirm('Delete this time slot?')) return;
        await performDelete(id);
      }
    } catch (err) {
      // Impact check failed, fall back to direct delete
      if (!window.confirm('Delete this time slot?')) return;
      await performDelete(id);
    }
  };

  const performDelete = async (id, force = false) => {
    try {
      const url = force ? `/timeslots/${id}?force=true` : `/timeslots/${id}`;
      const res = await api.delete(url);
      if (res.data.warning) {
        showToast(`⚠️ ${res.data.warning}`, 'error');
        setSlotsChanged(true);
      } else {
        showToast('Slot deleted');
      }
      fetchSlots();
      setShowImpactModal(false);
      setPendingDeleteId(null);
      setImpactData(null);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requiresForce) {
        setImpactData(err.response.data);
        setPendingDeleteId(id);
        setShowImpactModal(true);
      } else {
        showToast('Delete failed: ' + (err.response?.data?.message || err.message), 'error');
      }
    }
  };

  const handleSeedDefaults = async () => {
    if (!filterDept) return showToast('Please select a department first', 'error');
    if (!window.confirm('This will DELETE all existing time slots for this academic year and department, and insert the default schedule (8:15 AM – 5:30 PM). Continue?')) return;
    setSeeding(true);
    try {
      await api.post('/timeslots/seed-defaults', {
        academicYear,
        department: filterDept,
        ...(filterYear ? { year: parseInt(filterYear) } : {}),
        ...(filterSem ? { semester: parseInt(filterSem) } : {})
      });
      showToast('Default time slots created (8:15 AM – 5:30 PM)');
      setSlotsChanged(true);
      await fetchSlots();
    } catch (err) {
      showToast('Failed: ' + (err.response?.data?.message || err.message || 'Unknown error'), 'error');
    } finally { setSeeding(false); }
  };

  const handleAdd = async () => {
    if (!form.startTime || !form.endTime) return showToast('Start and end time required', 'error');
    
    // Validate that hours are fully entered
    if (!form.startTime.includes(':') || !form.endTime.includes(':')) {
      return showToast('Please select both hour and minute', 'error');
    }

    const currentStart = parseTimeToMinutes(form.startTime);
    const currentEnd = parseTimeToMinutes(form.endTime);

    if (currentStart >= currentEnd) {
      return showToast('End time must be after start time', 'error');
    }

    const isOverlap = slots.some(slot => {
      if (editId && slot._id === editId) return false;
      const sStart = parseTimeToMinutes(slot.startTime);
      const sEnd = parseTimeToMinutes(slot.endTime);
      return currentStart < sEnd && currentEnd > sStart;
    });

    if (isOverlap) {
      return showToast('Time slot overlaps with an existing slot', 'error');
    }

    try {
      if (editId) {
        const res = await api.put(`/timeslots/${editId}`, {
          ...form,
          academicYear,
          department: filterDept,
          ...(filterYear ? { year: parseInt(filterYear) } : {}),
          ...(filterSem ? { semester: parseInt(filterSem) } : {})
        });
        if (res.data._warning) {
          showToast(`⚠️ ${res.data._warning}`, 'error');
          setSlotsChanged(true);
        } else {
          showToast('Slot updated');
        }
      } else {
        await api.post('/timeslots', {
          ...form,
          slotNumber: slots.length + 1,
          academicYear,
          department: filterDept,
          ...(filterYear ? { year: parseInt(filterYear) } : {}),
          ...(filterSem ? { semester: parseInt(filterSem) } : {})
        });
        showToast('Slot added');
        setSlotsChanged(true);
      }
      fetchSlots();
      setShowForm(false);
      setEditId(null);
      setForm({ startTime: '', endTime: '', isBreak: false, breakType: 'none' });
    } catch (err) { showToast('' + (err.response?.data?.message || err.message), 'error'); }
  };

  const handleDelete = async (id) => {
    await checkImpactAndDelete(id);
  };

  const handleEdit = (slot) => {
    setEditId(slot._id);
    setForm({ startTime: slot.startTime, endTime: slot.endTime, isBreak: slot.isBreak, breakType: slot.breakType || 'none' });
    setShowForm(true);
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  const teachingSlots = slots.filter(s => !s.isBreak);
  const breakSlots = slots.filter(s => s.isBreak);

  // Identify consecutive pairs
  const consecutivePairs = new Set();
  for (let i = 0; i < slots.length - 1; i++) {
    if (!slots[i].isBreak && !slots[i + 1].isBreak && slots[i].endTime === slots[i + 1].startTime) {
      consecutivePairs.add(slots[i]._id);
      consecutivePairs.add(slots[i + 1]._id);
    }
  }

  // Note: custom time selector components are handled directly in the render function.

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--error-400)' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600,
          maxWidth: 450
        }}>{toast.msg}</div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Time Slot Configuration</div>
            <div className="card-subtitle">Academic Year: {academicYear} — Configure daily time slots</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => { 
                if (!filterDept) return showToast('Please select a department first', 'error');
                setShowForm(!showForm); 
                setEditId(null); 
                setForm({ startTime: '', endTime: '', isBreak: false, breakType: 'none' }); 
            }}>
              {showForm ? '×' : '+ Add Slot'}
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none' }}
              onClick={handleSeedDefaults}
              disabled={seeding || !filterDept}
            >
              {seeding ? '...' : `Seed Default (8:15–5:30)${filterYear ? ` for Y${filterYear}` : ''}`}
            </button>
          </div>
        </div>

        {/* ═══════ Cascading Filters: Dept → Year → Semester ═══════ */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end',
          padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(16,185,129,0.04))',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(99,102,241,0.15)'
        }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6366f1' }}>1. Department</label>
            <select 
              className="form-select" 
              style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }} 
              value={filterDept} 
              onChange={e => { setFilterDept(e.target.value); setFilterYear(''); setFilterSem(''); }}
            >
              <option value="">Select Department</option>
              {departments.map(d => {
                const isOwn = (user?.department?._id || user?.department) === d._id;
                return <option key={d._id} value={d._id}>{d.name}{isOwn ? ' ★' : ''}</option>;
              })}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: filterDept ? '#10b981' : 'var(--text-muted)' }}>2. Year</label>
            <select 
              className="form-select" 
              style={{
                padding: '8px 12px', fontSize: 13, fontWeight: 600,
                opacity: filterDept ? 1 : 0.5,
                background: filterYear ? 'rgba(16,185,129,0.06)' : undefined,
                borderColor: filterYear ? 'rgba(16,185,129,0.3)' : undefined
              }} 
              value={filterYear} 
              onChange={e => { setFilterYear(e.target.value); setFilterSem(''); }}
              disabled={!filterDept}
            >
              {YEAR_OPTIONS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: filterYear ? '#f59e0b' : 'var(--text-muted)' }}>3. Semester</label>
            <select 
              className="form-select" 
              style={{
                padding: '8px 12px', fontSize: 13, fontWeight: 600,
                opacity: filterYear ? 1 : 0.5,
                background: filterSem ? 'rgba(245,158,11,0.06)' : undefined,
                borderColor: filterSem ? 'rgba(245,158,11,0.3)' : undefined
              }} 
              value={filterSem} 
              onChange={e => setFilterSem(e.target.value)}
              disabled={!filterYear}
            >
              {filterYear ? getSemesterOptions(filterYear).map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              )) : <option value="">Select Year first</option>}
            </select>
          </div>

          {/* Scope indicator */}
          {filterDept && (
            <div style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', whiteSpace: 'nowrap', alignSelf: 'flex-end'
            }}>
              📋 {filterYear ? `Year ${filterYear}` : 'All Years'}
              {filterSem ? ` → Sem ${filterSem}` : filterYear ? ' → All Sems' : ''}
              {` · ${slots.length} slots`}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div className="stat-icon blue"></div>
            <div><div className="stat-value">{teachingSlots.length}</div><div className="stat-label">Teaching Slots</div></div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div className="stat-icon orange"></div>
            <div><div className="stat-value">{breakSlots.length}</div><div className="stat-label">Breaks</div></div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div className="stat-icon green"></div>
            <div><div className="stat-value">Mon–Fri</div><div className="stat-label">Days Used</div></div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.15))' }}></div>
            <div>
              <div className="stat-value">{Math.floor(consecutivePairs.size / 2)}</div>
              <div className="stat-label">Consecutive Pairs</div>
            </div>
          </div>
        </div>

        {/* Hour Validation Banner */}
        {slotsChanged && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>Time Slots Changed</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Subject hours may need redistribution. Validate and redistribute to keep allocations correct.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '6px 14px', fontSize: 12 }}
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? '⏳ Checking...' : '🔍 Validate Hours'}
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '6px 14px', fontSize: 12 }}
                onClick={handleRedistribute}
                disabled={redistributing}
              >
                {redistributing ? '⏳ Working...' : '🔄 Redistribute'}
              </button>
            </div>
          </div>
        )}

        {/* Validation actions (always available) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
              color: '#8b5cf6',
              border: '1px solid rgba(139,92,246,0.3)',
              padding: '6px 14px',
              fontSize: 12
            }}
            onClick={handleValidate}
            disabled={validating}
          >
            {validating ? '⏳ Validating...' : '🔍 Validate Hour Allocations'}
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.3)',
              padding: '6px 14px',
              fontSize: 12
            }}
            onClick={handleRedistribute}
            disabled={redistributing}
          >
            {redistributing ? '⏳ Redistributing...' : '🔄 Validate & Redistribute'}
          </button>
        </div>

        {/* Validation Results */}
        {validation && (
          <div style={{
            background: validation.valid
              ? 'rgba(16,185,129,0.06)'
              : 'rgba(239,68,68,0.06)',
            border: `1px solid ${validation.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: validation.issues?.length > 0 ? 12 : 0 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: validation.valid ? '#10b981' : '#ef4444' }}>
                  {validation.valid ? '✅ All Hours Properly Allocated' : `❌ ${validation.errors} Error(s), ${validation.warnings} Warning(s)`}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {validation.valid
                    ? 'All subjects have correct theory/practical hours. Practicals are in consecutive slots.'
                    : 'Some subject hours are incorrect or practicals are not in consecutive slots.'}
                </div>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setValidation(null)}
                style={{ padding: '2px 8px', fontSize: 11 }}
              >×</button>
            </div>

            {validation.issues?.length > 0 && (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {validation.issues.map((issue, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    marginBottom: 4,
                    borderRadius: 6,
                    background: issue.severity === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${issue.severity === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    fontSize: 12
                  }}>
                    <span style={{
                      fontWeight: 700,
                      color: issue.severity === 'error' ? '#ef4444' : '#f59e0b',
                      marginRight: 8
                    }}>
                      {issue.severity === 'error' ? '●' : '▲'} {issue.type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{issue.message}</span>
                    {issue.required !== undefined && issue.actual !== undefined && (
                      <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 11 }}>
                        (need {issue.required}, have {issue.actual})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16, border: '1px solid var(--primary-400)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--primary-400)' }}>
              {editId ? 'Edit Slot' : '+ Add New Slot'}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select 
                    className="form-select" 
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={form.startTime ? form.startTime.split(':')[0] : ''} 
                    onChange={e => {
                      const m = form.startTime ? (form.startTime.split(':')[1] || '') : '';
                      setForm(p => ({ ...p, startTime: e.target.value ? `${e.target.value}${m ? ':' + m : ''}` : '' }));
                    }}
                  >
                    <option value="">Hour</option>
                    {[8,9,10,11,12,1,2,3,4,5,6].map(h => <option key={`sh-${h}`} value={h}>{h}</option>)}
                  </select>
                  <select 
                    className="form-select" 
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={form.startTime ? (form.startTime.split(':')[1] || '') : ''} 
                    onChange={e => {
                      const h = form.startTime ? (form.startTime.split(':')[0] || '8') : '8';
                      setForm(p => ({ ...p, startTime: e.target.value ? `${h}:${e.target.value}` : '' }));
                    }}
                  >
                    <option value="">Minute</option>
                    {Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0')).map(m => (
                      <option key={`sm-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select 
                    className="form-select" 
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={form.endTime ? form.endTime.split(':')[0] : ''} 
                    onChange={e => {
                      const m = form.endTime ? (form.endTime.split(':')[1] || '') : '';
                      setForm(p => ({ ...p, endTime: e.target.value ? `${e.target.value}${m ? ':' + m : ''}` : '' }));
                    }}
                  >
                    <option value="">Hour</option>
                    {[8,9,10,11,12,1,2,3,4,5,6].map(h => <option key={`eh-${h}`} value={h}>{h}</option>)}
                  </select>
                  <select 
                    className="form-select" 
                    style={{ fontFamily: 'var(--font-mono)' }}
                    value={form.endTime ? (form.endTime.split(':')[1] || '') : ''} 
                    onChange={e => {
                      const h = form.endTime ? (form.endTime.split(':')[0] || '8') : '8';
                      setForm(p => ({ ...p, endTime: e.target.value ? `${h}:${e.target.value}` : '' }));
                    }}
                  >
                    <option value="">Minute</option>
                    {Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0')).map(m => (
                      <option key={`em-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isBreak} onChange={e => setForm(p => ({ ...p, isBreak: e.target.checked }))} />
                <span className="form-label" style={{ margin: 0 }}>Is Break</span>
              </label>
            </div>
            {form.isBreak && (
              <div className="form-group">
                <label className="form-label">Break Type</label>
                <select className="form-select" value={form.breakType} onChange={e => setForm(p => ({ ...p, breakType: e.target.value }))}>
                  <option value="short">Short Break</option>
                  <option value="lunch">Lunch Break</option>
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>{editId ? 'Update' : 'Save'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Slots Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Slot #</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Duration</th>
                <th>Type</th>
                <th>Consecutive</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No slots configured. Click "Seed Default" to create standard schedule.</td></tr>
              ) : slots.map((slot, i) => {
                const isPartOfPair = consecutivePairs.has(slot._id);
                // Check if this is the start or end of a consecutive pair
                const nextSlot = i < slots.length - 1 ? slots[i + 1] : null;
                const prevSlot = i > 0 ? slots[i - 1] : null;
                const isStartOfPair = nextSlot && !slot.isBreak && !nextSlot.isBreak && slot.endTime === nextSlot.startTime;
                const isEndOfPair = prevSlot && !slot.isBreak && !prevSlot.isBreak && prevSlot.endTime === slot.startTime;

                return (
                  <tr key={slot._id} style={{
                    background: slot.isBreak ? 'rgba(245,158,11,0.06)' : 'transparent'
                  }}>
                    <td><span style={{ fontWeight: 700 }}>{i + 1}</span></td>
                    <td style={{ fontWeight: 600 }}>{slot.startTime}</td>
                    <td style={{ fontWeight: 600 }}>{slot.endTime}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {slot.isBreak ? (slot.breakType === 'lunch' ? '1 hr' : '15 min') : '1 hr'}
                    </td>
                    <td>
                      {slot.isBreak ? (
                        <span className="badge badge-warning">{slot.breakType === 'lunch' ? 'Lunch' : 'Break'}</span>
                      ) : (
                        <span className="badge badge-primary">Teaching</span>
                      )}
                    </td>
                    <td>
                      {!slot.isBreak && isPartOfPair ? (
                        <span className="badge" style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          background: 'rgba(139,92,246,0.12)',
                          color: '#8b5cf6',
                          border: '1px solid rgba(139,92,246,0.3)'
                        }}>
                          {isStartOfPair && isEndOfPair ? '◄►' : isStartOfPair ? '► Start' : '◄ End'}
                        </span>
                      ) : !slot.isBreak ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      ) : null}
                    </td>
                    <td><span className={`badge ${slot.isActive !== false ? 'badge-success' : 'badge-danger'}`}>{slot.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleEdit(slot)}>Edit</button>
                        <button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => handleDelete(slot._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        {/* Default schedule preview */}
        <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Default Schedule (Mon–Fri)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DEFAULT_SLOTS.map((s, i) => (
              <span key={i} className={`badge ${s.isBreak ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                {s.startTime}–{s.endTime}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Impact Warning Modal */}
      {showImpactModal && impactData && (
        <div className="modal-overlay" onClick={() => { setShowImpactModal(false); setPendingDeleteId(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">⚠️ Slot Deletion Impact</h3>
              <button className="modal-close" onClick={() => { setShowImpactModal(false); setPendingDeleteId(null); }}>×</button>
            </div>

            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: 16
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', marginBottom: 6 }}>
                This time slot has timetable data!
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                {impactData.message || `${(impactData.affectedEntries || 0) + (impactData.affectedSlots || 0)} timetable entries use this slot.`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 100, background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{impactData.affectedEntries || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Legacy Entries</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{impactData.affectedSlots || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timetable Slots</div>
              </div>
              <div style={{ flex: 1, minWidth: 100, background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{impactData.affectedPracticals || impactData.brokenPracticals || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Practicals at Risk</div>
              </div>
            </div>

            {/* Show detail entries */}
            {(impactData.entries?.length > 0 || impactData.slots?.length > 0 || impactData.details?.length > 0) && (
              <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 16 }}>
                {(impactData.entries || impactData.details || []).slice(0, 10).map((d, i) => (
                  <div key={i} style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4,
                    marginBottom: 2, background: 'var(--bg-tertiary)'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary-400)' }}>{d.subject?.code || d.subject || d.subjectCode || '?'}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                      {d.day} • {d.department?.code || d.department || '?'} • {d.type || d.slotType || d.entryType || '?'}
                      {d.batch ? ` • ${d.batch}` : ''}
                    </span>
                  </div>
                ))}
                {(impactData.entries?.length || impactData.details?.length || 0) > 10 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px' }}>
                    ...and {(impactData.entries?.length || impactData.details?.length || 0) - 10} more
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--text-primary)',
              marginBottom: 16
            }}>
              💡 After deleting, use <strong>Validate & Redistribute</strong> to automatically fix any broken
              hour allocations and ensure practicals remain in consecutive slots.
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowImpactModal(false); setPendingDeleteId(null); }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                performDelete(pendingDeleteId, true);
                setSlotsChanged(true);
              }}>
                Delete Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
