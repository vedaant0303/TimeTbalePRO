import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';

export default function Approvals() {
  const { user } = useAuth();
  const { academicYear } = useApp();
  const isCoordinator = user?.role === 'coordinator';
  const isHOD = user?.role === 'hod';
  const isPrincipal = user?.role === 'principal';
  const isApprover = isHOD || isPrincipal; // can approve/reject timetables
  const canSubmit = isCoordinator || isHOD; // coordinator→HOD, HOD→Principal
  const [activeTab, setActiveTab] = useState(isCoordinator ? 'timetable' : 'leaves');
  const [leaves, setLeaves] = useState([]);
  const [timetableApprovals, setTimetableApprovals] = useState([]);
  const [leaveFilter, setLeaveFilter] = useState('pending');
  const [ttFilter, setTtFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitForm, setSubmitForm] = useState({ semester: '5', level: isCoordinator ? 'hod' : 'principal' });
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (isApprover) fetchLeaves(); }, [leaveFilter]);
  useEffect(() => { fetchTTApprovals(); }, [ttFilter]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    const tasks = [fetchTTApprovals()];
    if (isApprover) tasks.push(fetchLeaves());
    await Promise.all(tasks);
    setLoading(false);
  };

  const fetchLeaves = async () => {
    try {
      const endpoint = leaveFilter === 'pending' ? '/leaves/pending' : `/leaves/all?status=${leaveFilter}`;
      const { data } = await api.get(endpoint);
      setLeaves(data);
    } catch (err) { console.error('Leave fetch err:', err); }
  };

  const fetchTTApprovals = async () => {
    try {
      const { data } = await api.get(`/timetable/approvals?status=${ttFilter}`);
      // Coordinator & HOD filter by their department
      const userDeptId = user?.department?._id || user?.department;
      const filtered = (isCoordinator || isHOD)
        ? data.filter(a => !userDeptId || a.department?._id === userDeptId)
        : data;
      setTimetableApprovals(filtered);
    } catch (err) { console.error('TT approval fetch err:', err); }
  };

  const handleLeaveAction = async (userId, leaveId, status) => {
    try {
      await api.put(`/leaves/${userId}/${leaveId}`, { status });
      fetchLeaves();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const handleTTAction = async (id, status, remarks = '') => {
    try {
      await api.put(`/timetable/approvals/${id}`, { status, remarks });
      fetchTTApprovals();
    } catch (err) { console.error(err); }
  };

  const handleSubmitForApproval = async () => {
    const deptId = user.department?._id || user.department;
    if (!deptId) return showToast('Department not found. Please check your profile.', 'error');
    if (!academicYear || academicYear === 'Not Configured') return showToast('No academic year configured. Please set up the academic calendar first.', 'error');
    
    setSubmitting(true);
    try {
      await api.post('/timetable/submit-approval', {
        department: deptId,
        academicYear,
        semester: parseInt(submitForm.semester),
        level: submitForm.level
      });
      showToast('Timetable submitted for ' + (submitForm.level === 'hod' ? 'HOD' : 'Principal') + ' approval!');
      fetchTTApprovals();
    } catch (err) {
      showToast(err.response?.data?.message || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  const pendingLeaveCount = leaves.filter(l => l.status === 'pending').length;

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

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Approvals</h1>

      {/* Submit Section — Coordinator submits to HOD; HOD forwards to Principal */}
      {canSubmit && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--primary-400)' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                {isCoordinator ? 'Submit Timetable for HOD Approval' : 'Forward Timetable to Principal'}
              </div>
              <div className="card-subtitle">
                {isCoordinator ? 'Send your generated timetable to HOD for review' : 'Forward the approved timetable to Principal for final sign-off'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Semester</label>
              <select className="form-select" value={submitForm.semester}
                onChange={e => setSubmitForm(p => ({ ...p, semester: e.target.value }))}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Send To</label>
              <select className="form-select" value={submitForm.level}
                onChange={e => setSubmitForm(p => ({ ...p, level: e.target.value }))}>
                {isCoordinator && <option value="hod">HOD</option>}
                <option value="principal">Principal</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleSubmitForApproval} disabled={submitting}>
              {submitting ? 'Submitting...' : isCoordinator ? 'Submit for Approval' : 'Forward to Principal'}
            </button>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="tab-group" style={{ marginBottom: 20 }}>
        {isApprover && (
          <button className={`tab ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')}>
            Leave Requests
            {pendingLeaveCount > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}>
                {pendingLeaveCount}
              </span>
            )}
          </button>
        )}
        <button className={`tab ${activeTab === 'timetable' ? 'active' : ''}`} onClick={() => setActiveTab('timetable')}>
          Timetable Approvals
        </button>
      </div>


      {/* LEAVE REQUESTS TAB */}
      {activeTab === 'leaves' && (
        <>
          <div className="tabs" style={{ marginBottom: 16 }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} className={`tab ${leaveFilter === s ? 'active' : ''}`} onClick={() => setLeaveFilter(s)}>
                {s === 'pending' ? '' : s === 'approved' ? '' : ''} {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {leaves.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <h3 style={{ marginBottom: 8 }}>No {leaveFilter} leave requests</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {leaveFilter === 'pending' ? 'All leave requests have been processed.' : `No ${leaveFilter} leave requests found.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leaves.map(l => (
                <div key={l._id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{l.facultyName}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {l.department?.name || 'Unknown Dept'}  ·  {l.facultyEmail}
                      </p>
                    </div>
                    <span className={`badge ${l.status === 'approved' ? 'badge-success' : l.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {l.status}
                    </span>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Date</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {l.date ? new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Reason</span>
                      <span style={{ fontSize: 13 }}>{l.reason || 'No reason given'}</span>
                    </div>
                  </div>

                  {l.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleLeaveAction(l.userId, l._id, 'approved')}>
                        Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleLeaveAction(l.userId, l._id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TIMETABLE APPROVALS TAB */}
      {activeTab === 'timetable' && (
        <>
          <div className="tabs" style={{ marginBottom: 16 }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} className={`tab ${ttFilter === s ? 'active' : ''}`} onClick={() => setTtFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {timetableApprovals.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}></div>
              <h3 style={{ marginBottom: 8 }}>No {ttFilter} timetable approvals</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                There are no timetable approval requests with status "{ttFilter}".
              </p>
            </div>
          ) : (
            timetableApprovals.map(a => (
              <div key={a._id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>{a.department?.name || 'Department'}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Semester {a.semester} — {a.academicYear} — Level: {a.level}
                    </p>
                  </div>
                  <span className={`badge ${a.status === 'approved' ? 'badge-success' : a.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                    {a.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Submitted by: {a.submittedBy?.name} on {new Date(a.submittedAt).toLocaleDateString()}
                  {a.reviewedBy && <span> | Reviewed by: {a.reviewedBy.name}</span>}
                </div>
                {a.remarks && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12, marginBottom: 12 }}>
                    <strong>Remarks:</strong> {a.remarks}
                  </div>
                )}
                {a.status === 'pending' && isApprover && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleTTAction(a._id, 'approved', 'Looks good')}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      const r = prompt('Rejection reason:');
                      if (r) handleTTAction(a._id, 'rejected', r);
                    }}>Reject</button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
