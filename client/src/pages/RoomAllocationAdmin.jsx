import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { IconEdit, IconTrash } from '../components/Icons';
import '../styles/room-allocation.css';

export default function RoomAllocationAdmin() {
  const { user } = useAuth();
  const { departments } = useApp();
  const [selectedDept, setSelectedDept] = useState('');
  const [activeSemester, setActiveSemester] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roomForm, setRoomForm] = useState({
    name: '', code: '', roomNumber: '', building: '', floor: 0,
    capacity: 30, type: 'classroom', facilities: [], isActive: true
  });

  const facilityOptions = ['Projector', 'AC', 'Smart Board', 'WiFi', 'Computer Systems', 'Whiteboard', 'Sound System'];

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (selectedDept && activeSemester) fetchAllocation();
  }, [selectedDept, activeSemester]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const init = async () => {
    try {
      const [semRes, roomRes] = await Promise.all([
        api.get('/semester/active').catch(() => ({ data: null })),
        api.get('/rooms').catch(() => ({ data: [] }))
      ]);
      setActiveSemester(semRes.data);
      setRooms(roomRes.data || []);

      // Auto-select coordinator's department
      const deptId = user?.department?._id || user?.department;
      if (deptId) setSelectedDept(deptId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchAllocation = async () => {
    if (!activeSemester?._id) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/room-allocation/${selectedDept}/${activeSemester._id}`);
      setAllocation(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRoom = (roomId) => {
    if (!allocation) return;
    setAllocation(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => {
        const rId = r.roomId?._id || r.roomId;
        return rId === roomId ? { ...r, isAccessible: !r.isAccessible } : r;
      })
    }));
  };

  const updateSharing = (roomId, field, value) => {
    setAllocation(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => {
        const rId = r.roomId?._id || r.roomId;
        return rId === roomId ? { ...r, [field]: value } : r;
      })
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const roomsData = allocation.rooms.map(r => {
        // Extract plain IDs from any populated refs
        const sharedId = r.sharedWithDeptId?._id || r.sharedWithDeptId || null;
        return {
          roomId: r.roomId?._id || r.roomId,
          isAccessible: r.isAccessible,
          sharingPercentage: r.sharingPercentage || 100,
          sharedWithDeptId: sharedId || undefined
        };
      });

      await api.post('/room-allocation', {
        semesterId: activeSemester._id,
        departmentId: selectedDept,
        rooms: roomsData,
        batchConfig: allocation.batchConfig
      });
      showToast('Allocation saved successfully!');
      fetchAllocation();
    } catch (err) {
      showToast('Failed to save allocation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Room CRUD ---
  const handleAddRoom = async () => {
    if (!roomForm.name || !roomForm.code) return showToast('Room name and code are required', 'error');
    try {
      await api.post('/rooms', roomForm);
      showToast('Room added successfully!');
      setShowAddRoom(false);
      resetRoomForm();
      fetchRooms();
      if (selectedDept && activeSemester) fetchAllocation();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add room', 'error');
    }
  };

  const handleUpdateRoom = async () => {
    if (!editRoom) return;
    try {
      await api.put(`/rooms/${editRoom._id}`, roomForm);
      showToast('Room updated!');
      setEditRoom(null);
      resetRoomForm();
      fetchRooms();
      if (selectedDept && activeSemester) fetchAllocation();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update room', 'error');
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('Delete this room? This cannot be undone.')) return;
    try {
      await api.delete(`/rooms/${id}`);
      showToast('Room deleted');
      fetchRooms();
      if (selectedDept && activeSemester) fetchAllocation();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const openEditRoom = (room) => {
    setRoomForm({
      name: room.name, code: room.code, roomNumber: room.roomNumber || '',
      building: room.building || '', floor: room.floor || 0,
      capacity: room.capacity, type: room.type,
      facilities: room.facilities || [], isActive: room.isActive !== false
    });
    setEditRoom(room);
  };

  const resetRoomForm = () => {
    setRoomForm({
      name: '', code: '', roomNumber: '', building: '', floor: 0,
      capacity: 30, type: 'classroom', facilities: [], isActive: true
    });
  };

  const toggleFacility = (fac) => {
    setRoomForm(f => ({
      ...f,
      facilities: f.facilities.includes(fac)
        ? f.facilities.filter(x => x !== fac)
        : [...f.facilities, fac]
    }));
  };

  // Summary
  const summary = (() => {
    if (!allocation) return { full: 0, shared: 0, total: 0, labs: 0 };
    let full = 0, shared = 0, labs = 0;
    for (const r of allocation.rooms) {
      if (!r.isAccessible) continue;
      const room = rooms.find(rm => rm._id === (r.roomId?._id || r.roomId));
      const roomData = r.roomId?.type ? r.roomId : room;
      if (!roomData) continue;
      if (roomData.type === 'classroom') {
        if (r.sharingPercentage === 100) full++;
        else shared++;
      } else if (roomData.type === 'lab') {
        labs++;
      }
    }
    return { full, shared, total: full + shared, labs };
  })();

  // Filter rooms
  const filteredRooms = rooms.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const deptName = departments?.find(d => d._id === selectedDept)?.name || '';

  if (loading && !rooms.length) return <div className="page-loading"><div className="spinner"></div></div>;

  return (
    <div className="room-allocation-page">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <div className="page-header">
        <h1>Room Allocation</h1>
        <div className="header-filters" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {deptName && <span style={{ fontSize: 13, color: 'var(--primary-400)', fontWeight: 600 }}>{deptName}</span>}
          {['admin', 'hod', 'principal', 'dean'].includes(user?.role) && (
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">Select Department</option>
              {(departments || []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => { resetRoomForm(); setShowAddRoom(true); }}>
          + Add New Room
        </button>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {['all', 'classroom', 'lab', 'seminar_hall'].map(t => (
            <button key={t} className={`tab ${filterType === t ? 'active' : ''}`}
              style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={() => setFilterType(t)}>
              {t === 'all' ? 'All' : t === 'seminar_hall' ? 'Seminar' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="form-input"
          style={{ width: 180, padding: '6px 12px', fontSize: 13 }}
        />
      </div>

      {/* Summary Card */}
      {selectedDept && allocation && (
        <div className="summary-card">
          <h3>Classroom Summary</h3>
          <div className="summary-stats">
            <div className="stat"><span className="stat-value">{summary.full}</span><span className="stat-label">Full Classrooms</span></div>
            <div className="stat"><span className="stat-value">{summary.shared}</span><span className="stat-label">Shared</span></div>
            <div className="stat highlight"><span className="stat-value">{summary.total}</span><span className="stat-label">Total Effective</span></div>
            <div className="stat"><span className="stat-value">{summary.labs}</span><span className="stat-label">Labs</span></div>
            <div className="stat"><span className="stat-value">{rooms.length}</span><span className="stat-label">Total Rooms</span></div>
          </div>
        </div>
      )}

      {/* Two Sections: All Rooms + Allocation */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDept && allocation ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Left: All Rooms (CRUD) */}
        <div className="room-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>All Rooms ({filteredRooms.length})</h3>
          </div>
          <table className="room-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Building</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map(r => (
                <tr key={r._id} className={!r.isActive ? 'disabled-row' : ''}>
                  <td className="room-name">{r.name} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.code}</span></td>
                  <td><span className={`type-badge ${r.type}`}>{r.type}</span></td>
                  <td>{r.capacity}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.building || '—'} {r.floor ? `F${r.floor}` : ''}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => openEditRoom(r)}><IconEdit size={13}/></button>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 11, color: '#ef4444' }}
                        onClick={() => handleDeleteRoom(r._id)}><IconTrash size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRooms.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No rooms found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Allocation Table */}
        {selectedDept && allocation && (
          <div className="room-table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Allocation</h3>
              <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <table className="room-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Access</th>
                  <th>Share %</th>
                  <th>Shared With</th>
                </tr>
              </thead>
              <tbody>
                {allocation.rooms.map((r, i) => {
                  const room = r.roomId?.name ? r.roomId : rooms.find(rm => rm._id === r.roomId);
                  if (!room) return null;
                  // Apply filter
                  if (filterType !== 'all' && room.type !== filterType) return null;
                  if (searchQuery && !room.name?.toLowerCase().includes(searchQuery.toLowerCase())) return null;
                  return (
                    <tr key={i} className={!r.isAccessible ? 'disabled-row' : ''}>
                      <td className="room-name" style={{ fontSize: 13 }}>{room.name}</td>
                      <td>
                        <button className={`toggle-btn ${r.isAccessible ? 'on' : 'off'}`}
                          onClick={() => toggleRoom(room._id)}>
                          {r.isAccessible ? 'ON ●' : 'OFF ○'}
                        </button>
                      </td>
                      <td>
                        <input type="number" min={0} max={100}
                          value={r.sharingPercentage || 100}
                          onChange={e => updateSharing(room._id, 'sharingPercentage', parseInt(e.target.value))}
                          disabled={!r.isAccessible}
                          className="sharing-input"
                        />
                      </td>
                      <td>
                        <select
                          value={r.sharedWithDeptId?._id || r.sharedWithDeptId || ''}
                          onChange={e => updateSharing(room._id, 'sharedWithDeptId', e.target.value || null)}
                          disabled={!r.isAccessible || r.sharingPercentage === 100}
                          className="shared-select"
                        >
                          <option value="">—</option>
                          {(departments || []).filter(d => d._id !== selectedDept).map(d => (
                            <option key={d._id} value={d._id}>{d.code || d.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* No department selected */}
      {!selectedDept && (
        <div className="card" style={{ textAlign: 'center', padding: 40, marginTop: 16 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select a department to manage room allocation.</p>
        </div>
      )}

      {/* Add/Edit Room Modal */}
      {(showAddRoom || editRoom) && (
        <div className="modal-overlay" onClick={() => { setShowAddRoom(false); setEditRoom(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{editRoom ? 'Edit Room' : 'Add New Room'}</div>
              <button className="modal-close" onClick={() => { setShowAddRoom(false); setEditRoom(null); }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 140px)', paddingRight: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Room Name *</label>
                  <input className="form-input" placeholder="e.g. L-517" value={roomForm.name}
                    onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Code *</label>
                  <input className="form-input" placeholder="e.g. L517" value={roomForm.code}
                    onChange={e => setRoomForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={roomForm.type}
                    onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="classroom">Classroom</option>
                    <option value="lab">Lab</option>
                    <option value="seminar_hall">Seminar Hall</option>
                    <option value="auditorium">Auditorium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity</label>
                  <input className="form-input" type="number" min={1} value={roomForm.capacity}
                    onChange={e => setRoomForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Building</label>
                  <input className="form-input" placeholder="e.g. Main Block" value={roomForm.building}
                    onChange={e => setRoomForm(f => ({ ...f, building: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <input className="form-input" type="number" value={roomForm.floor}
                    onChange={e => setRoomForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Room No.</label>
                  <input className="form-input" placeholder="e.g. 517" value={roomForm.roomNumber}
                    onChange={e => setRoomForm(f => ({ ...f, roomNumber: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Facilities</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {facilityOptions.map(fac => (
                    <label key={fac} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer',
                      padding: '4px 10px', borderRadius: 20, background: roomForm.facilities.includes(fac) ? 'var(--primary-400)' : 'var(--bg-tertiary)',
                      color: roomForm.facilities.includes(fac) ? '#fff' : 'var(--text-secondary)', transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={roomForm.facilities.includes(fac)} onChange={() => toggleFacility(fac)} style={{ display: 'none' }} />
                      {fac}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={roomForm.isActive} onChange={e => setRoomForm(f => ({ ...f, isActive: e.target.checked }))} />
                  Active
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, marginTop: 12, borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => { setShowAddRoom(false); setEditRoom(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={editRoom ? handleUpdateRoom : handleAddRoom}>
                {editRoom ? 'Save Changes' : 'Add Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && selectedDept && <div className="page-loading"><div className="spinner"></div></div>}
    </div>
  );
}
