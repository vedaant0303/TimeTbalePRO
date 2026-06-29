import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { useState, useEffect, createContext, useContext } from 'react';
import api from './services/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TimetableEditor from './pages/TimetableEditor';
import MasterTimetable from './pages/MasterTimetable';
import Approvals from './pages/Approvals';
import Workload from './pages/Workload';
import AcademicCalendar from './pages/AcademicCalendar';
import TimeSlots from './pages/TimeSlots';
import Subjects from './pages/Subjects';
import RoomManagement from './pages/RoomManagement';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import MyTimetable from './pages/MyTimetable';
import AutoGenerate from './pages/AutoGenerate';
import Reports from './pages/Reports';
import Unavailability from './pages/Unavailability';
import SemesterSetup from './pages/SemesterSetup';
import RoomAllocationAdmin from './pages/RoomAllocationAdmin';
import SubjectConfigPanel from './pages/SubjectConfigPanel';
import FacultyProfileEditor from './pages/FacultyProfileEditor';
import StudentBatchManager from './pages/StudentBatchManager';
import ExportCenter from './pages/ExportCenter';
import EditProfile from './pages/EditProfile';
import CollegeSetup from './pages/CollegeSetup';

// Context for college setup status
const SetupContext = createContext({ isSetupComplete: true, collegeName: '' });
export const useSetup = () => useContext(SetupContext);

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner"></div><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const { isSetupComplete } = useSetup();

  // If setup is NOT complete, redirect everything to /setup
  if (!isSetupComplete) {
    return (
      <Routes>
        <Route path="/setup" element={<CollegeSetup />} />
        <Route path="*" element={<Navigate to="/setup" />} />
      </Routes>
    );
  }

  // Setup is complete — normal routing
  return (
    <Routes>
      <Route path="/setup" element={<Navigate to="/login" />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="timetable-editor" element={<ProtectedRoute roles={['coordinator','hod']}><TimetableEditor /></ProtectedRoute>} />
        <Route path="master-timetable" element={<ProtectedRoute roles={['principal','dean','admin','hod','coordinator']}><MasterTimetable /></ProtectedRoute>} />
        <Route path="department-timetable" element={<ProtectedRoute roles={['hod','coordinator']}><TimetableEditor /></ProtectedRoute>} />
        <Route path="approvals" element={<ProtectedRoute roles={['principal','hod','coordinator']}><Approvals /></ProtectedRoute>} />
        <Route path="workload" element={<ProtectedRoute roles={['principal','dean','hod','coordinator','admin']}><Workload /></ProtectedRoute>} />
        <Route path="calendar" element={<ProtectedRoute roles={['dean','admin']}><AcademicCalendar /></ProtectedRoute>} />
        <Route path="timeslots" element={<ProtectedRoute roles={['dean','admin','coordinator']}><TimeSlots /></ProtectedRoute>} />
        <Route path="subjects" element={<ProtectedRoute roles={['hod','admin','coordinator']}><Subjects /></ProtectedRoute>} />
        <Route path="rooms" element={<ProtectedRoute roles={['admin','coordinator','hod']}><RoomManagement /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="departments" element={<ProtectedRoute roles={['admin']}><DepartmentManagement /></ProtectedRoute>} />
        <Route path="my-timetable" element={<ProtectedRoute roles={['faculty','student','coordinator']}><MyTimetable /></ProtectedRoute>} />
        <Route path="auto-generate" element={<ProtectedRoute roles={['coordinator','hod']}><AutoGenerate /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['principal','dean','admin']}><Reports /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute roles={['admin','principal']}><Reports /></ProtectedRoute>} />
        <Route path="unavailability" element={<ProtectedRoute roles={['faculty']}><Unavailability /></ProtectedRoute>} />
        <Route path="semester-setup" element={<ProtectedRoute roles={['admin','hod','coordinator']}><SemesterSetup /></ProtectedRoute>} />
        <Route path="room-allocation" element={<ProtectedRoute roles={['coordinator','hod','admin']}><RoomAllocationAdmin /></ProtectedRoute>} />
        <Route path="subject-config" element={<ProtectedRoute roles={['coordinator','admin','hod']}><SubjectConfigPanel /></ProtectedRoute>} />
        <Route path="faculty-profiles" element={<ProtectedRoute roles={['admin']}><FacultyProfileEditor /></ProtectedRoute>} />
        <Route path="student-batches" element={<ProtectedRoute roles={['faculty','admin','coordinator','hod']}><StudentBatchManager /></ProtectedRoute>} />
        <Route path="export" element={<ExportCenter />} />
        <Route path="edit-profile" element={<EditProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

// Setup Status Provider — checks if college is set up before showing anything
function SetupProvider({ children }) {
  const [setupStatus, setSetupStatus] = useState({ isSetupComplete: true, collegeName: '', loading: true });

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const { data } = await api.get('/setup/status');
      setSetupStatus({
        isSetupComplete: data.isSetupComplete,
        collegeName: data.collegeName || 'TimeTable Pro',
        loading: false
      });
    } catch (err) {
      // If setup endpoint fails, assume setup is done (backward compatibility)
      setSetupStatus({ isSetupComplete: true, collegeName: 'TimeTable Pro', loading: false });
    }
  };

  if (setupStatus.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0c29' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Checking setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <SetupContext.Provider value={setupStatus}>
      {children}
    </SetupContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SetupProvider>
        <AuthProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </SetupProvider>
    </BrowserRouter>
  );
}
