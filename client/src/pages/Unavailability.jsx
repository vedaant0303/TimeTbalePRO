import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  class: 'badge-warning', color: '#f59e0b' },
  approved: { label: 'Approved', class: 'badge-success', color: '#10b981' },
  rejected: { label: 'Rejected', class: 'badge-danger',  color: '#ef4444' },
};

export default function Unavailability() {
  const { user } = useAuth();
  const [form, setForm] = useState({ date: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchMyLeaves(); }, []);

  const fetchMyLeaves = async () => {
    try {
      // Fetch the current user's full profile to get unavailability list
      const { data } = await api.get('/auth/me');
      setMyLeaves((data.unavailability || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.date || !form.reason) {
      setError('Please fill in both date and reason.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/users/${user._id}/unavailability`, { ...form, slots: [], status: 'pending' });
      setSubmitted(true);
      setForm({ date: '', reason: '' });
      setTimeout(() => setSubmitted(false), 3000);
      fetchMyLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusCounts = myLeaves.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-fadeIn">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Leave & Unavailability</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Submit Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Submit Leave Request</div>
              <div className="card-subtitle">Request will be sent to HOD for approval</div>
            </div>
          </div>

          {submitted && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
              Request submitted successfully!
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input type="date" className="form-input" value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason *</label>
            <textarea className="form-textarea" rows={3} value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Briefly explain the reason for leave..." />
          </div>
          <button className="btn btn-primary" onClick={handleSubmit}
            disabled={!form.date || !form.reason || submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

        {/* Status Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <div key={s} className="stat-card" style={{ padding: '14px 12px' }}>
                <div style={{ fontSize: 24 }}>{s === 'pending' ? '' : s === 'approved' ? '' : ''}</div>
                <div>
                  <div className="stat-value" style={{ fontSize: 22 }}>{statusCounts[s] || 0}</div>
                  <div className="stat-label" style={{ textTransform: 'capitalize' }}>{s}</div>
                </div>
              </div>
            ))}
          </div>

          {/* History */}
          <div className="card" style={{ maxHeight: 400, overflow: 'auto' }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <div className="card-title" style={{ fontSize: 14 }}>My Leave History</div>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }}></div></div>
            ) : myLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No leave requests submitted yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 0 8px' }}>
                {myLeaves.map((l, i) => {
                  const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG.pending;
                  return (
                    <div key={l._id || i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
                      gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {l.date ? new Date(l.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {l.reason || 'No reason provided'}
                        </div>
                      </div>
                      <span className={`badge ${sc.class}`} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                        {sc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
