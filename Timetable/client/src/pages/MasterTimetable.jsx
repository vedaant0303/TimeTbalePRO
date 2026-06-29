import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const YEAR_GROUPS = [
  { label: 'SE', semesters: [3, 4] },
  { label: 'TE', semesters: [5, 6] },
  { label: 'BE', semesters: [7, 8] },
];

export default function MasterTimetable() {
  const { academicYear } = useApp();
  const { user } = useAuth();
  const [allEntries, setAllEntries] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState('');
  const [viewMode, setViewMode] = useState('master'); // master | division
  const [selectedDiv, setSelectedDiv] = useState('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState('all');
  const [roomUsage, setRoomUsage] = useState([]);
  const tableRef = useRef(null);

  useEffect(() => {
    if (academicYear) fetchData();
  }, [academicYear]);

  useEffect(() => {
    if (selectedDept && academicYear) fetchEntries();
  }, [selectedDept, academicYear]);

  // Real-time updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = () => {
      if (selectedDept && academicYear) fetchEntries();
    };
    socket.on('timetable-updated', handleUpdate);
    return () => socket.off('timetable-updated', handleUpdate);
  }, [selectedDept, academicYear]);

  const fetchData = async () => {
    try {
      const [dRes, sRes] = await Promise.all([
        api.get('/departments'),
        api.get(`/timeslots?academicYear=${academicYear}`),
      ]);
      setDepartments(dRes.data);
      setTimeSlots(sRes.data.sort((a, b) => a.slotNumber - b.slotNumber));
      if (dRes.data.length > 0) {
        const userDeptId = user?.department?._id || user?.department;
        const matched = userDeptId ? dRes.data.find(d => d._id === userDeptId) : null;
        setSelectedDept(matched ? matched._id : dRes.data[0]._id);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchEntries = async () => {
    try {
      const res = await api.get(`/timetable/master?academicYear=${academicYear}&department=${selectedDept}`);
      setAllEntries(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchRoomUsage = async () => {
    if (!selectedDept || !academicYear) return;
    try {
      const res = await api.get(`/timetable/room-usage?academicYear=${academicYear}&department=${selectedDept}`);
      setRoomUsage(res.data || []);
    } catch (err) { console.error('Room usage fetch error:', err); }
  };

  useEffect(() => {
    if (selectedDept && academicYear) fetchRoomUsage();
  }, [selectedDept, academicYear]);

  // Get other departments using the same room at the same day/slot
  const getRoomConflicts = (day, slotId, roomId) => {
    if (!roomId || roomUsage.length === 0) return [];
    return roomUsage.filter(e =>
      e.day === day &&
      (e.timeSlot?._id === slotId || e.timeSlot === slotId) &&
      (e.room?._id === roomId || e.room === roomId)
    );
  };

  const deptObj = departments.find(d => d._id === selectedDept);
  const deptName = deptObj?.name || '';
  const deptCode = deptObj?.code || '';
  const divisions = deptObj?.divisions || ['1', '2', '3'];
  const teachingSlots = timeSlots.filter(s => !s.isBreak);
  const breakSlots = timeSlots.filter(s => s.isBreak);

  // Get all time columns including breaks for the Excel-style view
  const allSlotColumns = timeSlots.map(s => ({
    ...s,
    label: `${s.startTime}-${s.endTime}`,
    isBreak: s.isBreak
  }));

  // Get year groups that have entries
  const activeYears = YEAR_GROUPS.filter(yg => {
    if (selectedYearFilter !== 'all' && yg.label !== selectedYearFilter) return false;
    return true;
  });

  // Get entries for a specific cell
  const getEntries = (day, slotId, semester, division) => {
    return allEntries.filter(e => {
      const matchDay = e.day === day;
      const matchSlot = (e.timeSlot?._id === slotId || e.timeSlot === slotId);
      const matchSem = semester ? e.semester === semester : true;
      const matchDiv = division && division !== 'all' ? e.division === division : true;
      return matchDay && matchSlot && matchSem && matchDiv;
    });
  };

  // Format cell content — shows batch rotation blocks for practicals
  const formatCell = (entries, day, slotId) => {
    if (!entries || entries.length === 0) return null;
    
    // Check for cross-department room conflicts
    const roomIds = entries.map(e => e.room?._id || e.room).filter(Boolean);
    const uniqueRoomIds = [...new Set(roomIds)];
    const allConflicts = uniqueRoomIds.flatMap(rid => getRoomConflicts(day, slotId, rid));
    const conflictDepts = [];
    const seenDepts = new Set();
    for (const c of allConflicts) {
      const code = c.department?.code || c.department?.name || '?';
      if (!seenDepts.has(code)) {
        seenDepts.add(code);
        conflictDepts.push({ code, name: c.department?.name, subject: c.subject?.code, room: c.room?.code });
      }
    }

    // Check if these are batch-specific entries (rotation block)
    const hasBatches = entries.some(e => e.batch);
    
    return (
      <>
        {hasBatches && entries.length > 1 ? (
          // === ROTATION BLOCK: Show compact B1/B2/B3/B4 layout ===
          <div style={{ padding: '1px 2px' }}>
            {entries.map((e, i) => {
              const subCode = e.subject?.code || e.subject?.name || '—';
              const facName = e.faculty?.name?.split(' ').slice(-1)[0] || ''; // Last name only
              const roomCode = e.room?.code || e.room?.name || '';
              return (
                <div key={i} style={{
                  display: 'flex', gap: 3, alignItems: 'center', fontSize: 9,
                  padding: '1px 0',
                  borderBottom: i < entries.length - 1 ? '1px dashed rgba(0,0,0,0.08)' : 'none'
                }}>
                  <span style={{
                    fontSize: 7, fontWeight: 800, padding: '0px 3px',
                    borderRadius: 3, flexShrink: 0,
                    background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd'
                  }}>{e.batch}</span>
                  <span style={{ fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{subCode}</span>
                  {facName && <span style={{ color: '#16a34a', fontSize: 8 }}>({facName})</span>}
                  {roomCode && <span style={{ color: '#2563eb', fontSize: 8 }}>{roomCode}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          // === SINGLE ENTRY: Theory / project / single practical ===
          entries.map((e, i) => {
            const subCode = e.subject?.code || e.subject?.name || (e.type === 'project' ? 'MINI PROJECT' : '—');
            const facName = e.faculty?.name || '';
            const roomCode = e.room?.code || e.room?.name || '';
            const typeLabel = e.type !== 'theory' ? e.type : '';

            return (
              <div key={i} style={{
                padding: '2px 4px', fontSize: 10, lineHeight: 1.3,
                borderBottom: i < entries.length - 1 ? '1px dashed rgba(0,0,0,0.1)' : 'none',
                marginBottom: i < entries.length - 1 ? 2 : 0
              }}>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>{subCode}</div>
                {facName && <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>{facName}</div>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {roomCode && <span style={{ fontSize: 9, color: '#2563eb' }}>{roomCode}</span>}
                  {typeLabel && <span style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600 }}>{typeLabel}</span>}
                  {e.batch && <span style={{ fontSize: 8, color: '#8b5cf6', fontWeight: 600 }}>{e.batch}</span>}
                </div>
              </div>
            );
          })
        )}
        {conflictDepts.length > 0 && (
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '2px 4px' }}>
            {conflictDepts.map(cd => (
              <span key={cd.code} title={`Room ${cd.room} shared with ${cd.name} (${cd.subject || 'N/A'})`}
                style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 700 }}>
                {cd.code}
              </span>
            ))}
          </div>
        )}
      </>
    );
  };

  // Compute live summary from latest data
  const summary = (() => {
    const uniqueFaculty = new Set();
    const uniqueSubjects = new Set();
    const uniqueDivisions = new Set();
    let unassigned = 0;
    let latestUpdate = null;

    allEntries.forEach(e => {
      if (e.faculty?._id) uniqueFaculty.add(e.faculty._id);
      else unassigned++;
      if (e.subject?._id) uniqueSubjects.add(e.subject._id);
      if (e.division) uniqueDivisions.add(`${e.semester}-${e.division}`);
      const updated = e.updatedAt || e.createdAt;
      if (updated && (!latestUpdate || new Date(updated) > new Date(latestUpdate))) {
        latestUpdate = updated;
      }
    });

    return {
      faculty: uniqueFaculty.size,
      subjects: uniqueSubjects.size,
      divisions: uniqueDivisions.size,
      unassigned,
      total: allEntries.length,
      lastUpdated: latestUpdate ? new Date(latestUpdate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
    };
  })();

  const handlePrint = () => {
    const el = tableRef.current;
    if (!el) return;
    const printWin = window.open('', '', 'width=1200,height=800');
    printWin.document.write(`
      <html><head><title>Master Timetable - ${deptName}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 3px 4px; text-align: center; vertical-align: top; font-size: 9px; }
        th { background: #1e293b; color: white; font-weight: 700; }
        .day-cell { background: #f1f5f9; font-weight: 700; writing-mode: vertical-lr; text-orientation: mixed; }
        .year-cell { background: #e2e8f0; font-weight: 700; font-size: 11px; }
        .break-cell { background: #fef3c7; color: #92400e; font-style: italic; }
        h2 { text-align: center; margin-bottom: 4px; }
        p { text-align: center; color: #666; font-size: 11px; }
        @media print { body { margin: 5mm; } }
      </style></head><body>
      <h2>${deptName}</h2>
      <p>Academic Year: ${academicYear} (Even Semester) | Master Timetable</p>
      ${el.outerHTML}
      </body></html>
    `);
    printWin.document.close();
    printWin.print();
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Master Timetable</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Consolidated department timetable — {academicYear}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ Print</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">DEPARTMENT</label>
            <select className="form-select" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
            <label className="form-label">YEAR GROUP</label>
            <select className="form-select" value={selectedYearFilter} onChange={e => setSelectedYearFilter(e.target.value)}>
              <option value="all">All Years</option>
              {YEAR_GROUPS.map(y => <option key={y.label} value={y.label}>{y.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 130 }}>
            <label className="form-label">DIVISION</label>
            <select className="form-select" value={selectedDiv} onChange={e => setSelectedDiv(e.target.value)}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn btn-sm ${viewMode === 'master' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('master')}>
              📊 Master View
            </button>
            <button className={`btn btn-sm ${viewMode === 'division' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('division')}>
              📋 Division View
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
          <div>
            <div className="stat-value">{summary.faculty}</div>
            <div className="stat-label">Faculty Assigned</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
          <div>
            <div className="stat-value">{summary.subjects}</div>
            <div className="stat-label">Subjects</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 100 }}>
          <div>
            <div className="stat-value">{summary.divisions}</div>
            <div className="stat-label">Divisions</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 100, border: summary.unassigned > 0 ? '2px solid #ef4444' : undefined }}>
          <div>
            <div className="stat-value" style={{ color: summary.unassigned > 0 ? '#ef4444' : undefined }}>{summary.unassigned}</div>
            <div className="stat-label">Unassigned Slots</div>
          </div>
        </div>
        <div className="stat-card" style={{ flex: 1.5, minWidth: 140 }}>
          <div>
            <div className="stat-value" style={{ fontSize: 16 }}>{summary.total}</div>
            <div className="stat-label">Total Slots</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Updated: {summary.lastUpdated}</div>
          </div>
        </div>
      </div>

      {/* Master Timetable Grid (Excel-style) */}
      {allEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <h3>No Timetable Entries</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Generate the timetable from Auto Generate page first.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table ref={tableRef} style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 11,
            minWidth: allSlotColumns.length * 85
          }}>
            <thead>
              <tr>
                <th style={thStyle}>Day</th>
                <th style={thStyle}>Year</th>
                {allSlotColumns.map((s, i) => (
                  <th key={i} style={{
                    ...thStyle,
                    background: s.isBreak ? '#fbbf24' : '#1e293b',
                    color: s.isBreak ? '#78350f' : '#fff',
                    fontSize: 9,
                    minWidth: s.isBreak ? 50 : 80
                  }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIdx) => {
                const yearsToShow = activeYears.filter(yg => {
                  // Only show years that have entries or show all if 'all' selected
                  return selectedYearFilter === 'all' || yg.label === selectedYearFilter;
                });

                return yearsToShow.map((yg, ygIdx) => {
                  // Get the relevant semester for the current academic period (even = 4,6,8)
                  const evenSem = yg.semesters.find(s => s % 2 === 0);
                  const oddSem = yg.semesters.find(s => s % 2 !== 0);
                  // Use even semester for even academic period
                  const targetSem = evenSem || oddSem;

                  return (
                    <tr key={`${day}-${yg.label}`} style={{
                      borderBottom: ygIdx === yearsToShow.length - 1 ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
                      background: ygIdx % 2 === 0 ? '#fff' : '#f8fafc'
                    }}>
                      {/* Day cell - only on first year row, spans all year rows */}
                      {ygIdx === 0 && (
                        <td rowSpan={yearsToShow.length} style={{
                          ...cellStyle,
                          background: '#f1f5f9',
                          fontWeight: 700,
                          fontSize: 12,
                          width: 70,
                          borderRight: '2px solid #cbd5e1',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          color: '#1e293b'
                        }}>
                          {day.substring(0, 3)}
                        </td>
                      )}
                      {/* Year label cell */}
                      <td style={{
                        ...cellStyle,
                        background: yg.label === 'SE' ? '#dbeafe' : yg.label === 'TE' ? '#fef3c7' : '#dcfce7',
                        fontWeight: 700,
                        fontSize: 11,
                        textAlign: 'center',
                        width: 40,
                        color: yg.label === 'SE' ? '#1e40af' : yg.label === 'TE' ? '#92400e' : '#166534',
                        borderRight: '2px solid #cbd5e1'
                      }}>
                        {yg.label}
                      </td>
                      {/* Time slot cells */}
                      {allSlotColumns.map((slot, si) => {
                        if (slot.isBreak) {
                          return (
                            <td key={si} style={{
                              ...cellStyle,
                              background: '#fef9c3',
                              textAlign: 'center',
                              fontSize: 8,
                              color: '#92400e',
                              fontStyle: 'italic',
                              minWidth: 40
                            }}>
                              {slot.breakType === 'lunch' ? 'LUNCH' : 'BREAK'}
                            </td>
                          );
                        }

                        const entries = getEntries(day, slot._id, targetSem, selectedDiv);
                        return (
                          <td key={si} style={{
                            ...cellStyle,
                            padding: 2,
                            verticalAlign: 'top',
                            minWidth: 80,
                            maxWidth: 140
                          }}>
                            {formatCell(entries, day, slot._id)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="card" style={{ marginTop: 16, padding: 14, fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Legend</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><span style={{ fontWeight: 700 }}>Subject(FC)</span> = Subject Code (Faculty Short Code)</span>
          <span style={{ color: '#2563eb' }}>Blue text = Room</span>
          <span style={{ color: '#f59e0b' }}>Yellow = Type (practical/tutorial)</span>
          <span style={{ color: '#8b5cf6' }}>Purple = Division</span>
          <span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: 4 }}>SE</span>
          <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: 4 }}>TE</span>
          <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>BE</span>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '8px 6px',
  background: '#1e293b',
  color: '#fff',
  fontWeight: 700,
  fontSize: 11,
  textAlign: 'center',
  border: '1px solid #334155',
  position: 'sticky',
  top: 0,
  zIndex: 2
};

const cellStyle = {
  padding: '4px 5px',
  border: '1px solid #e2e8f0',
  verticalAlign: 'top',
  fontSize: 10
};
