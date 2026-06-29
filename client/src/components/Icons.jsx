// Professional SVG icon library — replaces all emoji usage
// Each icon is a clean, outlined SVG that matches the dark UI theme

const Icon = ({ d, size = 18, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

// Dashboard / Analytics
export const IconDashboard = (p) => <Icon {...p} d={<>
  <rect x="3" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="3" width="7" height="7" rx="1" />
  <rect x="3" y="14" width="7" height="7" rx="1" />
  <rect x="14" y="14" width="7" height="7" rx="1" />
</>} />;

// Clipboard / Master Timetable
export const IconClipboard = (p) => <Icon {...p} d={<>
  <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
  <rect x="8" y="2" width="8" height="4" rx="1" />
  <line x1="8" y1="10" x2="16" y2="10" />
  <line x1="8" y1="14" x2="16" y2="14" />
  <line x1="8" y1="18" x2="12" y2="18" />
</>} />;

// Checkmark / Approvals
export const IconCheck = (p) => <Icon {...p} d={<>
  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
  <polyline points="22 4 12 14.01 9 11.01" />
</>} />;

// TrendingUp / Workload
export const IconTrendingUp = (p) => <Icon {...p} d={<>
  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
  <polyline points="17 6 23 6 23 12" />
</>} />;

// FileText / Reports
export const IconFileText = (p) => <Icon {...p} d={<>
  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
  <polyline points="14 2 14 8 20 8" />
  <line x1="8" y1="13" x2="16" y2="13" />
  <line x1="8" y1="17" x2="16" y2="17" />
</>} />;

// Edit / Pencil
export const IconEdit = (p) => <Icon {...p} d={<>
  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
</>} />;

// Link / Batch Combine
export const IconLink = (p) => <Icon {...p} d={<>
  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
</>} />;

// Building / School / Labs
export const IconBuilding = (p) => <Icon {...p} d={<>
  <path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18" />
  <path d="M2 22h20" />
  <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" />
</>} />;

// Clock / Time Slots
export const IconClock = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="10" />
  <polyline points="12 6 12 12 16 14" />
</>} />;

// Cpu / Auto Generate
export const IconCpu = (p) => <Icon {...p} d={<>
  <rect x="4" y="4" width="16" height="16" rx="2" />
  <rect x="9" y="9" width="6" height="6" />
  <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
  <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
  <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" />
  <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" />
</>} />;

// Building2 / Room Management
export const IconBuilding2 = (p) => <Icon {...p} d={<>
  <path d="M3 22V6a2 2 0 012-2h6v18" />
  <path d="M11 22V2h8a2 2 0 012 2v18" />
  <path d="M7 8h1" /><path d="M7 12h1" /><path d="M15 8h1" /><path d="M15 12h1" /><path d="M15 16h1" />
</>} />;

// Notepad / My Timetable
export const IconNotepad = (p) => <Icon {...p} d={<>
  <path d="M8 2v4" /><path d="M16 2v4" />
  <rect x="3" y="4" width="18" height="18" rx="2" />
  <path d="M3 10h18" />
  <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
  <path d="M8 18h.01" /><path d="M12 18h.01" />
</>} />;

// Users / Student Batches
export const IconUsers = (p) => <Icon {...p} d={<>
  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M23 21v-2a4 4 0 00-3-3.87" />
  <path d="M16 3.13a4 4 0 010 7.75" />
</>} />;

// BookOpen / Subjects
export const IconBook = (p) => <Icon {...p} d={<>
  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
</>} />;

// Ban / Unavailability
export const IconBan = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="10" />
  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
</>} />;

// Calendar / Semester
export const IconCalendar = (p) => <Icon {...p} d={<>
  <rect x="3" y="4" width="18" height="18" rx="2" />
  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
  <line x1="3" y1="10" x2="21" y2="10" />
</>} />;

// UserGroup / User Management
export const IconUserGroup = (p) => <Icon {...p} d={<>
  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
</>} />;

