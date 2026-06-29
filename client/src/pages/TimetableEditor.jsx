import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';
import SearchableSelect from '../components/SearchableSelect';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetableEditor() {
  const { academicYear, departments: globalDepts } = useApp();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({});
  const [clashError, setClashError] = useState(null);
  const [roomUsage, setRoomUsage] = useState([]);
  const [filters, setFilters] = useState({
    department: '', division: '1', semester: '4', academicYear: ''
  });

  // Academic year options
  const academicYearOptions = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];

  useEffect(() => {
    if (academicYear) {
      setFilters(prev => ({ ...prev, academicYear }));
      fetchData();
    }
    const socket = getSocket();
    socket.on('timetable-updated', handleRealTimeUpdate);
    return () => socket.off('timetable-updated', handleRealTimeUpdate);
  }, [academicYear]);

  useEffect(() => {
    if (filters.department && filters.academicYear) {
      fetchEntries();
      fetchSubjectsForSemester();
      fetchRoomUsage();
    }
  }, [filters]);

  const handleRealTimeUpdate = (data) => {
    const item = data.entry || data.slot;
    if (data.action === 'create' && item) {
      setEntries(prev => [...prev, item]);
    } else if (data.action === 'update' && item) {
      setEntries(prev => prev.map(e => e._id === item._id ? item : e));
    } else if (data.action === 'delete') {
      const id = data.entryId || data.slotId;
      if (id) setEntries(prev => prev.filter(e => e._id !== id));
    } else {
      // auto-generate or unknown action — full refetch
      fetchEntries();
    }
  };

  const fetchData = async () => {
    try {
      const [deptRes, roomRes] = await Promise.all([
        api.get('/departments'),
        api.get('/rooms'),
      ]);
      setDepartments(deptRes.data);
      setRooms(roomRes.data);
      if (deptRes.data.length > 0) {
        // Auto-select user's department if coordinator/hod
        const userDeptId = user?.department?._id || user?.department;
        const matchedDept = userDeptId ? deptRes.data.find(d => d._id === userDeptId) : null;
        const selectedDept = matchedDept || deptRes.data[0];
        const deptId = selectedDept._id;
        const defaultDiv = selectedDept.divisions?.[0] || '1';
        const defaultSem = selectedDept.semesters?.[0] || 4;
        setFilters(prev => ({ ...prev, department: deptId, division: defaultDiv, semester: String(defaultSem) }));

        // Fetch time slots scoped to this department
        const slotRes = await api.get(`/timeslots?academicYear=${academicYear}&department=${deptId}`);
        setTimeSlots(slotRes.data);

        // Fetch subjects for the department (all semesters) and faculty
        const [subRes, facRes] = await Promise.all([
          api.get(`/subjects?department=${deptId}`),
          api.get('/users?role=faculty'),
        ]);
        setSubjects(subRes.data);
        setFaculty(facRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch subjects filtered by the selected semester
  const fetchSubjectsForSemester = async () => {
    if (!filters.department) return;
    try {
      const res = await api.get(`/subjects?department=${filters.department}&semester=${filters.semester}`);
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEntries = async () => {
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`/timetable?${params}`);
      setEntries(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch room usage from other departments
  const fetchRoomUsage = async () => {
    if (!filters.department || !filters.academicYear) return;
    try {
      const res = await api.get(`/timetable/room-usage?academicYear=${filters.academicYear}&department=${filters.department}`);
      setRoomUsage(res.data || []);
    } catch (err) {
      console.error('Room usage fetch error:', err);
    }
  };

  // Get other departments using the same room at the same day/slot
  const getRoomConflicts = (day, slotId, roomId) => {
    if (!roomId || roomUsage.length === 0) return [];
    return roomUsage.filter(e =>
      e.day === day &&
      (e.timeSlot?._id === slotId || e.timeSlot === slotId) &&
      (e.room?._id === roomId || e.room === roomId)
    );
  };

  const handleDeptChange = async (deptId) => {
    const dept = departments.find(d => d._id === deptId);
    const defaultDiv = dept?.divisions?.[0] || '1';
    setFilters(prev => ({ ...prev, department: deptId, division: defaultDiv }));
    try {
      const [subRes, facRes, slotRes] = await Promise.all([
        api.get(`/subjects?department=${deptId}&semester=${filters.semester}`),
        api.get('/users?role=faculty'),
        api.get(`/timeslots?academicYear=${filters.academicYear || academicYear}&department=${deptId}`),
      ]);
      setSubjects(subRes.data);
      setFaculty(facRes.data);
      setTimeSlots(slotRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openSlotModal = (day, slot) => {
    const existing = getEntry(day, slot._id);
    if (existing) {
      setFormData({
        _id: existing._id,
        subject: existing.subject?._id || '',
        faculty: existing.faculty?._id || '',
        room: existing.room?._id || '',
        type: existing.type || 'theory'
      });
    } else {
      setFormData({ subject: '', faculty: '', room: '', type: 'theory' });
    }
    setSelectedSlot({ day, slot });
    setClashError(null);
    setShowModal(true);
  };

  // Build lookup for time-based fallback matching
  const slotIdToStartTime = {};
  for (const s of timeSlots) {
    slotIdToStartTime[s._id] = s.startTime;
  }

  const matchesSlot = (entry, slotId) => {
    const entrySlotId = entry.timeSlot?._id || entry.timeSlot;
    if (entrySlotId === slotId) return true;
    // Fallback: match by startTime when IDs differ (e.g. after dept-scoping migration)
    const slotStartTime = slotIdToStartTime[slotId];
    const entryStartTime = entry.timeSlot?.startTime;
    return slotStartTime && entryStartTime && entryStartTime === slotStartTime;
  };

  const getEntry = (day, slotId) => {
    return entries.find(e => e.day === day && matchesSlot(e, slotId));
  };

  // Get ALL entries for a slot (supports multiple batches in same slot), sorted by batch label
  const batchSort = (a, b) => {
    const numA = parseInt((a.batch || '').replace(/\D/g, '') || '999');
    const numB = parseInt((b.batch || '').replace(/\D/g, '') || '999');
    return numA - numB;
  };
  const getEntries = (day, slotId) => {
    return entries.filter(e => e.day === day && matchesSlot(e, slotId)).sort(batchSort);
  };

  const handleSave = async () => {
    try {
      setClashError(null);
      const payload = {
        day: selectedSlot.day,
        timeSlot: selectedSlot.slot._id,
        subject: formData.subject,
        room: formData.room,
        type: formData.type,
        department: filters.department,
        division: filters.division || '1',
        semester: parseInt(filters.semester),
        academicYear: filters.academicYear,
      };
      if (formData.faculty) {
        payload.faculty = formData.faculty;
      } else if (formData.subject) {
        // Auto-assign faculty from subject if available
        const subj = subjects.find(s => s._id === formData.subject);
        if (subj?.faculty?.length > 0) {
          payload.faculty = subj.faculty[0]._id || subj.faculty[0];
        }
      }

      if (formData._id) {
        await api.put(`/timetable/${formData._id}`, payload);
      } else {
        await api.post('/timetable', payload);
      }
      setShowModal(false);
      fetchEntries();
    } catch (err) {
      if (err.response?.status === 409) {
        setClashError(err.response.data);
      } else {
        setClashError({ message: err.response?.data?.message || 'Failed to save entry' });
      }
    }
  };

  const handleDelete = async () => {
    if (!formData._id) return;
    try {
      await api.delete(`/timetable/${formData._id}`);
      setShowModal(false);
      fetchEntries();
    } catch (err) {
      setClashError({ message: err.response?.data?.message || 'Failed to delete entry' });
    }
  };

  // Get divisions dynamically from the selected department
  const selectedDept = departments.find(d => d._id === filters.department);
  const divisions = selectedDept?.divisions || ['1'];
  const semesters = selectedDept?.semesters || [1, 2, 3, 4, 5, 6, 7, 8];

  // Map semester numbers to year names
  const getSemLabel = (sem) => {
    if (sem <= 2) return `Sem ${sem} (FE)`;
    if (sem <= 4) return `Sem ${sem} (SE)`;
    if (sem <= 6) return `Sem ${sem} (TE)`;
    return `Sem ${sem} (BE)`;
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner"></div><p>Loading editor...</p></div>;
  }

  const gridCols = `120px repeat(${DAYS.length}, 1fr)`;

  return (
    <div className="animate-fadeIn">
      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
            <label className="form-label">Department</label>
            <select className="form-select" value={filters.department} onChange={(e) => handleDeptChange(e.target.value)}>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '100px' }}>
            <label className="form-label">Division</label>
            <select className="form-select" value={filters.division} onChange={(e) => setFilters(p => ({ ...p, division: e.target.value }))}>
              {divisions.map(div => <option key={div} value={div}>{div}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Semester</label>
            <select className="form-select" value={filters.semester} onChange={(e) => setFilters(p => ({ ...p, semester: e.target.value }))}>
              {semesters.map(s => <option key={s} value={s}>{getSemLabel(s)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Academic Year</label>
            <select className="form-select" value={filters.academicYear} onChange={(e) => setFilters(p => ({ ...p, academicYear: e.target.value }))}>
              {academicYearOptions.map(yr => (
                <option key={yr} value={yr}>{yr}{yr === academicYear ? ' (Current)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="card" style={{ padding: '16px', overflow: 'auto' }}>
        <div className="timetable-grid" style={{ gridTemplateColumns: gridCols, gridTemplateRows: `auto repeat(${timeSlots.length}, auto)` }}>
          {/* Header row */}
          <div className="timetable-header-cell">Time</div>
          {DAYS.map(day => <div key={day} className="timetable-header-cell">{day}</div>)}

          {/* Time slot rows */}
          {timeSlots.map(slot => (
            <>
              <div key={`time-${slot._id}`} className="timetable-time-cell">
                <span>{slot.startTime}</span>
                <span style={{ fontSize: '9px', opacity: 0.6 }}>to</span>
                <span>{slot.endTime}</span>
                {slot.isBreak && <span className="badge badge-warning" style={{ marginTop: '4px', fontSize: '9px' }}>{slot.breakType === 'lunch' ? 'Lunch' : 'Break'}</span>}
              </div>
              {DAYS.map(day => {
                if (slot.isBreak) {
                  return <div key={`${day}-${slot._id}`} className="timetable-cell break-cell">
                    <span style={{ fontSize: '11px', color: 'var(--warning-400)', fontWeight: '600' }}>
                      {slot.breakType === 'lunch' ? 'Lunch Break' : 'Break'}
                    </span>
                  </div>;
                }
                const slotEntries = getEntries(day, slot._id);
                const entry = slotEntries[0] || null;
                // Check for cross-department room usage
                const roomIds = slotEntries.map(e => e.room?._id || e.room).filter(Boolean);
                const uniqueRoomIds = [...new Set(roomIds)];
                const allConflicts = uniqueRoomIds.flatMap(rid => getRoomConflicts(day, slot._id, rid));
                // Deduplicate by department code
                const conflictDepts = [];
                const seenDepts = new Set();
                for (const c of allConflicts) {
                  const code = c.department?.code || c.department?.name || '?';
                  if (!seenDepts.has(code)) {
                    seenDepts.add(code);
                    conflictDepts.push({ code, name: c.department?.name, subject: c.subject?.code, room: c.room?.code });
                  }
                }
                return (
                  <div
                    key={`${day}-${slot._id}`}
                    className="timetable-cell"
                    onClick={() => openSlotModal(day, slot)}
                  >
                    {slotEntries.length > 1 ? (
                      // Multiple entries (practical block with multiple batches)
                      <div className="timetable-entry practical" style={{ padding: '2px 4px', gap: '1px' }}>
                        {slotEntries.map((e, idx) => (
                          <div key={e._id || idx} style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '10px', padding: '1px 0', borderBottom: idx < slotEntries.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                            <span className="badge" style={{ fontSize: '7px', padding: '0px 4px', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }}>
                              {e.batch || '?'}
                            </span>
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
                        {conflictDepts.length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px', paddingTop: '2px', borderTop: '1px solid rgba(249,115,22,0.2)' }}>
                            {conflictDepts.map(cd => (
                              <span key={cd.code} title={`Room ${cd.room} shared with ${cd.name} (${cd.subject || 'N/A'})`}
                                style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 600 }}>
                                🔗 {cd.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : entry ? (
                      <div className={`timetable-entry ${entry.type}`}>
                        <span className="entry-subject">{entry.subject?.code || entry.subject?.name || (entry.type === 'project' ? 'MINI PROJECT' : '—')}</span>
                        <span className="entry-faculty">
                          {entry.faculty?.name || (
                            subjects.find(s => s._id === (entry.subject?._id || entry.subject))?.faculty?.[0]?.name
                          ) || 'Assign Faculty'}
                        </span>
                        <span className="entry-room">
                          {entry.room?.code || '—'}
                          {entry.room?.department && entry.room.department._id !== filters.department && entry.room.department.code && (
                            <span style={{ fontSize: '7px', marginLeft: '3px', padding: '0px 4px', borderRadius: '3px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 600 }}>
                              {entry.room.department.code}
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                          {entry.type !== 'theory' && (
                            <span className="badge badge-info" style={{ fontSize: '8px', padding: '1px 6px' }}>
                              {entry.type}
                            </span>
                          )}
                          {entry.batch && (
                            <span className="badge" style={{ fontSize: '8px', padding: '1px 6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                              {entry.batch}
                            </span>
                          )}
                          {entry.room?.isShared && entry.room.sharedWith?.length > 0 && (
                            entry.room.sharedWith.map((sw, i) => {
                              const swCode = sw.deptId?.code || '?';
                              return (
                                <span key={i} title={`Room shared with ${sw.deptId?.name || swCode}`}
                                  style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', fontWeight: 600 }}>
                                  🔗 {swCode}
                                </span>
                              );
                            })
                          )}
                        </div>
                        {conflictDepts.length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {conflictDepts.map(cd => (
                              <span key={cd.code} title={`Room in use by ${cd.name} (${cd.subject || 'N/A'})`}
                                style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>
                                ! {cd.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '20px' }}>+</div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Entry Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {formData._id ? 'Edit' : 'Add'} Entry — {selectedSlot?.day}, {selectedSlot?.slot?.startTime}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {clashError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ color: '#ef4444', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>{clashError.message}</p>
                {clashError.clashes?.map((c, i) => {
                  const icon = c.type === 'faculty' ? '○' : c.type === 'room' ? '□' : '■';
                  const color = c.type === 'faculty' ? '#f97316' : c.type === 'room' ? '#ef4444' : '#8b5cf6';
                  return (
                    <div key={i} style={{ padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: 'rgba(0,0,0,0.05)', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color }}>{icon} {c.type.toUpperCase()}: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{c.message}</span>
                      {c.conflict && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.conflict.department && <span>Dept: {c.conflict.department} • </span>}
                          {c.conflict.subject && <span>Subject: {c.conflict.subject} • </span>}
                          {c.conflict.room && <span>Room: {c.conflict.room} • </span>}
                          {c.conflict.division && <span>Div: {c.conflict.division}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Subject</label>
              <select className="form-select" value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s._id} value={s._id}>{s.code} — {s.name} ({s.type})</option>)}
              </select>
              {subjects.length === 0 && (
                <span style={{ fontSize: '11px', color: 'var(--warning-400)', marginTop: '4px', display: 'block' }}>
                  No subjects found for Sem {filters.semester}. Add subjects via admin panel.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Faculty <span style={{ fontSize: '11px', opacity: 0.6 }}>(optional — assign later)</span></label>
              <SearchableSelect
                options={faculty.map(f => ({ value: f._id, label: f.name, subtitle: f.email }))}
                value={formData.faculty}
                onChange={(val) => setFormData(p => ({ ...p, faculty: val }))}
                placeholder="-- Select Faculty --"
              />
              {faculty.length === 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  No faculty registered yet. Faculty will appear here once they register.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Room</label>
              <select className="form-select" value={formData.room} onChange={e => setFormData(p => ({ ...p, room: e.target.value }))}>
                <option value="">Select Room</option>
                {rooms.map(r => <option key={r._id} value={r._id}>{r.code} — {r.name} ({r.type}, Cap: {r.capacity})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}>
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
                <option value="tutorial">Tutorial</option>
              </select>
            </div>

            <div className="modal-footer">
              {formData._id && (
                <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {formData._id ? 'Update' : 'Save'} Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
