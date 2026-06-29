import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function MyTimetable() {
  const { user } = useAuth();
  const { academicYear, departments } = useApp();
  const [entries, setEntries] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [studentBatch, setStudentBatch] = useState(user?.batch || '');
  const [loading, setLoading] = useState(true);

  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';

  // Student selectors
  const [selectedDept, setSelectedDept] = useState(user?.department?._id || user?.department || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDiv, setSelectedDiv] = useState(user?.division || '1');
  const [selectedSemester, setSelectedSemester] = useState(user?.semester || '');
  const [showSelector, setShowSelector] = useState(false);

  const yearSemMap = { 'FE': [1, 2], 'SE': [3, 4], 'TE': [5, 6], 'BE': [7, 8] };

  useEffect(() => {
    if (isStudent && (!user.division || !user.semester)) {
      setShowSelector(true);
    }
  }, []);

  useEffect(() => {
    if (academicYear) {
      if (isStudent && showSelector) {
        fetchTimeSlots();
        setLoading(false);
      } else {
        fetchData();
      }
    }
    const socket = getSocket();
    socket.on('timetable-updated', () => { if (academicYear) fetchData(); });
    socket.on('timetable-visibility-changed', () => { if (academicYear) fetchData(); });
    return () => { socket.off('timetable-updated'); socket.off('timetable-visibility-changed'); };
  }, [academicYear]);

  const fetchTimeSlots = async () => {
    try {
      const slotRes = await api.get(`/timeslots?academicYear=${academicYear}`);
      setTimeSlots(slotRes.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchData = async () => {
    try {
      const slotRes = await api.get(`/timeslots?academicYear=${academicYear}`);
      setTimeSlots(slotRes.data || []);

      if (isFaculty) {
        // Fetch faculty's own classes
        const res = await api.get(`/timetable?academicYear=${academicYear}&faculty=${user._id}`);
        setEntries(res.data || []);
      } else if (isStudent) {
        const dept = selectedDept || user.department?._id || user.department;
        const div = selectedDiv || user.division;
        const sem = selectedSemester || user.semester;
        let url = `/timetable?academicYear=${academicYear}`;
        if (dept) url += `&department=${dept}`;
        if (div) url += `&division=${div}`;
        if (sem) url += `&semester=${sem}`;
        const res = await api.get(url);
        setEntries(res.data || []);

        // Also fetch the student's batch if not already loaded
        if (!studentBatch && user?.email) {
          try {
            const stuRes = await api.get(`/users/students?department=${dept}&semester=${sem}`);
            const me = (stuRes.data || []).find(s => s.email === user.email);
            if (me?.batch) setStudentBatch(me.batch);
          } catch(e) { /* ignore */ }
        }
      } else {
        // Coordinator viewing their own classes
        const res = await api.get(`/timetable?academicYear=${academicYear}&faculty=${user._id}`);
        setEntries(res.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Student browse mode
  const handleBrowseView = async () => {
    if (!selectedDept || !selectedYear || !selectedDiv) return;
    const sems = yearSemMap[selectedYear];
    const sem = selectedSemester || sems[1];
    setSelectedSemester(sem);
    setShowSelector(false);
    setLoading(true);
    try {
      const slotRes = await api.get(`/timeslots?academicYear=${academicYear}`);
      setTimeSlots(slotRes.data || []);
      const url = `/timetable?academicYear=${academicYear}&department=${selectedDept}&division=${selectedDiv}&semester=${sem}`;
      const res = await api.get(url);
      setEntries(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Get all entries for a given day & slot, sorted by batch label (B1, B2, B3, B4)
  const batchSort = (a, b) => {
    const numA = parseInt((a.batch || '').replace(/\D/g, '') || '999');
    const numB = parseInt((b.batch || '').replace(/\D/g, '') || '999');
    return numA - numB;
  };
  const getEntries = (day, slotId) => {
    return entries.filter(e => e.day === day && (e.timeSlot?._id === slotId || e.timeSlot === slotId)).sort(batchSort);
  };

  // For students: filter entries to only show their batch or non-batch entries
  const getStudentEntries = (day, slotId) => {
    const all = getEntries(day, slotId);
    if (!studentBatch) return all; // No batch assigned — show everything
    // Show: (1) entries matching student's batch, (2) entries without batch (theory/project)
    const filtered = all.filter(e => !e.batch || e.batch === studentBatch);
    return filtered.length > 0 ? filtered : all.slice(0, 1); // Fallback: show first entry
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  // Student Selector Screen
  if (showSelector && isStudent) {
    return (
      <div className="animate-fadeIn" style={{ maxWidth: 500, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>View Your Timetable</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          Select your department, year, and division to view your class timetable.
        </p>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">Select Department</option>
              {(departments || []).map(d => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Year</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['FE', 'SE', 'TE', 'BE'].map(y => (
                <button key={y}
                  className={`btn ${selectedYear === y ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '10px 0', fontWeight: 700 }}
                  onClick={() => { setSelectedYear(y); setSelectedSemester(yearSemMap[y][1]); }}>
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Division / Batch</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['1', '2', '3'].map(d => (
                <button key={d}
                  className={`btn ${selectedDiv === d ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '10px 0', fontWeight: 700, minWidth: 60 }}
                  onClick={() => setSelectedDiv(d)}>
                  Div {d}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
            disabled={!selectedDept || !selectedYear || !selectedDiv}
            onClick={handleBrowseView}>
            View Timetable
          </button>
        </div>
      </div>
    );
  }

  // ─── FACULTY PERSONAL TIMETABLE ───
  if (isFaculty || user?.role === 'coordinator') {
    // Build faculty's weekly schedule
    const teachingSlots = timeSlots.filter(s => !s.isBreak);
    
    // Calculate stats
    const totalClasses = entries.length;
    const uniqueSubjects = [...new Set(entries.map(e => e.subject?.code || e.subject?.name).filter(Boolean))];
    const uniqueRooms = [...new Set(entries.map(e => e.room?.code || e.room?.name).filter(Boolean))];
    const classesPerDay = {};
    DAYS.forEach(d => { classesPerDay[d] = entries.filter(e => e.day === d).length; });

    return (
      <div className="animate-fadeIn">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>My Teaching Schedule</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {user.name} — {academicYear}
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
            <div>
              <div className="stat-value" style={{ color: '#2563eb' }}>{totalClasses}</div>
              <div className="stat-label">Total Classes/Week</div>
            </div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
            <div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{uniqueSubjects.length}</div>
              <div className="stat-label">Subjects</div>
            </div>
          </div>
          <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
            <div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{uniqueRooms.length}</div>
              <div className="stat-label">Rooms</div>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <h3 style={{ marginBottom: 8 }}>No Timetable Available Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Your timetable has not been published by the coordinator yet. Please check back later.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Academic Year: {academicYear}</p>
          </div>
        ) : (
          <>
            {/* Day-wise cards (one per day) */}
            {DAYS.map(day => {
              const dayEntries = entries.filter(e => e.day === day);
              if (dayEntries.length === 0) return (
                <div key={day} className="card" style={{ marginBottom: 12, padding: '12px 16px', opacity: 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', width: 90 }}>{day}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No classes</span>
                  </div>
                </div>
              );

              return (
                <div key={day} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                  {/* Day header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1e293b, #334155)',
                    color: '#fff', padding: '10px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{day}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{dayEntries.length} class{dayEntries.length > 1 ? 'es' : ''}</span>
                  </div>

                  {/* Slots */}
                  <div style={{ padding: '8px 12px' }}>
                    {timeSlots.map(slot => {
                      if (slot.isBreak) {
                        return (
                          <div key={slot._id} style={{
                            padding: '6px 12px', margin: '4px 0',
                            background: '#fef9c3', borderRadius: 6,
                            fontSize: 11, color: '#92400e', fontStyle: 'italic',
                            textAlign: 'center'
                          }}>
                            ☕ {slot.breakType === 'lunch' ? 'Lunch Break' : 'Break'} ({slot.startTime} - {slot.endTime})
                          </div>
                        );
                      }

                      const slotEntries = getEntries(day, slot._id);
                      if (slotEntries.length === 0) return (
                        <div key={slot._id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '8px 12px', margin: '4px 0',
                          borderRadius: 6, background: '#f8fafc',
                          border: '1px solid #f1f5f9'
                        }}>
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 100 }}>
                            {slot.startTime} - {slot.endTime}
                          </span>
                          <span style={{ color: '#cbd5e1', fontSize: 12 }}>— Free —</span>
                        </div>
                      );

                      return slotEntries.map((entry, ei) => {
                        const subCode = entry.subject?.code || entry.subject?.name || (entry.type === 'project' ? 'MINI PROJECT' : 'Class');
                        const roomCode = entry.room?.code || entry.room?.name || '';
                        const division = entry.division || '';
                        const semester = entry.semester || '';
                        const deptName = entry.department?.code || entry.department?.name || '';
                        const typeLabel = entry.type || 'theory';
                        const typeColor = typeLabel === 'practical' ? '#8b5cf6' :
                                          typeLabel === 'tutorial' ? '#f59e0b' :
                                          typeLabel === 'project' ? '#ef4444' : '#2563eb';

                        return (
                          <div key={`${slot._id}-${ei}`} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', margin: '4px 0',
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(37,99,235,0.04), rgba(37,99,235,0.08))',
                            border: '1px solid rgba(37,99,235,0.12)',
                            transition: 'all 0.2s',
                          }}>
                            {/* Time */}
                            <div style={{ width: 100, flexShrink: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                                {slot.startTime}
                              </div>
                              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                to {slot.endTime}
                              </div>
                            </div>

                            {/* Subject */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                                {subCode}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                {deptName && <span style={{ fontSize: 10, color: '#64748b' }}>{deptName}</span>}
                                {division && <span style={{ fontSize: 10, color: '#8b5cf6' }}>Div {division}</span>}
                                {semester && <span style={{ fontSize: 10, color: '#64748b' }}>Sem {semester}</span>}
                                {entry.batch && <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>{entry.batch}</span>}
                              </div>
                            </div>

                            {/* Room */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                                📍 {roomCode}
                              </div>
                              <span style={{
                                fontSize: 9, fontWeight: 700,
                                color: typeColor,
                                background: `${typeColor}15`,
                                padding: '2px 8px', borderRadius: 10,
                                textTransform: 'uppercase'
                              }}>
                                {typeLabel}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}

            {/* Subject Summary */}
            {uniqueSubjects.length > 0 && (
              <div className="card" style={{ marginTop: 16, padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#1e293b' }}>📚 Subject Summary</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {uniqueSubjects.map(sub => {
                    const count = entries.filter(e => (e.subject?.code || e.subject?.name) === sub).length;
                    return (
                      <span key={sub} style={{
                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                        padding: '6px 12px', borderRadius: 8, fontSize: 12
                      }}>
                        <strong>{sub}</strong> × {count}/week
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── STUDENT TIMETABLE (grid view) ───
  const gridCols = `120px repeat(${DAYS.length}, 1fr)`;

  return (
    <div className="animate-fadeIn">
      <div className="flex-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>📅 Class Timetable</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Division {selectedDiv || user.division} — Semester {selectedSemester || user.semester} — Academic Year: {academicYear}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSelector(true)}>🔄 Change</button>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <h3 style={{ marginBottom: 8 }}>No Timetable Available Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Your timetable has not been published yet. Please check back later.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 16, overflow: 'auto' }}>
          <div className="timetable-grid" style={{ gridTemplateColumns: gridCols }}>
            <div className="timetable-header-cell">TIME</div>
            {DAYS.map(day => <div key={day} className="timetable-header-cell">{day.toUpperCase()}</div>)}

            {timeSlots.map(slot => (
              <>
                <div key={`t-${slot._id}`} className="timetable-time-cell">
                  <span>{slot.startTime}</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>to</span>
                  <span>{slot.endTime}</span>
                  {slot.isBreak && <span className="badge badge-warning" style={{ marginTop: 4, fontSize: 9 }}>{slot.breakType === 'lunch' ? 'Lunch' : 'Break'}</span>}
                </div>
                {DAYS.map(day => {
                  if (slot.isBreak) {
                    return <div key={`${day}-${slot._id}`} className="timetable-cell break-cell">
                      <span style={{ fontSize: 11, color: 'var(--warning-400)', fontWeight: 600 }}>{slot.breakType === 'lunch' ? '🍽️ Lunch Break' : '☕ Break'}</span>
                    </div>;
                  }
                  // Use same logic as coordinator editor
                  const allSlotEntries = getEntries(day, slot._id);
                  // If student has a batch, filter to their entries
                  const slotEntries = studentBatch 
                    ? allSlotEntries.filter(e => !e.batch || e.batch === studentBatch || e.batch.includes(studentBatch))
                    : allSlotEntries;

                  return (
                    <div key={`${day}-${slot._id}`} className="timetable-cell">
                      {slotEntries.length > 1 ? (
                        // Multiple entries (practical block with multiple batches) — same compact layout as coordinator
                        <div className="timetable-entry practical" style={{ padding: '2px 4px', gap: '1px' }}>
                          {slotEntries.map((e, idx) => (
                            <div key={e._id || idx} style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '10px', padding: '1px 0', borderBottom: idx < slotEntries.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                              {e.batch && (
                                <span className="badge" style={{ fontSize: '7px', padding: '0px 4px', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }}>
                                  {e.batch}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, color: 'var(--primary-300)', whiteSpace: 'nowrap' }}>
                                {e.subject?.code || '—'}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {e.faculty?.name?.split(' ').slice(0, 2).join(' ') || ''}
                              </span>
                              <span style={{ color: 'var(--warning-400)', fontSize: '8px', flexShrink: 0 }}>
                                {e.room?.code || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : slotEntries.length === 1 ? (
                        // Single entry — show the same card as coordinator
                        <div className={`timetable-entry ${slotEntries[0].type}`}>
                          <span className="entry-subject">{slotEntries[0].subject?.code || slotEntries[0].subject?.name || (slotEntries[0].type === 'project' ? 'MINI PROJECT' : '—')}</span>
                          <span className="entry-faculty">{slotEntries[0].faculty?.name || ''}</span>
                          <span className="entry-room">{slotEntries[0].room?.code || ''}</span>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                            {slotEntries[0].type !== 'theory' && (
                              <span className="badge badge-info" style={{ fontSize: 8, padding: '1px 6px' }}>{slotEntries[0].type}</span>
                            )}
                            {slotEntries[0].batch && (
                              <span className="badge" style={{ fontSize: 8, padding: '1px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>{slotEntries[0].batch}</span>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