// University / Departments
export const IconUniversity = (p) => <Icon {...p} d={<>
  <path d="M12 2L2 7l10 5 10-5-10-5z" />
  <path d="M2 17l10 5 10-5" />
  <path d="M2 12l10 5 10-5" />
</>} />;

// GraduationCap / Faculty
export const IconGraduationCap = (p) => <Icon {...p} d={<>
  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
  <path d="M6 12v5c0 2 3.33 3 6 3s6-1 6-3v-5" />
</>} />;

// Trash / Delete
export const IconTrash = (p) => <Icon {...p} d={<>
  <polyline points="3 6 5 6 21 6" />
  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
</>} />;

// Plus
export const IconPlus = (p) => <Icon {...p} d={<>
  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
</>} />;

// AlertTriangle / Warning
export const IconAlert = (p) => <Icon {...p} d={<>
  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
</>} />;

// RefreshCw / Reset
export const IconRefresh = (p) => <Icon {...p} d={<>
  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
</>} />;

// Settings / Gear
export const IconSettings = (p) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
</>} />;

// BarChart / Chart
export const IconBarChart = (p) => <Icon {...p} d={<>
  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
</>} />;

// User / Person
export const IconUser = (p) => <Icon {...p} d={<>
  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
  <circle cx="12" cy="7" r="4" />
</>} />;

// FlaskConical / Lab
export const IconFlask = (p) => <Icon {...p} d={<>
  <path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2" />
  <path d="M8.5 2h7" /><path d="M7 16.5h10" />
</>} />;

// Mic / Seminar
export const IconMic = (p) => <Icon {...p} d={<>
  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
  <path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" />
  <line x1="8" y1="23" x2="16" y2="23" />
</>} />;

// Theater / Auditorium
export const IconTheater = (p) => <Icon {...p} d={<>
  <path d="M2 10s3-3 10-3 10 3 10 3" />
  <path d="M2 14s3 3 10 3 10-3 10-3" />
  <path d="M2 10v4" /><path d="M22 10v4" />
  <rect x="7" y="17" width="10" height="4" rx="1" />
</>} />;

// Hourglass / Loading
export const IconHourglass = (p) => <Icon {...p} d={<>
  <path d="M5 22h14" /><path d="M5 2h14" />
  <path d="M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22" />
  <path d="M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" />
</>} />;

// Undo / Back
export const IconUndo = (p) => <Icon {...p} d={<>
  <polyline points="1 4 1 10 7 10" />
  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
</>} />;

// Shuffle / Auto Distribute
export const IconShuffle = (p) => <Icon {...p} d={<>
  <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
  <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
  <line x1="4" y1="4" x2="9" y2="9" />
</>} />;

// X / Close
export const IconX = (p) => <Icon {...p} d={<>
  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
</>} />;

// Zap / Lightning
export const IconZap = (p) => <Icon {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;

// Pause / Idle
export const IconPause = (p) => <Icon {...p} d={<>
  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
</>} />;

// Play / Generate
export const IconPlay = (p) => <Icon {...p} d={<>
  <polygon points="5 3 19 12 5 21 5 3" />
</>} />;

// FileEdit / Draft
export const IconFileEdit = (p) => <Icon {...p} d={<>
  <path d="M4 13.5V4a2 2 0 012-2h8.5L20 7.5V20a2 2 0 01-2 2h-5.5" />
  <polyline points="14 2 14 8 20 8" />
  <path d="M10.42 12.61a2.1 2.1 0 112.97 2.97L7.95 21 4 22l1-3.96 5.42-5.43z" />
</>} />;

export default {
  IconDashboard, IconClipboard, IconCheck, IconTrendingUp, IconFileText,
  IconEdit, IconLink, IconBuilding, IconClock, IconCpu, IconBuilding2,
  IconNotepad, IconUsers, IconBook, IconBan, IconCalendar, IconUserGroup,
  IconUniversity, IconGraduationCap, IconTrash, IconPlus, IconAlert,
  IconRefresh, IconSettings, IconBarChart, IconUser, IconFlask, IconMic,
  IconTheater, IconHourglass, IconUndo, IconShuffle, IconX, IconZap,
  IconPause, IconPlay, IconFileEdit
};
