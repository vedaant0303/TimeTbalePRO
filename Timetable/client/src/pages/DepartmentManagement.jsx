import { useState, useEffect } from 'react';
import api from '../services/api';

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      <div className="card">
        <div className="card-header">
          <div className="card-title">Department Management</div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>HOD</th><th>Coordinator</th><th>Divisions</th><th>Status</th></tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d._id}>
                  <td><span style={{ fontWeight: '700', color: 'var(--primary-400)' }}>{d.code}</span></td>
                  <td>{d.name}</td>
                  <td>{d.hod?.name || '-'}</td>
                  <td>{d.coordinator?.name || '-'}</td>
                  <td>{d.divisions?.join(', ')}</td>
                  <td><span className={`badge ${d.isActive ? 'badge-success' : 'badge-danger'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
