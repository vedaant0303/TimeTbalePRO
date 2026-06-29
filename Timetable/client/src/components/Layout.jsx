import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/master-timetable': 'Master Timetable',
  '/approvals': 'Approvals',
  '/workload': 'Faculty Workload',
  '/reports': 'Reports & Analytics',
  '/calendar': 'Academic Calendar',
  '/timeslots': 'Time Slot Configuration',
  '/subjects': 'Subjects & Faculty Assignment',
  '/department-timetable': 'Department Timetable',
  '/timetable-editor': 'Timetable Editor',
  '/auto-generate': 'Auto Generate Timetable',
  '/rooms': 'Room Management',
  '/my-timetable': 'My Timetable',
  '/unavailability': 'Leave / Unavailability',
  '/users': 'User Management',
  '/departments': 'Department Management',
  '/audit': 'Audit Log',
  '/semester-setup': 'Semester Setup',
  '/room-allocation': 'Labs & Classrooms',
  '/subject-config': 'Batch Combine',
  '/student-batches': 'Student Batch Manager',
  '/export': 'Export Center',
  '/faculty-profiles': 'Faculty Profiles',
  '/edit-profile': 'Edit Profile',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  // Listen for window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname]);

  const handleToggle = () => {
    if (isMobile) {
      setMobileOpen(prev => !prev);
    } else {
      setCollapsed(prev => !prev);
    }
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="sidebar-overlay visible" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        onToggle={handleToggle}
        className={isMobile && mobileOpen ? 'mobile-open' : ''}
      />
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Header collapsed={collapsed} onToggle={handleToggle} title={title} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
