import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ROLES = [
  { id: 'student', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3.33 3 6 3s6-1 6-3v-5"/></svg>, label: 'Student', desc: 'View your class timetable' },
  { id: 'faculty', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: 'Faculty', desc: 'Manage your teaching schedule' },
  { id: 'coordinator', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, label: 'Coordinator', desc: 'Edit & manage timetables' },
  { id: 'hod', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>, label: 'HOD', desc: 'Head of Department' },
  { id: 'principal', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18"/><path d="M2 22h20"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>, label: 'Principal', desc: 'Institute overview & approvals' },
  { id: 'admin', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>, label: 'Admin', desc: 'System administration' },
];

export default function Login() {
  // Steps: 'role-select' → 'auth' → 'set-password' → redirect
  const [step, setStep] = useState('role-select');
  const [selectedRole, setSelectedRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null); // { exists, googleVerified, hasPassword }
  const [showRegister, setShowRegister] = useState(false);

  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for Google OAuth callback params
  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const errorMessages = {
        google_auth_failed: 'Google authentication failed. Only college email addresses (.edu.in) are allowed.',
        no_account: 'No account found with this Google email.',
        server_error: 'Server error during authentication. Please try again.'
      };
      setError(errorMessages[errorParam] || 'Authentication failed.');
      setStep('auth');
    }

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        // Check if user needs to set a password
        if (!user.password && user.googleVerified) {
          // User signed in with Google but has no password yet
          setEmail(user.email);
          setSelectedRole(user.role);
          loginWithToken(token, user);
          setStep('set-password');
          setSuccess('Google verification successful! Set a password for future quick logins.');
          return;
        }
        loginWithToken(token, user);
        navigate('/dashboard');
      } catch (err) {
        setError('Failed to process Google login. Please try again.');
      }
    }

    // Check if Google OAuth is configured
    api.get('/auth/google-enabled').then(res => setGoogleEnabled(res.data.enabled)).catch(() => {});
    api.get('/auth/allowed-domains').then(res => setAllowedDomains(res.data.domains)).catch(() => {});
  }, []);

  const validateEmailDomain = (email) => {
    if (!email) return false;
    const domain = email.split('@')[1];
    return domain && allowedDomains.some(d => domain.endsWith(d));
  };

  // Check email status when user types
  const checkEmail = async (emailVal) => {
    if (!emailVal || !validateEmailDomain(emailVal)) {
      setEmailStatus(null);
      return;
    }
    try {
      const res = await api.get(`/auth/check-email?email=${emailVal}`);
      setEmailStatus(res.data);
    } catch {
      setEmailStatus(null);
    }
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setStep('auth');
    setError('');
    setSuccess('');
    setEmailStatus(null);
    setShowRegister(false);
  };

  const handleGoogleLogin = () => {
    window.location.href = `http://localhost:5000/api/auth/google?role=${selectedRole}`;
  };

  // Handle email+password login (only for verified users)
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmailDomain(email)) {
      setError(`Only college email addresses are allowed (${allowedDomains.join(', ')}). Please use your institutional email.`);
      return;
    }

    setLoading(true);
    try {
      await login(email, password, selectedRole);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsPassword) {
        // Google-verified but no password set — go to set-password step
        setEmail(data.email || email);
        setPassword('');
        setConfirmPassword('');
        setStep('set-password');
        setError('');
        setSuccess('You have verified with Google! Please set a password for email+password login.');
      } else if (data?.requiresGoogleVerification) {
        setError(data.message);
      } else {
        setError(data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle new user registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!validateEmailDomain(email)) {
      setError(`Only college email addresses are allowed (${allowedDomains.join(', ')}). Please use your institutional email.`);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        role: selectedRole
      });
      setSuccess(res.data.message);
      setShowRegister(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle setting password after Google verification
  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/set-password', { email, password });
      if (res.data.token && res.data.user) {
        loginWithToken(res.data.token, res.data.user);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // STEP 1: ROLE SELECTION
  // ─────────────────────────────────────────
  if (step === 'role-select') {
    return (
      <div className="login-page">
        <div className="login-bg"></div>
        <div className="login-card" style={{ maxWidth: '520px' }}>
          <div className="login-logo">
            <img src="/logo.png" alt="Logo" onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerText='TT'; }} />
          </div>
          <h1 className="login-title">TimeTable Pro</h1>
          <p className="login-subtitle">Centralized Timetable & Resource Management</p>

          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--accent-300)', lineHeight: '1.5' }}>
              Welcome! Please select your role to continue
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '16px'
          }}>
            {ROLES.map(role => (
              <button
                key={role.id}
                id={`role-${role.id}`}
                onClick={() => handleRoleSelect(role.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--primary-400)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow-primary)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: '24px', flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--accent-400)' }}>{role.icon}</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>{role.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3' }}>{role.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px', lineHeight: '1.5' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Only college email addresses (<strong>{allowedDomains.length > 0 ? allowedDomains.join(', ') : '.edu.in'}</strong>) are allowed.
            <br />Google verification is mandatory for first-time login.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // STEP 3: SET PASSWORD (after Google verification)
  // ─────────────────────────────────────────
  if (step === 'set-password') {
    return (
      <div className="login-page">
        <div className="login-bg"></div>
        <div className="login-card">
          <div className="login-logo" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>✓</div>
          <h1 className="login-title" style={{ fontSize: '22px' }}>Set Your Password</h1>
          <p className="login-subtitle">Create a password for quick future logins</p>

          {success && (
            <div style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#4ade80',
              lineHeight: '1.4'
            }}>
              {success}
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '14px', display: 'flex' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg></span>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified Email</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-300)' }}>{email}</div>
            </div>
          </div>

          <form onSubmit={handleSetPassword}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                id="set-password"
                type="password"
                className="form-input"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              id="set-password-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex-center" style={{ gap: '8px' }}>
                  <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                  Setting password...
                </span>
              ) : 'Set Password & Continue'}
            </button>
          </form>

          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Skip for now (you'll use Google login only)
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // STEP 2: AUTH (Email + Password login)
  // ─────────────────────────────────────────
  const selectedRoleInfo = ROLES.find(r => r.id === selectedRole);

  return (
      <div className="login-page">
      <div className="login-bg"></div>
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="Logo" onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerText='TT'; }} />
        </div>
        <h1 className="login-title" style={{ fontSize: '22px' }}>TimeTable Pro</h1>
        <p className="login-subtitle">Centralized Timetable & Resource Management</p>

        {/* Selected role badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '20px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{selectedRoleInfo?.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-300)' }}>
              {selectedRoleInfo?.label}
            </span>
          </div>
          <button
            onClick={() => { setStep('role-select'); setError(''); setSuccess(''); }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '6px 12px',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            ← Change
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#4ade80',
            lineHeight: '1.4'
          }}>
            {success}
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">College Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="yourname@vcet.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex-center" style={{ gap: '8px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
