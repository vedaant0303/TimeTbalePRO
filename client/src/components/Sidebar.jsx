import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IconDashboard, IconClipboard, IconCheck, IconTrendingUp, IconFileText,
  IconEdit, IconLink, IconBuilding, IconClock, IconCpu, IconBuilding2,
  IconNotepad, IconUsers, IconBook, IconBan, IconCalendar, IconUserGroup,
  IconUniversity, IconGraduationCap
} from './Icons';

const I = (Comp) => <Comp size={18} />;

const roleNavItems = {
  principal: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/master-timetable', icon: I(IconClipboard), label: 'Master Timetable' },
    { path: '/approvals', icon: I(IconCheck), label: 'Approvals' },
    { path: '/workload', icon: I(IconTrendingUp), label: 'Faculty Workload' },
    { path: '/reports', icon: I(IconFileText), label: 'Reports' },
  ],
  hod: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/semester-setup', icon: I(IconCalendar), label: 'Semester Setup' },
    { path: '/subjects', icon: I(IconBook), label: 'Subjects' },
    { path: '/timetable-editor', icon: I(IconEdit), label: 'Timetable Editor' },
    { path: '/subject-config', icon: I(IconLink), label: 'Batch Combine' },
    { path: '/room-allocation', icon: I(IconBuilding), label: 'Labs & Classrooms' },
    { path: '/room-availability', icon: I(IconClock), label: 'Room Availability' },
    { path: '/master-timetable', icon: I(IconClipboard), label: 'Master Timetable' },
    { path: '/workload', icon: I(IconTrendingUp), label: 'Faculty Workload' },
    { path: '/approvals', icon: I(IconCheck), label: 'Approvals' },
    { path: '/student-batches', icon: I(IconUsers), label: 'Student Batches' },
  ],
  coordinator: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/semester-setup', icon: I(IconCalendar), label: 'Semester Setup' },
    { path: '/timeslots', icon: I(IconClock), label: 'Time Slots' },
    { path: '/subjects', icon: I(IconBook), label: 'Subjects' },
    { path: '/subject-config', icon: I(IconLink), label: 'Batch Combine' },
    { path: '/timetable-editor', icon: I(IconEdit), label: 'Timetable Editor' },
    { path: '/auto-generate', icon: I(IconCpu), label: 'Auto Generate' },
    { path: '/approvals', icon: I(IconCheck), label: 'Approvals & Status' },
    { path: '/room-allocation', icon: I(IconBuilding), label: 'Labs & Classrooms' },
    { path: '/room-availability', icon: I(IconClock), label: 'Room Availability' },
    { path: '/rooms', icon: I(IconBuilding2), label: 'Room Management' },
    { path: '/master-timetable', icon: I(IconClipboard), label: 'Master Timetable' },
    { path: '/workload', icon: I(IconTrendingUp), label: 'Faculty Workload' },
    { path: '/student-batches', icon: I(IconUsers), label: 'Student Batches' },
  ],
  faculty: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/my-timetable', icon: I(IconClipboard), label: 'My Timetable' },
    { path: '/room-availability', icon: I(IconBuilding), label: 'Room Availability' },
    { path: '/unavailability', icon: I(IconBan), label: 'Leave / Unavailability' },
  ],
  student: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/my-timetable', icon: I(IconClipboard), label: 'Class Timetable' },
  ],
  admin: [
    { path: '/dashboard', icon: I(IconDashboard), label: 'Dashboard' },
    { path: '/semester-setup', icon: I(IconCalendar), label: 'Semester Setup' },
    { path: '/users', icon: I(IconUserGroup), label: 'User Management' },
    { path: '/departments', icon: I(IconUniversity), label: 'Departments' },
    { path: '/faculty-profiles', icon: I(IconGraduationCap), label: 'Faculty Profiles' },
    { path: '/rooms', icon: I(IconBuilding2), label: 'Room Management' },
    { path: '/timeslots', icon: I(IconClock), label: 'Time Slots' },
    { path: '/subjects', icon: I(IconBook), label: 'Subjects' },
    { path: '/master-timetable', icon: I(IconClipboard), label: 'Master Timetable' },
    { path: '/reports', icon: I(IconFileText), label: 'Reports' },
  ],
};

export default function Sidebar({ collapsed, onToggle, className = '' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navItems = roleNavItems[user?.role] || [];

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${className}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerText='TT'; }} />
        </div>
        <div>
          <div className="sidebar-title">TimeTable Pro</div>
          <div className="sidebar-subtitle">Management System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" onClick={logout} title="Click to logout">
          <div className="user-avatar">{getInitials(user?.name)}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
