import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parse time string to minutes, hours 1-6 treated as PM
const parseToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (h >= 1 && h <= 6) h += 12;
  return h * 60 + m;
};

const formatTime = (date) => {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
};

const formatTime12 = (date) => {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export default function RoomAvailability() {
  const { academicYear } = useApp();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());
  const [activeSlots, setActiveSlots] = useState([]);
  const [activeSlotCount, setActiveSlotCount] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastFetched, setLastFetched] = useState(null);
  const [error, setError] = useState(null);
  const refreshTimerRef = useRef(null);

  // Live clock - updates every second
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAvailability = useCallback(async () => {
    if (!academicYear) return;
    try {
      const now = new Date();
      const day = DAYS[now.getDay()];
      const currentTime = formatTime(now);
      const res = await api.get(`/rooms/availability?academicYear=${academicYear}&day=${day}&currentTime=${currentTime}`);
      setRooms(res.data.rooms || []);
      setActiveSlots(res.data.activeSlots || []);
      setActiveSlotCount(res.data.activeSlotCount || 0);
      setLastFetched(new Date());
      setError(null);
    } catch (err) {
      console.error('Availability fetch error:', err);
      setError(err.response?.data?.message || 'Failed to fetch room availability');
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchAvailability();
    refreshTimerRef.current = setInterval(fetchAvailability, 30000);
    return () => clearInterval(refreshTimerRef.current);
  }, [fetchAvailability]);

  // Derived data
  const now = clock;
  const currentDay = DAYS[now.getDay()];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  const filteredRooms = rooms.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q) && !(r.building || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const freeRooms = filteredRooms.filter(r => r.status === 'free');
  const occupiedRooms = filteredRooms.filter(r => r.status === 'occupied');

  const totalFree = rooms.filter(r => r.status === 'free').length;
  const totalOccupied = rooms.filter(r => r.status === 'occupied').length;
  const labs = rooms.filter(r => r.type === 'lab');
  const freeLabs = labs.filter(r => r.status === 'free').length;
  const classrooms = rooms.filter(r => r.type === 'classroom');
  const freeClassrooms = classrooms.filter(r => r.status === 'free').length;

  // Type icon
  const typeIcon = (type) => {
    switch (type) {
      case 'lab': return '🖥';
      case 'classroom': return '🏫';
      case 'seminar_hall': return '🎤';
      case 'auditorium': return '🎭';
      default: return '📍';
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Scanning room status...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Hero Banner: Live Clock + Status */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.1) 100%)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: activeSlotCount > 0 ? '#ef4444' : '#10b981',
              display: 'inline-block',
              boxShadow: activeSlotCount > 0 ? '0 0 8px rgba(239,68,68,0.6)' : '0 0 8px rgba(16,185,129,0.6)',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {activeSlotCount > 0 ? 'LECTURE IN PROGRESS' : isWeekend ? 'WEEKEND — NO LECTURES' : 'NO ACTIVE LECTURE SLOT'}
            </span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', fontFamily: 'monospace' }}>
            {formatTime12(clock)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {currentDay}, {clock.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            {activeSlots.length > 0 && (
              <span style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 12, fontWeight: 700 }}>
                Slot: {activeSlots.map(s => `${s.startTime}–${s.endTime}`).join(', ')}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Summary Cards */}
          {[
            { label: 'Free', value: totalFree, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
            { label: 'Occupied', value: totalOccupied, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
            { label: 'Labs Free', value: `${freeLabs}/${labs.length}`, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
            { label: 'Classrooms Free', value: `${freeClassrooms}/${classrooms.length}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: stat.bg,
              border: `1px solid ${stat.color}22`,
              borderRadius: 12,
              padding: '14px 20px',
              minWidth: 100,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters + Refresh */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter:</span>
          {['all', 'classroom', 'lab', 'seminar_hall', 'auditorium'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s ease',
                border: filterType === t ? '2px solid #6366f1' : '2px solid var(--border-color)',
                background: filterType === t ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                color: filterType === t ? '#6366f1' : 'var(--text-secondary)'
              }}
            >
              {t === 'all' ? `All (${rooms.length})` : t === 'seminar_hall' ? 'Seminar Hall' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: 180, padding: '6px 12px', fontSize: 12, marginLeft: 'auto' }}
          />
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600 }}
            onClick={() => { setLoading(true); fetchAvailability(); }}
          >
            ↻ Refresh
          </button>
          {lastFetched && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Updated {lastFetched.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '16px', marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>⚠ {error}</span>
        </div>
      )}

      {/* Room Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14
      }}>
        {filteredRooms.map(room => {
          const isFree = room.status === 'free';
          const borderColor = isFree ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)';
          const bgColor = isFree ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
          const statusColor = isFree ? '#10b981' : '#ef4444';
          const statusBg = isFree ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';

          return (
            <div
              key={room._id}
              style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Status glow bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: isFree
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)'
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {typeIcon(room.type)} {room.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {room.code}
                    {room.building && ` · ${room.building}`}
                    {room.floor != null && ` · F${room.floor}`}
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                  background: statusBg, color: statusColor,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: statusColor,
                    display: 'inline-block',
                    boxShadow: `0 0 6px ${statusColor}80`
                  }} />
                  {isFree ? 'Free' : 'In Use'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 8px' }}>
                  {room.type === 'seminar_hall' ? 'Seminar' : room.type}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary)' }}>
                  Cap: {room.capacity}
                </span>
                {room.department && (
                  <span style={{ fontSize: 10, color: '#8b5cf6', padding: '2px 8px', borderRadius: 4, background: 'rgba(139,92,246,0.1)' }}>
                    {room.department.code || room.department.name}
                  </span>
                )}
              </div>

              {/* Occupation details */}
              {room.occupiedBy && room.occupiedBy.length > 0 && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginTop: 6
                }}>
                  {room.occupiedBy.map((occ, i) => (
                    <div key={i} style={{
                      fontSize: 11,
                      display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
                      padding: '2px 0',
                      borderBottom: i < room.occupiedBy.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none'
                    }}>
                      <span style={{ fontWeight: 800, color: '#ef4444' }}>{occ.subject}</span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{occ.faculty}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 600
                      }}>
                        {occ.department}
                      </span>
                      {occ.batch && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4,
                          background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600
                        }}>
                          {occ.batch}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredRooms.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center', padding: 50,
            color: 'var(--text-muted)', fontSize: 14
          }}>
            No rooms found matching your filters.
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div style={{
        textAlign: 'center', padding: '16px 0', fontSize: 11,
        color: 'var(--text-muted)', fontStyle: 'italic'
      }}>
        Auto-refreshes every 30 seconds · {rooms.length} rooms tracked
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
