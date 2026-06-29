import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function ExportCenter() {
  const { academicYear, departments } = useApp();
  const { user } = useAuth();
  const [activeSem, setActiveSem] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [view, setView] = useState('class');
  const [selectedId, setSelectedId] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('5');
  const [selectedDiv, setSelectedDiv] = useState('1');
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { init(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const init = async () => {
    try {
      const [semRes, facRes, rmRes] = await Promise.all([
        api.get('/semester/active').catch(() => ({ data: null })),
        api.get('/users?role=faculty').catch(() => ({ data: [] })),
        api.get('/rooms').catch(() => ({ data: [] })),
      ]);
      setActiveSem(semRes.data);
      setFaculty(facRes.data || []);
      setRooms(rmRes.data || []);
      if (user?.role === 'coordinator') {
        setSelectedDept(user.department?._id || user.department || '');
      }
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setInitDone(true);
    }
  };

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const params = { academicYear: academicYear || '2025-2026' };
      if (selectedDept) params.department = selectedDept;
      if (view === 'class') {
        params.division = selectedDiv;
        params.semester = selectedSem;
      } else if (view === 'faculty' && selectedId) {
        params.faculty = selectedId;
      }

      const [entriesRes, slotsRes] = await Promise.all([
        api.get('/timetable', { params }),
        api.get(`/timeslots?academicYear=${academicYear || '2025-2026'}`),
      ]);

      const entries = entriesRes.data || [];
      const allSlots = slotsRes.data || [];
      const teachingSlots = allSlots.filter(ts => !ts.isBreak);

      if (entries.length === 0) {
        showToast('No timetable entries found. Generate a timetable first.', 'error');
        return;
      }

      if (format === 'excel') {
        await exportExcel(entries, teachingSlots);
      } else {
        await exportPDF(entries, teachingSlots);
      }
      showToast(`${format.toUpperCase()} exported successfully!`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const buildGrid = (entries, slots) => {
    const grid = {};
    for (const day of DAYS) {
      grid[day] = {};
      for (const slot of slots) {
        const match = entries.find(e =>
          e.day === day &&
          (e.timeSlot?._id === slot._id || e.timeSlot === slot._id)
        );
        if (match) {
          grid[day][slot._id] = {
            subj: match.subject?.code || match.subject?.name || '?',
            fac: match.faculty?.name || 'TBA',
            rm: match.room?.code || match.room?.name || '',
          };
        } else {
          grid[day][slot._id] = null;
        }
      }
    }
    return grid;
  };

  const exportExcel = async (entries, teachingSlots) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const groups = {};
    entries.forEach(e => {
      const key = `Div${e.division || '?'}_Sem${e.semester || '?'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    if (Object.keys(groups).length === 0) groups['All'] = entries;

    for (const [groupName, groupEntries] of Object.entries(groups)) {
      const rows = [
        [`Vidyavardhini's College of Engineering & Technology`],
        [`Timetable — ${groupName} | Academic Year: ${academicYear || '2025-2026'}`],
        [''],
        ['Day', ...teachingSlots.map(ts => `${ts.startTime}-${ts.endTime}`)],
      ];

      const grid = buildGrid(groupEntries, teachingSlots);
      for (const day of DAYS) {
        const row = [day];
        for (const slot of teachingSlots) {
          const cell = grid[day][slot._id];
          row.push(cell ? `${cell.subj}\n${cell.fac}${cell.rm ? '\n' + cell.rm : ''}` : '');
        }
        rows.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, ...teachingSlots.map(() => ({ wch: 22 }))];
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: teachingSlots.length } });
      ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: teachingSlots.length } });
      XLSX.utils.book_append_sheet(wb, ws, groupName.substring(0, 28));
    }

    XLSX.writeFile(wb, `Timetable_${academicYear || '2025-26'}.xlsx`);
  };

  const exportPDF = async (entries, teachingSlots) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });

    const groups = {};
    entries.forEach(e => {
      const key = `Div ${e.division || '?'} — Sem ${e.semester || '?'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    if (Object.keys(groups).length === 0) groups['Timetable'] = entries;

    let isFirst = true;
    for (const [groupName, groupEntries] of Object.entries(groups)) {
      if (!isFirst) doc.addPage();
      isFirst = false;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("Vidyavardhini's College of Engineering & Technology", 20, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${groupName} | Academic Year: ${academicYear || '2025-2026'}`, 20, 27);

      const headers = ['Day', ...teachingSlots.map(ts => `${ts.startTime}-${ts.endTime}`)];
      const grid = buildGrid(groupEntries, teachingSlots);
      const body = DAYS.map(day => {
        const row = [day];
        for (const slot of teachingSlots) {
          const cell = grid[day][slot._id];
          row.push(cell ? `${cell.subj}\n${cell.fac}${cell.rm ? '\n' + cell.rm : ''}` : '');
        }
        return row;
      });

      autoTable(doc, {
        head: [headers],
        body,
        startY: 34,
        styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 90, 160], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [240, 240, 248], halign: 'center', cellWidth: 22 } },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        theme: 'grid',
        margin: { left: 10, right: 10 },
      });
    }

    doc.save(`Timetable_${academicYear || '2025-26'}.pdf`);
  };

  if (!initDone) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fadeIn">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--error-400)' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 14, fontWeight: 600
        }}>{toast.msg}</div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Export Center</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
        Export timetable data as structured Excel spreadsheets or PDF documents.
      </p>

      {!activeSem && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(245,158,11,0.3)' }}>
          <p style={{ color: 'var(--warning-400)', fontSize: 13 }}>
            No active semester found. Exporting from legacy timetable ({academicYear || '2025-2026'}).
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Export Configuration</div>
            <div className="card-subtitle">Choose what to export and in which format</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">Export Type</label>
            <select className="form-select" value={view} onChange={e => setView(e.target.value)}>
              <option value="class">Class / Division Timetable</option>
              <option value="faculty">Faculty Timetable</option>
              <option value="master">Master (All Classes)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              disabled={user?.role === 'coordinator'}
            >
              <option value="">All Departments</option>
              {(departments || []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>

          {view === 'class' && (
            <>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-select" value={selectedSem} onChange={e => setSelectedSem(e.target.value)}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Division</label>
                <select className="form-select" value={selectedDiv} onChange={e => setSelectedDiv(e.target.value)}>
                  {['1','2','3','A','B','C'].map(d => <option key={d} value={d}>Div {d}</option>)}
                </select>
              </div>
            </>
          )}

          {view === 'faculty' && (
            <div className="form-group">
              <label className="form-label">Faculty</label>
              <select className="form-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">All Faculty</option>
                {faculty.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, padding: '12px 28px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontWeight: 600 }}
            onClick={() => handleExport('excel')}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Export as Excel'}
          </button>
          <button
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, padding: '12px 28px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontWeight: 600 }}
            onClick={() => handleExport('pdf')}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Export as PDF'}
          </button>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontSize: 13 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary-400)' }}>Excel</div>
            <ul style={{ color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 1.8 }}>
              <li>One sheet per division/semester</li>
              <li>Days as rows, time slots as columns</li>
              <li>Subject code + faculty + room in cells</li>
              <li>College title header included</li>
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>PDF</div>
            <ul style={{ color: 'var(--text-muted)', paddingLeft: 16, lineHeight: 1.8 }}>
              <li>A3 Landscape format</li>
              <li>Colour-coded grid table</li>
              <li>Subject + faculty names per cell</li>
              <li>Multi-page for multiple classes</li>
            </ul>
          </div>
        </div>
        {activeSem && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
            Active Semester: <strong style={{ color: 'var(--text-primary)' }}>{activeSem.academicYear} — {activeSem.semester}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
