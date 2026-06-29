import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { IconBuilding, IconBuilding2, IconFlask, IconMic, IconEdit, IconTrash, IconPlus, IconCheck, IconX } from '../components/Icons';

const emptyForm = { name: '', code: '', building: '', floor: 0, capacity: 30, type: 'classroom', isShared: false, facilities: [], department: '', sharedWith: [] };

export default function RoomManagement() {
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [rRes, dRes] = await Promise.all([api.get('/rooms'), api.get('/departments')]);
      setRooms(rRes.data);
      setDepartments(dRes.data);
    } catch (err) { showToast('Failed to load rooms', 'error'); }
    finally { setLoading(false); }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) return showToast('Name and Code are required', 'error');
    try {
      // Format sharedWith for the model
      const payload = {
        ...form,
        sharedWith: form.isShared ? form.sharedWith.map(deptId => ({ deptId })) : [],
      };
      if (editId) {
        await api.put(`/rooms/${editId}`, payload);
        showToast('Room updated successfully');
      } else {
        await api.post('/rooms', payload);
        showToast('Room added successfully');
      }
      fetchData();
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleEdit = (room) => {
    setEditId(room._id);
    setForm({
      name: room.name || '',
      code: room.code || '',
      building: room.building || '',
      floor: room.floor || 0,
      capacity: room.capacity || 30,
      type: room.type || 'classroom',
      isShared: room.isShared || false,
      facilities: room.facilities || [],
      department: room.department?._id || room.department || '',
      sharedWith: (room.sharedWith || []).map(sw => sw.deptId?._id || sw.deptId || sw),
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete room "${name}"? This action cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/rooms/${id}`);
      showToast('Room deleted successfully');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const filteredRooms = typeFilter ? rooms.filter(r => r.type === typeFilter) : rooms;

  if (loading) return <div className="loading-overlay"><div className="spinner"></div></div>;

  const typeIcon = { classroom: <IconBuilding size={16}/>, lab: <IconFlask size={16}/>, seminar_hall: <IconMic size={16}/>, auditorium: <IconMic size={16}/> };
  const typeBadge = { classroom: 'badge-primary', lab: 'badge-success', seminar_hall: 'badge-warning', auditorium: 'badge-info' };

  return (
    <div className="animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--error-400)' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600,
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="stats-grid">
        {[
          { icon: <IconBuilding2 size={20}/>, count: rooms.length, label: 'Total Rooms', filter: '', color: 'purple' },
          { icon: <IconBuilding size={20}/>, count: rooms.filter(r => r.type === 'classroom').length, label: 'Classrooms', filter: 'classroom', color: 'blue' },
          { icon: <IconFlask size={20}/>, count: rooms.filter(r => r.type === 'lab').length, label: 'Labs', filter: 'lab', color: 'green' },
          { icon: <IconMic size={20}/>, count: rooms.filter(r => r.type === 'seminar_hall' || r.type === 'auditorium').length, label: 'Halls', filter: 'seminar_hall', color: 'orange' },
        ].map(s => (
          <div key={s.filter} className="stat-card" onClick={() => setTypeFilter(s.filter)} style={{ cursor: 'pointer', outline: typeFilter === s.filter ? '2px solid var(--primary-400)' : 'none' }}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.count}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Room Inventory {typeFilter && `— ${typeFilter.replace('_', ' ')}`}</div>
            <div className="card-subtitle">{filteredRooms.length} rooms</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(!showForm); }}>
            {showForm && !editId ? '✕ Close' : '+ Add Room'}
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--primary-400)' }}>
              {editId ? <><IconEdit size={14}/> Edit Room</> : <><IconPlus size={14}/> Add New Room</>}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Room Name *</label>
                <input className="form-input" placeholder="e.g. Room 101" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Room Code *</label>
                <input className="form-input" placeholder="e.g. R101" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Building</label>
                <input className="form-input" placeholder="e.g. Main Block" value={form.building} onChange={e => setForm(p => ({ ...p, building: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Floor</label>
                <input type="number" className="form-input" value={form.floor} onChange={e => setForm(p => ({ ...p, floor: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input type="number" className="form-input" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 30 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="classroom">Classroom</option>
                  <option value="lab">Laboratory</option>
                  <option value="seminar_hall">Seminar Hall</option>
                  <option value="auditorium">Auditorium</option>
                </select>
              </div>
            </div>

            {/* Department & Sharing */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Department (Owner)</label>
                <select className="form-select" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  <option value="">— No specific dept —</option>
                  {departments.map(d => <option key={d._id} value={d._id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 24 }}>
                  <input type="checkbox" checked={form.isShared} onChange={e => setForm(p => ({ ...p, isShared: e.target.checked, sharedWith: e.target.checked ? p.sharedWith : [] }))} />
                  <span className="form-label" style={{ margin: 0 }}>Shared Room</span>
                </label>
              </div>
            </div>

            {form.isShared && (
              <div className="form-group">
                <label className="form-label">Share with Departments</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {departments.filter(d => d._id !== form.department).map(d => (
                    <label key={d._id} style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer',
                      padding: '5px 12px', borderRadius: 20,
                      background: form.sharedWith.includes(d._id) ? 'var(--primary-400)' : 'var(--bg-tertiary)',
                      color: form.sharedWith.includes(d._id) ? '#fff' : 'var(--text-secondary)',
                      border: form.sharedWith.includes(d._id) ? '1px solid var(--primary-500)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s'
                    }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={form.sharedWith.includes(d._id)}
                        onChange={() => {
                          setForm(p => ({
                            ...p,
                            sharedWith: p.sharedWith.includes(d._id)
                              ? p.sharedWith.filter(id => id !== d._id)
                              : [...p.sharedWith, d._id]
                          }));
                        }}
                      />
                      {form.sharedWith.includes(d._id) ? '✓ ' : ''}{d.code}
                    </label>
                  ))}
                </div>
                {departments.filter(d => d._id !== form.department).length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No other departments available</span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>{editId ? '💾 Update Room' : '💾 Save Room'}</button>
              <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Dept</th>
                <th>Building</th>
                <th>Capacity</th>
                <th>Type</th>
                <th>Shared With</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No rooms found.</td></tr>
              )}
              {filteredRooms.map(r => (
                <tr key={r._id} style={{ opacity: deleting === r._id ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                  <td><span style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{r.code}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>
                    {r.department ? (
                      <span className="badge badge-primary" style={{ fontSize: 10 }}>
                        {departments.find(d => d._id === (r.department?._id || r.department))?.code || '—'}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r.building || '—'}</td>
                  <td>{r.capacity}</td>
                  <td>
                    <span className={`badge ${typeBadge[r.type] || 'badge-info'}`}>
                      {typeIcon[r.type] || ''} {r.type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {r.isShared && r.sharedWith?.length > 0 ? (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {r.sharedWith.map((sw, i) => {
                          const deptId = sw.deptId?._id || sw.deptId || sw;
                          const dept = departments.find(d => d._id === deptId);
                          return (
                            <span key={i} className="badge badge-info" style={{ fontSize: 9 }}>
                              🔗 {dept?.code || '?'}
                            </span>
                          );
                        })}
                      </div>
                    ) : r.isShared ? (
                      <span className="badge badge-warning" style={{ fontSize: 9 }}>Shared (no dept set)</span>
                    ) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => handleEdit(r)}
                      >Edit</button>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        onClick={() => handleDelete(r._id, r.name)}
                        disabled={deleting === r._id}
                      >{deleting === r._id ? 'Deleting...' : 'Delete'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
