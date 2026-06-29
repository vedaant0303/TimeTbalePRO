import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Header({ collapsed, onToggle, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={`header ${collapsed ? 'collapsed' : ''}`}>
      <div className="header-left">
        <button className="header-toggle" onClick={onToggle}>
          {collapsed ? '☰' : '✕'}
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="header-right">
        <span className="header-badge">{user?.role}</span>
        <span
          onClick={() => navigate('/edit-profile')}
          style={{
            fontSize: '13px', color: 'var(--text-secondary)',
            cursor: 'pointer', borderBottom: '1px dashed transparent',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.target.style.color = 'var(--primary-400)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
          title="Edit Profile"
        >{user?.name}</span>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
