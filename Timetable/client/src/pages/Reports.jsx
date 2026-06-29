import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

export default function Reports() {
  const { academicYear } = useApp();
  const [tab, setTab] = useState('utilization');
  const [utilization, setUtilization] = useState([]);
  const [deptSummary, setDeptSummary] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (academicYear) fetchReport(); }, [tab, academicYear]);
  useEffect(() => { if (academicYear) fetchOverview(); }, [academicYear]);

  const fetchOverview = async () => {
    try {
      const res = await api.get(`/reports/overview?academicYear=${academicYear}`);
      setOverview(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (tab === 'utilization') {
        const res = await api.get(`/reports/utilization?academicYear=${academicYear}`);
        setUtilization(res.data || []);
      } else if (tab === 'department') {
        const res = await api.get(`/reports/department-summary?academicYear=${academicYear}`);
        setDeptSummary(res.data || []);
      } else if (tab === 'audit') {
        const res = await api.get('/reports/audit-log?limit=50');
        setAuditLogs(res.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Compute utilization stats
  const avgUtilization = utilization.length > 0
    ? (utilization.reduce((s, r) => s + parseFloat(r.utilization || 0), 0) / utilization.length).toFixed(1)
    : '0';
  const highUtil = utilization.filter(r => parseFloat(r.utilization) > 70).length;
  const lowUtil = utilization.filter(r => parseFloat(r.utilization) < 20).length;

  return (
    <div className="animate-fadeIn">
      {/* Overview Stats */}
      {overview && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Departments', value: overview.totalDepts, color: '#3b82f6' },
            { label: 'Faculty', value: overview.totalFaculty, color: '#8b5cf6' },
            { label: 'Subjects', value: overview.totalSubjects, color: '#f59e0b' },
            { label: 'Rooms', value: overview.totalRooms, color: '#10b981' },
            { label: 'Students', value: overview.totalStudents, color: '#ec4899' },
            { label: 'Timetable Entries', value: overview.totalEntries, color: '#6366f1' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ flex: 1, minWidth: 100 }}>
              <div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'utilization' ? 'active' : ''}`} onClick={() => setTab('utilization')}>Room Utilization</button>
        <button className={`tab ${tab === 'department' ? 'active' : ''}`} onClick={() => setTab('department')}>Department Summary</button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Trail</button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div></div>
      ) : (
        <>
          {/* ═══ ROOM UTILIZATION ═══ */}
          {tab === 'utilization' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Room Utilization Report — {academicYear}</div>
                  <div className="card-subtitle">{utilization.length} rooms tracked</div>
                </div>
              </div>

              {/* Utilization Summary */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 100, padding: 12, borderRadius: 8, background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{avgUtilization}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Utilization</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, padding: 12, borderRadius: 8, background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>{highUtil}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>High Usage (&gt;70%)</div>
                </div>
                <div style={{ flex: 1, minWidth: 100, padding: 12, borderRadius: 8, background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{lowUtil}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low Usage (&lt;20%)</div>
                </div>
              </div>

              {utilization.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">—</div>
                  <div className="empty-title">No rooms or timetable data available</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generate a timetable first to see utilization data.</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Type</th>
                        <th>Dept</th>
                        <th>Capacity</th>
                        <th>Theory</th>
                        <th>Practical</th>
                        <th>Used / Total</th>
                        <th>Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilization.map((r, i) => {
                        const pct = parseFloat(r.utilization);
                        const barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : pct > 20 ? '#3b82f6' : '#94a3b8';
                        return (
                          <tr key={i}>
                            <td><span style={{ fontWeight: 700 }}>{r.room?.code}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.room?.name}</span></td>
                            <td><span className={`badge ${r.room?.type === 'lab' ? 'badge-warning' : 'badge-primary'}`}>{r.room?.type}</span></td>
                            <td style={{ fontSize: 11 }}>{r.room?.department || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{r.room?.capacity || '—'}</td>
                            <td style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 600 }}>{r.theoryCount}</td>
                            <td style={{ textAlign: 'center', color: '#8b5cf6', fontWeight: 600 }}>{r.practicalCount}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {r.usedSlots} / {r.totalSlots}
                            </td>
                            <td style={{ width: 160 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${Math.min(pct, 100)}%`, height: '100%',
                                    background: barColor, borderRadius: 4,
                                    transition: 'width 0.5s ease'
                                  }}></div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: barColor, minWidth: 40, textAlign: 'right' }}>
                                  {r.utilization}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══ DEPARTMENT SUMMARY ═══ */}
          {tab === 'department' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Department Summary — {academicYear}</div>
                  <div className="card-subtitle">{deptSummary.length} departments</div>
                </div>
              </div>
              {deptSummary.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">—</div>
                  <div className="empty-title">No department data</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {deptSummary.map((d, i) => (
                    <div key={i} style={{
                      background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{d.department?.name}</h3>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.department?.code}</span>
                        </div>
                        <span className={`badge ${d.status === 'published' ? 'badge-success' : d.status === 'draft' ? 'badge-warning' : 'badge-secondary'}`}>
                          {d.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                        <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{d.totalEntries}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Entries</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>{d.totalFaculty}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Faculty</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{d.totalSubjects}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Subjects</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{d.theoryCount}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Theory</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#ec4899' }}>{d.practicalCount}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Practical</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: 8, background: d.unassignedCount > 0 ? 'rgba(239,68,68,0.06)' : 'var(--bg-secondary)', borderRadius: 6, border: d.unassignedCount > 0 ? '1px solid rgba(239,68,68,0.2)' : 'none' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: d.unassignedCount > 0 ? '#ef4444' : '#94a3b8' }}>{d.unassignedCount}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Unassigned</div>
                        </div>
                      </div>

                      {d.semesters?.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Semesters:</span>
                          {d.semesters.map(s => (
                            <span key={s} className="badge badge-primary" style={{ fontSize: 9, padding: '1px 6px' }}>Sem {s}</span>
                          ))}
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>Divisions:</span>
                          {d.divisions.map(div => (
                            <span key={div} className="badge badge-secondary" style={{ fontSize: 9, padding: '1px 6px' }}>Div {div}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ AUDIT TRAIL ═══ */}
          {tab === 'audit' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Audit Trail</div>
                  <div className="card-subtitle">Last {auditLogs.length} actions</div>
                </div>
              </div>
              {auditLogs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">—</div>
                  <div className="empty-title">No audit logs yet</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Actions will appear here as changes are made.</div>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 500, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>User</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp || log.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td>
                            <span className={`badge ${
                              log.action === 'CREATE' ? 'badge-success' :
                              log.action === 'DELETE' ? 'badge-danger' :
                              log.action === 'UPDATE' ? 'badge-warning' : 'badge-primary'
                            }`}>{log.action}</span>
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 600 }}>{log.entity}</td>
                          <td style={{ fontSize: 12 }}>{log.user?.name || 'System'}</td>
                          <td style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.entityId ? `ID: ${log.entityId.toString().slice(-8)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
