import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AcademicCalendar() {
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'institutional' });

  useEffect(() => { fetchCalendar(); }, []);

  const fetchCalendar = async () => {
    try {
      const res = await api.get('/calendar/active');
      setCalendar(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAddHoliday = async () => {
    if (!calendar) return;
    try {
      await api.post(`/calendar/${calendar._id}/holidays`, holidayForm);
      fetchCalendar();
      setShowForm(false);
      setHolidayForm({ name: '', date: '', type: 'institutional' });
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {calendar ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"></div>
              <div>
                <div className="stat-value">{calendar.academicYear}</div>
                <div className="stat-label">Academic Year</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"></div>
              <div>
                <div className="stat-value">{calendar.semesters?.length || 0}</div>
                <div className="stat-label">Semesters</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange"></div>
              <div>
                <div className="stat-value">{calendar.holidays?.length || 0}</div>
                <div className="stat-label">Holidays</div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Semester Schedule</div>
              </div>
              {calendar.semesters?.map((sem, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', marginBottom: '8px' }}>
                  <div className="flex-between">
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{sem.name}</span>
                    <span className="badge badge-primary">Sem {sem.number}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {new Date(sem.startDate).toLocaleDateString()} — {new Date(sem.endDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Holidays</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ Add Holiday</button>
              </div>

              {showForm && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Holiday Name</label>
                    <input className="form-input" value={holidayForm.name} onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={holidayForm.date} onChange={e => setHolidayForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={holidayForm.type} onChange={e => setHolidayForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="national">National</option>
                      <option value="state">State</option>
                      <option value="institutional">Institutional</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleAddHoliday}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {calendar.holidays?.map((h, i) => (
                <div key={i} className="flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '13px' }}>{h.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(h.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`badge ${h.type === 'national' ? 'badge-danger' : 'badge-info'}`}>{h.type}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <div className="empty-title">No active calendar</div>
          <div className="empty-text">Configure an academic calendar to get started.</div>
        </div>
      )}
    </div>
  );
}
