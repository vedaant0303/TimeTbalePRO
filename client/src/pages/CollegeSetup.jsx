import { useState } from 'react';
import api from '../services/api';

const STEPS = ['College Info', 'Departments', 'Admin Account', 'Review & Finish'];

export default function CollegeSetup({ onSetupComplete }) {
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [form, setForm] = useState({
    collegeName: '', collegeCode: '', address: '', website: '', email: '', phone: '',
    allowedDomains: ['college.edu.in'],
    departments: [
      { name: '', code: '' }
    ],
    adminName: '', adminEmail: '', adminPassword: '',
    settings: {
      maxPeriodsPerDay: 8,
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '08:15',
      periodDuration: 60,
      batchesPerClass: 4
    }
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const addDept = () => setForm(f => ({ ...f, departments: [...f.departments, { name: '', code: '' }] }));
  const removeDept = (i) => setForm(f => ({ ...f, departments: f.departments.filter((_, idx) => idx !== i) }));
  const updateDept = (i, field, val) => setForm(f => ({
    ...f, departments: f.departments.map((d, idx) => idx === i ? { ...d, [field]: val } : d)
  }));

  const canNext = () => {
    if (step === 0) return form.collegeName.trim().length > 0;
    if (step === 1) return form.departments.some(d => d.name && d.code);
    if (step === 2) return form.adminEmail && form.adminPassword && form.adminPassword.length >= 6;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        departments: form.departments.filter(d => d.name && d.code)
      };
      const { data } = await api.post('/setup/initialize', payload);
      setResultData(data);
      setSetupDone(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Setup failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    window.location.href = '/login';
  };

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#16a34a', color: '#fff', padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: 14 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 680, background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 6 }}>🏫 College Setup Wizard</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Configure your institution in a few simple steps</p>
        </div>

        {/* Setup Complete Screen */}
        {setupDone ? (
          <div style={{ padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Setup Complete!</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 8 }}>
              <strong style={{ color: '#a5b4fc' }}>{form.collegeName}</strong> has been configured successfully.
            </p>
            {resultData?.departments?.length > 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>
                ✅ {resultData.departments.length} departments created
              </p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 24 }}>
              ✅ Admin account: {resultData?.admin?.email || form.adminEmail}
            </p>
            <button onClick={goToLogin} style={{ ...btnStyle, background: '#6366f1', color: '#fff', cursor: 'pointer', padding: '12px 32px', fontSize: 16 }}>
              → Go to Login Page
            </button>
          </div>
        ) : (
        <>

        {/* Progress */}
        <div style={{ display: 'flex', padding: '24px 32px 0', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#6366f1' : 'rgba(255,255,255,0.1)', transition: 'all 0.3s', marginBottom: 6 }} />
              <span style={{ fontSize: 10, color: i <= step ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ padding: 32 }}>
          {/* Step 0: College Info */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>College Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>College Name *</label>
                  <input style={inputStyle} placeholder="e.g. Vidyavardhini's College of Engineering" value={form.collegeName} onChange={e => update('collegeName', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Code</label>
                  <input style={inputStyle} placeholder="e.g. VCET" value={form.collegeCode} onChange={e => update('collegeCode', e.target.value.toUpperCase())} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} placeholder="Full address" value={form.address} onChange={e => update('address', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input style={inputStyle} placeholder="https://..." value={form.website} onChange={e => update('website', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Email Domain (for login)</label>
                  <input style={inputStyle} placeholder="e.g. vcet.edu.in" value={form.allowedDomains[0] || ''} onChange={e => update('allowedDomains', [e.target.value])} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Working Days</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {allDays.map(d => (
                    <label key={d} style={{ ...pillStyle, background: form.settings.workingDays.includes(d) ? '#6366f1' : 'rgba(255,255,255,0.06)', color: form.settings.workingDays.includes(d) ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                      <input type="checkbox" style={{ display: 'none' }} checked={form.settings.workingDays.includes(d)}
                        onChange={() => {
                          const days = form.settings.workingDays.includes(d) ? form.settings.workingDays.filter(x => x !== d) : [...form.settings.workingDays, d];
                          setForm(f => ({ ...f, settings: { ...f.settings, workingDays: days } }));
                        }} />
                      {d.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Departments */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Departments</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>Add all departments in your college</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                {form.departments.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, minWidth: 20 }}>{i + 1}.</span>
                    <input style={{ ...inputStyle, flex: 2 }} placeholder="Department Name" value={d.name} onChange={e => updateDept(i, 'name', e.target.value)} />
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Code (e.g. CSE)" value={d.code} onChange={e => updateDept(i, 'code', e.target.value.toUpperCase())} />
                    {form.departments.length > 1 && (
                      <button style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }} onClick={() => removeDept(i)}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addDept} style={{ marginTop: 12, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px dashed rgba(99,102,241,0.4)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, width: '100%' }}>
                + Add Department
              </button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin Account</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Create the first admin who will manage everything</p>
              <div>
                <label style={labelStyle}>Admin Name</label>
                <input style={inputStyle} placeholder="Full name" value={form.adminName} onChange={e => update('adminName', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Admin Email *</label>
                <input style={inputStyle} type="email" placeholder="admin@college.edu.in" value={form.adminEmail} onChange={e => update('adminEmail', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Password * (min 6 chars)</label>
                <input style={inputStyle} type="password" placeholder="Strong password" value={form.adminPassword} onChange={e => update('adminPassword', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Review & Finish</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={reviewCard}>
                  <div style={reviewLabel}>🏫 College</div>
                  <div style={reviewVal}>{form.collegeName} {form.collegeCode && `(${form.collegeCode})`}</div>
                </div>
                <div style={reviewCard}>
                  <div style={reviewLabel}>🏢 Departments ({form.departments.filter(d => d.name).length})</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {form.departments.filter(d => d.name).map((d, i) => (
                      <span key={i} style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '3px 10px', borderRadius: 12, fontSize: 12 }}>
                        {d.code || d.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={reviewCard}>
                  <div style={reviewLabel}>👤 Admin</div>
                  <div style={reviewVal}>{form.adminName || 'Admin'} — {form.adminEmail}</div>
                </div>
                <div style={reviewCard}>
                  <div style={reviewLabel}>📅 Working Days</div>
                  <div style={reviewVal}>{form.settings.workingDays.join(', ')}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 32px 32px', gap: 12 }}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)', color: step === 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: step === 0 ? 'not-allowed' : 'pointer' }}
          >
            ← Back
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              style={{ ...btnStyle, background: canNext() ? '#6366f1' : 'rgba(99,102,241,0.2)', color: '#fff', cursor: canNext() ? 'pointer' : 'not-allowed' }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ ...btnStyle, background: '#16a34a', color: '#fff', cursor: submitting ? 'wait' : 'pointer' }}>
              {submitting ? '⏳ Setting up...' : '🚀 Complete Setup'}
            </button>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' };
const pillStyle = { display: 'inline-flex', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', border: 'none' };
const btnStyle = { padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' };
const reviewCard = { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)' };
const reviewLabel = { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' };
const reviewVal = { fontSize: 14, color: '#fff', fontWeight: 500 };
