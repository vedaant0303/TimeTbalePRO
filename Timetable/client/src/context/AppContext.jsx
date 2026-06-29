import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [academicYear, setAcademicYear] = useState('');
  const [currentSemester, setCurrentSemester] = useState('');
  const [calendar, setCalendar] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGlobalData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchGlobalData = async () => {
    try {
      // Fetch active academic calendar from MongoDB
      const calRes = await api.get('/calendar/active');
      if (calRes.data) {
        setCalendar(calRes.data);
        setAcademicYear(calRes.data.academicYear);

        // Determine current semester dynamically from calendar dates
        const now = new Date();
        const activeSem = calRes.data.semesters?.find(sem => {
          const start = new Date(sem.startDate);
          const end = new Date(sem.endDate);
          return now >= start && now <= end;
        });
        setCurrentSemester(activeSem ? activeSem.name : calRes.data.semesters?.[0]?.name || 'N/A');
      }

      // Fetch departments from MongoDB
      const deptRes = await api.get('/departments');
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Error fetching global data:', err);
      // Fallback if no calendar exists yet
      setAcademicYear('Not Configured');
      setCurrentSemester('N/A');
    } finally {
      setLoading(false);
    }
  };

  const refreshGlobalData = () => fetchGlobalData();

  return (
    <AppContext.Provider value={{
      academicYear,
      currentSemester,
      calendar,
      departments,
      loading,
      refreshGlobalData
    }}>
      {children}
    </AppContext.Provider>
  );
}
