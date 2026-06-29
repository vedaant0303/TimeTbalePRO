import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { getSocket } from '../services/socket';

export default function Dashboard() {
  const { user } = useAuth();
  const { academicYear, currentSemester, departments } = useApp();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (academicYear) fetchStats();
  }, [academicYear]);

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { if (academicYear) fetchStats(); };
    socket.on('timetable-updated', refresh);
    return () => socket.off('timetable-updated', refresh);
  }, [academicYear]);

  const fetchStats = async () => {
    try {
      const promises = [];
      const deptId = user.department?._id || user.department;
      
      if (['admin', 'principal', 'dean'].includes(user.role)) {
        promises.push(api.get('/users?role=faculty').then(r => ({ faculty: r.data.length })));
        promises.push(api.get('/departments').then(r => ({ departments: r.data.length })));
        promises.push(api.get('/rooms').then(r => ({ rooms: r.data.length })));
        promises.push(api.get('/subjects').then(r => ({ subjects: r.data.length })));
      } else if (user.role === 'hod') {
        if (deptId) {
          promises.push(api.get(`/users?role=faculty&department=${deptId}`).then(r => ({ faculty: r.data.length })));
          promises.push(api.get(`/subjects?department=${deptId}`).then(r => ({ subjects: r.data.length })));
        }
        promises.push(api.get('/rooms').then(r => ({ rooms: r.data.length })));
      } else if (user.role === 'coordinator') {
        if (deptId) {
          promises.push(api.get(`/subjects?department=${deptId}`).then(r => ({ subjects: r.data.length })));
        }
        promises.push(api.get('/rooms').then(r => ({ rooms: r.data.length })));
        if (deptId && academicYear && academicYear !== 'Not Configured') {
          promises.push(api.get(`/timetable?department=${deptId}&academicYear=${academicYear}`).then(r => ({ entries: r.data.length })).catch(() => ({ entries: 0 })));
        }
      } else if (user.role === 'faculty') {
        if (academicYear && academicYear !== 'Not Configured') {
          promises.push(api.get(`/timetable?faculty=${user._id}&academicYear=${academicYear}`).then(r => ({ myClasses: r.data.length })).catch(() => ({ myClasses: 0 })));
        }
      } else if (user.role === 'student') {
        if (deptId && academicYear && academicYear !== 'Not Configured') {
          promises.push(api.get(`/timetable?department=${deptId}&division=${user.division}&semester=${user.semester}&academicYear=${academicYear}`).then(r => ({ classes: r.data.length })).catch(() => ({ classes: 0 })));
        }
      }

      const results = await Promise.all(promises);
      const merged = Object.assign({}, ...results);
      setStats(merged);
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const roleWelcome = {
    principal: 'Institute Overview',
    dean: 'Academic Management',
    hod: 'Department Overview',
    coordinator: 'Timetable Management',
    faculty: 'Your Schedule',
    student: 'Your Classes',
    admin: 'System Administration',
  };

  const getStatCards = () => {
    switch (user.role) {
      case 'principal':
      case 'dean':
      case 'admin':
        return [
          { icon: '◉', value: stats.faculty || 0, label: 'Faculty Members', color: 'purple' },
          { icon: '■', value: stats.departments || 0, label: 'Departments', color: 'blue' },
          { icon: '□', value: stats.rooms || 0, label: 'Rooms / Labs', color: 'green' },
          { icon: '▲', value: stats.subjects || 0, label: 'Total Subjects', color: 'orange' },
        ];
      case 'hod':
        return [
          { icon: '◉', value: stats.faculty || 0, label: 'Department Faculty', color: 'purple' },
          { icon: '▲', value: stats.subjects || 0, label: 'Subjects', color: 'blue' },
          { icon: '□', value: stats.rooms || 0, label: 'Available Rooms', color: 'green' },
        ];
      case 'coordinator':
        return [
          { icon: '▲', value: stats.subjects || 0, label: 'Subjects', color: 'purple' },
          { icon: '□', value: stats.rooms || 0, label: 'Available Rooms', color: 'green' },
          { icon: '▣', value: stats.entries || 0, label: 'Timetable Entries', color: 'blue' },
        ];
      case 'faculty':
        return [
          { icon: '▣', value: stats.myClasses || 0, label: 'Weekly Classes', color: 'purple' },
        ];
      case 'student':
        return [
          { icon: '▣', value: stats.classes || 0, label: 'Weekly Classes', color: 'purple' },
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner"></div><p>Loading dashboard...</p></div>;
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          {roleWelcome[user?.role]} — Academic Year {academicYear}
        </p>
      </div>

      <div className="stats-grid">
        {getStatCards().map((stat, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
            <div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Quick Actions</div>
              <div className="card-subtitle">Common tasks for your role</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {user.role === 'coordinator' && (
              <>
                <a href="/timetable-editor" className="nav-item">Create/Edit Timetable</a>
                <a href="/timeslots" className="nav-item">Manage Time Slots</a>
                <a href="/auto-generate" className="nav-item">Auto Generate Schedule</a>
                <a href="/rooms" className="nav-item">Check Room Availability</a>
              </>
            )}
            {user.role === 'hod' && (
              <>
                <a href="/subjects" className="nav-item">Manage Subjects & Faculty</a>
                <a href="/department-timetable" className="nav-item">Review Department Timetable</a>
                <a href="/approvals" className="nav-item">View Approvals</a>
              </>
            )}
            {user.role === 'principal' && (
              <>
                <a href="/master-timetable" className="nav-item">View Master Timetable</a>
                <a href="/approvals" className="nav-item">Pending Approvals</a>
                <a href="/reports" className="nav-item">Generate Reports</a>
              </>
            )}
            {user.role === 'dean' && (
              <>
                <a href="/calendar" className="nav-item">Configure Calendar</a>
                <a href="/timeslots" className="nav-item">Manage Time Slots</a>
                <a href="/master-timetable" className="nav-item">View Master Timetable</a>
              </>
            )}
            {user.role === 'admin' && (
              <>
                <a href="/users" className="nav-item">Manage Users</a>
                <a href="/rooms" className="nav-item">Manage Rooms</a>
                <a href="/reports" className="nav-item">View Reports</a>
              </>
            )}
            {user.role === 'faculty' && (
              <>
                <a href="/my-timetable" className="nav-item">View My Schedule</a>
                <a href="/unavailability" className="nav-item">Submit Unavailability</a>
              </>
            )}
            {user.role === 'student' && (
              <a href="/my-timetable" className="nav-item">View Class Timetable</a>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Your Profile</div>
              <div className="card-subtitle">Account & session details</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Name</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Email</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.email}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Role</span>
              <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
            {user?.department && (
              <div className="flex-between">
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Department</span>
                <span className="badge badge-warning">{user.department.name || user.department.code}</span>
              </div>
            )}
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Academic Year</span>
              <span className="badge badge-primary">{academicYear}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Current Semester</span>
              <span className="badge badge-info">{currentSemester}</span>
            </div>
            {user?.role === 'student' && user?.division && (
              <div className="flex-between">
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Division</span>
                <span className="badge badge-primary">Div {user.division}</span>
              </div>
            )}
            {user?.role === 'student' && user?.semester && (
              <div className="flex-between">
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your Semester</span>
                <span className="badge badge-info">Sem {user.semester}</span>
              </div>
            )}
            {(user?.role === 'faculty' || user?.role === 'coordinator') && user?.employeeId && (
              <div className="flex-between">
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Employee ID</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.employeeId}</span>
              </div>
            )}
            <div className="flex-between">
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Status</span>
              <span className="badge badge-success">● Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
