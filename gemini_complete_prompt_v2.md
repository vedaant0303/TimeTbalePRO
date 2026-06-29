# COMPLETE SYSTEM PROMPT — Academic Timetable Management System
## Target: Gemini 2.5 Pro  |  Version 2.0 (Full Coverage)
## Covers: All 7 Features + All 15 Constraints

---

# PART A — CONTEXT & BACKGROUND

You are building a full-stack **Academic Timetable Management System** for
**Vidyavardhini's College of Engineering and Technology**, specifically for the
**Department of Computer Science and Engineering (Data Science) — CSEDS** and its
combined operation with **AIDS (Artificial Intelligence and Data Science)**.

## Technology Stack
- **Frontend**: React.js (Vite), React Router, Socket.IO Client, jspdf, xlsx
- **Backend**: Node.js + Express.js, MongoDB (Mongoose), Passport.js (Google OAuth 2.0), JWT, Socket.IO
- **Roles**: Admin, HOD, Principal, Coordinator, Faculty, Student

## Existing Pages / Modules
Dashboard, AutoGenerate, TimetableEditor, MasterTimetable, UserManagement,
RoomManagement, Subjects, DepartmentManagement, TimeSlots, Approvals, Reports,
MyTimetable, Unavailability, Workload.

You must extend, redesign, and fix this system per all specifications below.

---

# PART B — DOMAIN DATA (from actual college Excel + PDF files)

## B1. Departments
- **CSEDS** — Computer Science and Engineering (Data Science)
- **AIDS** — Artificial Intelligence and Data Science
- These two departments are **combined** for certain subjects and practical batches.

## B2. Classes & Batch Configuration

| Class | Divisions | Practical Batches | Notes |
|-------|-----------|-------------------|-------|
| SE    | SE1, SE2, SE3 | 4 per class (B1–B4) | All SE subjects follow 4-batch pattern |
| TE    | TE1, TE2, TE3 | 4 per class (B1–B4) | CC subject uses combined batch rule |
| BE    | BE (1 div)    | 3 per class (B1–B3) | Major project occupies most morning slots |

**Combined Batch Rule (Constraint C6 — CC subject)**:
- B1+B2 → single faculty, same time slot, one lab
- B3+B4 → different faculty, same time slot, different lab
- Both pairs run simultaneously — neither is sequential
- Applies to: TE1, TE2, TE3 for Compiler Construction (CC)

Specific CC assignments (even sem 2025-26):
| Class | B1+B2 Faculty | B1+B2 Lab | B3+B4 Faculty | B3+B4 Lab |
|-------|--------------|-----------|--------------|-----------|
| TE1   | Sejal D. (SD) | 115C,115D or 308D | Nishigandha P. (NP) | 308D |
| TE2   | Nishigandha P. (NP) | 308D | Nishigandha P. (NP) | 308D |
| TE3   | Janisa P. (JP) | 115C,115D or 308D | Sejal D. (SD) | 308D |

## B3. Bell Schedule (actual time slots)

| Slot | Time | Type |
|------|------|------|
| 1 | 08:15 – 09:15 | Teaching |
| 2 | 09:15 – 10:15 | Teaching |
| — | 10:15 – 10:30 | BREAK (hard-locked, never scheduled) |
| 3 | 10:30 – 11:15 | Teaching |
| — | 11:15 – 11:30 | BREAK (hard-locked, never scheduled) |
| 4 | 11:30 – 12:15 | Teaching |
| — | 12:15 – 12:30 | BREAK (hard-locked, never scheduled) |
| 5 | 12:30 – 13:30 | Teaching |
| 6 | 13:30 – 14:30 | Teaching |
| 7 | 14:30 – 15:30 | Teaching |
| 8 | 15:30 – 16:30 | Teaching |
| 9 | 16:30 – 17:30 | Teaching |

## B4. Physical Infrastructure

### Classrooms (Constraint C3, C9, C12, C13)
| Room | Capacity | Ownership | Notes |
|------|----------|-----------|-------|
| 517  | ~60 | CSEDS full | Primary lecture hall |
| 519  | ~60 | CSEDS full | Primary lecture hall |
| 520  | ~60 | CSEDS full | Primary lecture hall |
| 425  | ~40 | SHARED 50/50 | CSEDS gets 50%, AIDS gets 50% |
| 218  | —   | Shared/Other | Used by CSEDS occasionally |
| 424  | —   | AIDS primary | Used by CSEDS when available |

**CSEDS effective classrooms = 3.5** (517 + 519 + 520 = 3 full; 425 = 0.5 share)

### Labs
| Lab ID | Capacity | Notes |
|--------|----------|-------|
| 308A | 25 | Computer lab |
| 308B | 25 | Computer lab |
| 308C | — | Computer lab |
| 308D | — | Computer lab — CC combined batch primary |
| 115-C | — | Computer lab |
| 115-D | — | Computer lab |
| 220 | — | Lab |
| 221 | 40 | Lab |
| 222 | — | Lab |
| 12 (211) | — | Lab 12, room 211 combined |
| 7/208 | — | Lab 7, room 208 combined |
| 8/208 | — | Lab 8, room 208 combined |
| 114 | — | Lab |

**NOT all labs accessible at all times — Admin must toggle per semester (Constraint C3).**

## B5. Full Faculty List (CSEDS, Even Sem 2025-26)

### CSEDS Faculty
| # | Full Name | Short Code | Designation |
|---|-----------|-----------|-------------|
| 1 | Dr. Satish Salunkhe | SSS | Professor / HOD |
| 2 | Dr. Yogesh Pingale | YP | Asst. Professor |
| 3 | Dr. Vikrant Agaskar | VA | Asst. Professor |
| 4 | Sejal D'mello | SD | Asst. Professor |
| 5 | Neha Raut | NMR | Asst. Professor |
| 6 | Ichhanshu Jaiswal | IJ | Asst. Professor |
| 7 | Maya V. Chakkedath Varghese | MVC | Asst. Professor |
| 8 | Janisa Pereira | JP | Asst. Professor |
| 9 | Leena Raut | LR | Asst. Professor |
| 10 | Nishigandha Pagare | NP | Asst. Professor |
| 11 | Sayalee Susvilkar | SS | Asst. Professor |
| 12 | Nivedha Raut | NKR | Asst. Professor |
| 13 | Anjali Pardeshi | AP | Asst. Professor |
| 14 | Shilpa Bane | SB | Asst. Professor |
| 15 | Ammarah Shaikh | AS | Asst. Professor |
| 16 | Shital Cheke | SC | Asst. Professor |
| 17 | Bhavika Joshi | BJ | Asst. Professor |
| 18 | Sanjay Bhadke | SBK | Asst. Professor |
| 19 | Sachin Gangan | SG | Asst. Professor |
| 20 | Candida Gomes | CG | Asst. Professor |
| 21 | Vishal Gangan | VG | Asst. Professor |
| 22 | Sneha Yadav | SY | Asst. Professor |
| 23 | Raunak Joshi | RJ | Asst. Professor |

### External / Cross-Department Faculty (Constraint C15)
| Name | Source Dept | Subjects in CSEDS |
|------|------------|-------------------|
| Faculty from MECH | Mechanical | BDM |
| Tatwdarshi N. (TN) | Unknown | OE |
| Vaishali S. (VS) | AIDS | DBMS |
| OG | AIDS | OS |
| RV | AIDS | CT, CC |
| GB | AIDS | DT |
| KG | AIDS | MDM lab |

### Class Coordinators
| Class | Coordinator |
|-------|------------|
| SE1 | Shilpa Bane (SB) |
| SE2 | Nishigandha Pagare (NP) |
| SE3 | Sayalee Susvilkar (SS) |
| TE1 | Nivedha Raut (NKR) |
| TE2 | Anjali Pardeshi (AP) |
| TE3 | Anjali Pardeshi (AP) / Shilpa Bane (SB) |
| BE  | Anjali Pardeshi (AP) |

### Approval Chain
| Role | Name |
|------|------|
| HOD | Dr. Satish Salunkhe |
| Timetable Committee | Maya Varghese + Shital Cheke |
| Dean (Academics) | Dr. Rakesh Himte |
| Principal | Dr. Vikas Gupta |

## B6. Faculty Workload — All 17 Faculty (Even Sem 2025-26)
Format: Class | Subject | Theory hrs | B1 prac | B2 prac | B3 prac | B4 prac | Row Total

### 1. Dr. Satish Salunkhe (SSS) | Total: 10 | Extra: 0 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-2 | DBMS | 3 | — | — | 2 | 2 | 7 |
| SE-3 | DBMS | 3 | — | — | — | — | 3 |
Mini: 1 | Major: 1

### 2. Dr. Yogesh Pingale (YP) | Total: 22 | Extra: 4 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-3 | MDM | 3 | 2 | 2 | 2 | 2 | 11 |
| SE-2 | MDM | 3 | 2 | 2 | 2 | 2 | 11 |
Extra: 3 hrs SE3 MDM lecture + 1hr SE3 B1 MDM practical | Mini: 1 | Major: 1

### 3. Dr. Vikrant Agaskar (VA) | Total: 20 | Extra: 2 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | OS | — | 2 | — | 2 | — | 4 |
| SE-2 | OS | — | 2 | — | — | — | 2 |
| SE-3 | OS | 3 | 2 | 2 | 2 | 2 | 11 |
| BE | ILOC-2 | 3 | — | — | — | — | 3 |
Extra: 2hrs SE-2 B1 OS practicals | Mini: 1 | Major: 1

### 4. Sejal D'mello (SD) | Total: 21 | Extra: 3 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-2 | OS | 3 | — | 2 | 2 | 2 | 9 |
| TE-2 | SEPM | — | — | — | — | 2 | 2 |
| SE-3 | OE | 2 | — | — | — | — | 2 |
| TE-3 | CC | — | — | — | 2 | 2 | 4 |
| TE-1 | CC | — | 2 | 2 | — | — | 4 |
Extra: 3hrs SE-2 OS lectures | Mini: 1 | Major: 1

### 5. Neha Raut (NMR) | Total: 20 | Extra: 2 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | OS | 3 | — | 2 | — | 2 | 7 |
| TE-3 | DAV | 3 | 2 | 2 | 2 | 2 | 11 |
| TE Honors | Gaming AI | 2 | — | — | — | — | 2 |
Extra: 2hrs TE Honours lecture | Mini: 1

### 6. Ichhanshu Jaiswal (IJ) | Total: 21 | Extra: 3 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-2 | ML | 3 | — | 2 | 2 | — | 7 |
| TE-3 | ML | 3 | — | 2 | — | — | 5 |
| BE-1 | AAI | 3 | 2 | 2 | 2 | — | 9 |
Extra: 3hrs TE-3 ML lecture | Mini: 1 | Major: 1

### 7. Maya V. Chakkedath Varghese (MVC) | Total: 22 | Extra: 4 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-3 | CSS | 3 | 2 | 2 | 2 | 2 | 11 |
| TE-1 | CSS | 3 | 2 | 2 | 2 | 2 | 11 |
Extra: 3hrs TE3 CSS lecture + 1hr TE3 B1 CSS practical | Mini: 1 | Major: 1

### 8. Janisa Pereira (JP) | Total: 21 | Extra: 3 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-1 | DAV | 3 | 2 | 2 | 2 | 2 | 11 |
| TE-3 | CC | — | 2 | 2 | — | — | 4 |
| TE1 DLOC-02 | IVP | 3 | — | — | — | — | 3 |
| TE2&3 DLOC-02 | IVP | 3 | — | — | — | — | 3 |
Extra: 3hrs TE1 DLOC-IVP Lecture | Mini: 1 | Major: 1

### 9. Leena Raut (LR) | Total: 20 | Extra: 2 | Project: 2
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | DBMS | 3 | — | 2 | 2 | 2 | 9 |
| SE-2 | DBMS | — | — | 2 | — | — | 2 |
| SE-3 | DBMS | — | 2 | — | 2 | 2 | 6 |
| TE1,2&3 DLOC-02 | DC | 3 | — | — | — | — | 3 |
Extra: 2hrs SE-2 B2 DBMS practical | Mini: 1 | Major: 1

### 10. Nishigandha Pagare (NP) | Total: 22 | Extra: 4 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-2 | CT | 3 | — | — | — | — | 3 |
| SE-3 | CT | 3 | — | — | — | — | 3 |
| TE-1 | CC | — | — | — | 2 | 2 | 4 |
| TE-2 | CC | — | 2 | 2 | 2 | 2 | 8 |
| BE Honors | TWSMA | 4 | — | — | — | — | 4 |
Extra: 4hrs BE Honours lecture | Mini: 1

### 11. Sayalee Susvilkar (SS) | Total: 22 | Extra: 4 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-3 | DBMS | — | — | 2 | — | — | 2 |
| SE-1 | DBMS | — | 2 | — | — | — | 2 |
| SE-2 | DBMS | — | 2 | — | — | — | 2 |
| TE-2 | DAV | 3 | 2 | 2 | 2 | 2 | 11 |
| BE ILOC | — | 3 | — | — | — | — | 3 |
| TE-Honors | Gaming AI | 2 | — | — | — | — | 2 |
Extra: 2hrs TE Honours + 2hrs SE-1 B1 DBMS practical | Mini: 1

### 12. Nivedha Raut (NKR) | Total: 20 | Extra: 2 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-1 | ML | 3 | 2 | 2 | 2 | — | 9 |
| TE-3 | ML | — | — | — | 2 | 2 | 4 |
| BE-DLOC-05 | AIFB | 3 | 2 | 2 | — | — | 7 |
Extra: 2hrs TE-3 B4 ML practical | Mini: 1

### 13. Anjali Pardeshi (AP) | Total: 21 | Extra: 3 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-2 | SEPM | 3 | 2 | 2 | 2 | — | 9 |
| TE-1 | SEPM | 3 | — | — | — | — | 3 |
| BE-DLOC-06 | SMA | 3 | 2 | 2 | 2 | — | 9 |
Extra: 3hrs TE-1 SEPM lecture | Mini: 1

### 14. Shilpa Bane (SB) | Total: 22 | Extra: 4 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | CT | 3 | — | — | — | — | 3 |
| TE-1 | ML | — | — | — | — | 2 | 2 |
| TE-2 | ML | — | 2 | — | — | 2 | 4 |
| TE-3 | ML | — | 2 | — | — | — | 2 |
| TE-3 | SEPM | 3 | 2 | 2 | 2 | 2 | 11 |
Extra: 3hrs SE-1 CT lecture + 1hr TE1 B4 ML practical | Mini: 1

### 15. Ammarah Shaikh (AS) | Total: 22 | Extra: 4 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| TE-2 | CSS | 3 | 2 | 2 | 2 | 2 | 11 |
| FE-3 | PCC | 2 | 2 | 2 | 2 | — | 8 |
| MMS | Lecture | 3 | — | — | — | — | 3 |
Extra: 3hrs MMS dept + 1hr TE2 B1 CSS practical | Mini: 1

### 16. Shital Cheke (SC) | Total: 19 | Extra: 1 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | MDM | 3 | 2 | 2 | 2 | 2 | 11 |
| FE-2 | PCC | — | — | 2 | — | — | 2 |
| FE-1 | PCC | 2 | 2 | — | 2 | — | 6 |
Extra: 1hr FE-2 B2 PCC practical | Mini: 1

### 17. Bhavika Joshi (BJ) | Total: 20 | Extra: 2 | Project: 1
| Class | Subject | Theory | B1 | B2 | B3 | B4 | Row |
|-------|---------|--------|----|----|----|----|----|
| SE-1 | OE | 2 | — | — | — | — | 2 |
| SE-2 | OE | 2 | — | — | — | — | 2 |
| TE-1 | SEPM | — | 2 | 2 | 2 | 2 | 8 |
| FE-1 | PCC | — | — | 2 | — | — | 2 |
| FE-2 | PCC | 2 | 2 | — | 2 | — | 6 |
Extra: 2hr SE-1 OE lecture | Mini: 1

## B7. Fixed / Locked Slots (Constraint C4, C7)

### Miniproject Fixed Slots
| Class | Fixed Pattern |
|-------|--------------|
| SE1 | Mon 08:15–10:15 (B4); Tue 08:15–09:15; Fri B1 slot |
| SE2 | Mon 13:30–15:30 (guided); Wed B3 slot |
| SE3 | Mon B3; Thu B2 (Maya V.); Fri B1, B2 |
| TE1 | Mon 08:15–09:15; Wed 08:15–09:15; Thu 08:15–09:15 |
| TE2 | Tue 08:15–09:15; Thu 08:15–09:15 |
| TE3 | Wed 08:15–09:15; Tue 08:15–09:15; Thu 08:15–09:15 |
| BE  | Tue–Fri morning blocks (entire guided sessions) |

### Other Fixed Slots
| Type | Classes | Pattern |
|------|---------|---------|
| Major Project | BE | Full morning blocks Tue–Fri |
| DLOC-2 DC | TE1, TE2, TE3 | Leena R. Lect-517 — multiple days, end slots |
| DLOC-2 IVP | TE1, TE2, TE3 | Janisa P. Lect-519/425 — multiple days, end slots |
| DLOC-5 (RL/AIFB) | BE | Tuesday + Friday |
| DLOC-6 (RS/SMA) | BE | Mon + Tue + Wed + Fri |
| ILOC | BE | Monday + Tuesday end slots |
| Mentor Meeting | Multiple | Flexible mode — all classes |
| Library Hour | SE2, SE3, TE1 | Supervised, various days |
| Honours | TE/BE | Wed–Thu (Nishigandha P., Neha R., Sayalee S.) |

## B8. Subjects Reference
### SE Subjects
DBMS (Database Mgmt System), OS (Operating System), MDM (Multidisciplinary Minor),
CT (Computational Theory), DT (Design Thinking), OE (Open Elective),
BDM (Business Development Model), MP (Mini Project 2B)

### TE Subjects
DAV (Data Analytics & Visualization), CSS (Cryptography & System Security),
SEPM (Software Engg & Project Mgmt), ML (Machine Learning),
CC (Compiler Construction / SBLC-CC), IVP (Image & Video Processing — DLOC-02),
DC (Distributed Computing — DLOC-02), MP (Mini Project 2B)

### BE Subjects
AAI (Advanced Artificial Intelligence), AIFB (AI for Finance & Banking — DLOC-05),
RL (Reinforcement Learning — DLOC-05), RS (Recommendation System — DLOC-06),
SMA (Social Media Analytics — DLOC-06), ILOC-2, TWSMA (BE Honours),
Gaming AI (TE/BE Honours)

## B9. Cross-Department Load (Constraint C15)
- **Load GIVEN by CSEDS to other depts: 48 hrs**
  - Maths (AM IV): SE A/B/C — 12 hrs
  - OS practicals for other depts — 11 hrs
- **Load TAKEN from other depts: 6 hrs**
  - DBMS for TE Electronics — 6 hrs (Dr. Satish Salunkhe + Sushma Rathi)
- **Total CSEDS load: 506 hrs**

---

# PART C — SYSTEM DESIGN SPECIFICATIONS

## C1. GENERATION STATE MACHINE (Constraint C2)

The timetable generation workflow is **strictly sequential** — each step must be
completed and confirmed before the next unlocks. This is enforced at both UI and API level.

```
STATE MACHINE:

  [IDLE]
     |
     | Admin: "Start New Semester Setup"
     v
  [SEMESTER_INIT]           ← Admin selects: semester, academic year, department(s)
     |
     | Admin saves semester config
     v
  [ROOMS_CONFIGURED]        ← Admin: toggles which classrooms + labs are accessible
     |                         Admin: sets batch count per class
     | Admin confirms room config
     v
  [WORKLOAD_PENDING]        ← HOD: uploads/enters faculty workload Excel
     |                         System validates: all subjects accounted for, no
     |                         faculty over max load, cross-dept faculty flagged
     | HOD submits + confirms workload
     v
  [SUBJECT_CONFIG_PENDING]  ← Coordinators: enter subject config per class
     |                         (subject type, faculty assignment, combined batch rules,
     |                          fixed slot confirmation for miniproject/DLOC/Honours)
     | All coordinators submit; HOD approves all
     v
  [READY_TO_GENERATE]       ← System shows pre-generation summary:
     |                         total slots needed vs available, conflicts flagged
     |
     | Admin / HOD: clicks "Generate"
     v
  [GENERATING]              ← Algorithm runs (non-blocking, progress shown)
     |
     | Complete
     v
  [DRAFT_GENERATED]         ← Timetable visible to Admin, HOD, Coordinators
     |                         Edit mode available to Admin + Coordinator
     |
     | HOD: "Submit for Approval"
     v
  [PENDING_APPROVAL]        ← Principal reviews master timetable
     |
     | Principal: Approve / Reject with comments
     v
  [APPROVED] / [REJECTED]
     |                         If rejected → back to [DRAFT_GENERATED]
     v
  [PUBLISHED]               ← Visible to Faculty + Students
```

**State enforcement rules:**
- API endpoint `POST /api/timetable/generate` must return 403 if current state ≠ READY_TO_GENERATE
- Store state in `SemesterConfig` MongoDB document with field `generationState: enum[above states]`
- Each state transition emits a Socket.IO event to all active users of that department

## C2. ROLE-BASED ACCESS CONTROL — COMPLETE MATRIX (Constraints C8, C10)

### Permission Definitions

```javascript
// middleware/permissions.js

const PERMISSIONS = {
  // Workload
  'workload:upload':          ['admin', 'hod'],
  'workload:view':            ['admin', 'hod', 'coordinator'],
  'workload:approve':         ['hod'],

  // Subject Configuration
  'subjectConfig:create':     ['coordinator'],        // own class only
  'subjectConfig:edit':       ['coordinator', 'admin'],
  'subjectConfig:approve':    ['hod'],

  // Room Management
  'rooms:viewAll':            ['admin', 'hod', 'coordinator'],
  'rooms:setAccessibility':   ['admin'],               // toggle which rooms usable this sem
  'rooms:setAllocation':      ['admin'],               // set per-dept room assignments
  'rooms:editLabRoom':        ['coordinator', 'admin'], // edit lab/room in a slot

  // Timetable Generation
  'timetable:generate':       ['admin', 'hod'],
  'timetable:viewMaster':     ['admin', 'hod', 'principal', 'coordinator'],
  'timetable:viewOwn':        ['faculty', 'student', 'coordinator'],

  // Timetable Editing
  'timetable:editAll':        ['admin'],               // can change subject + faculty + room
  'timetable:editLabRoom':    ['coordinator'],         // can ONLY change lab/room assignment
  'timetable:submitApproval': ['hod'],
  'timetable:approve':        ['principal'],
  'timetable:publish':        ['admin'],

  // Profile Management
  'profile:editFaculty':      ['admin'],
  'profile:editStudentBatch': ['admin', 'faculty'],   // faculty only for own class students
  'profile:viewOwn':          ['faculty', 'student', 'coordinator'],

  // Export
  'export:all':               ['admin', 'hod', 'principal'],
  'export:own':               ['faculty', 'coordinator', 'student'],
}
```

### Coordinator Edit Scope (Constraint C8)
A coordinator logged in sees the timetable editor with these **field-level restrictions**:
- **CAN change**: Room number, Lab assignment for any slot in their assigned class(es)
- **CANNOT change**: Subject, Faculty, Batch assignments, Time slot, Day
- **CAN see but not edit**: Locked slots (miniproject, major project, DLOC, Honours)
- **In the edit modal**: Subject and Faculty dropdowns are disabled/read-only; Room/Lab dropdown is enabled

### Admin Edit Scope
Admin has full edit access. No field restrictions.

### JWT Middleware Pattern
```javascript
// In every protected route:
router.put('/api/timetable/slots/:id',
  authenticate,                           // verifies JWT
  requirePermission('timetable:editAll'), // checks role
  async (req, res) => { ... }
);

// For field-level (coordinator editing only room):
router.patch('/api/timetable/slots/:id/room',
  authenticate,
  requireAnyPermission(['timetable:editAll', 'timetable:editLabRoom']),
  validateCoordinatorScope,               // if coordinator, verify class ownership
  async (req, res) => { ... }
);
```

## C3. TIMETABLE EDITOR — FULL SPEC (Feature R2)

### Component: `TimetableEditor.jsx`

```
Layout:
┌─────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Class: SE1 ▼] [View: All Batches ▼] [Undo] [Redo] [Save Draft] [Submit] │
├────────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┤
│        │08:15  │09:15  │BREAK  │10:30  │BREAK  │11:30  │BREAK  │12:30  │ ...
│        │09:15  │10:15  │10:30  │11:15  │11:30  │12:15  │12:30  │13:30  │ ...
├────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│Monday  │[cell] │[cell] │██████ │[cell] │██████ │[cell] │██████ │[cell] │ ...
│Tuesday │[cell] │[cell] │██████ │[cell] │██████ │[cell] │██████ │[cell] │ ...
│ ...    │       │       │       │       │       │       │       │       │
└────────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

### Cell Display Spec
Each non-break cell shows:
```
┌─────────────────────┐
│ DBMS          [lock]│  ← Subject code (bold) + lock icon if fixed
│ Leena R.            │  ← Faculty short name
│ 308A    [conflict!] │  ← Room number + conflict badge if clash
└─────────────────────┘
```
Color-coded left border:
- Blue `#1a73e8` = theory lecture
- Amber `#f59e0b` = practical lab
- Green `#16a34a` = fixed slot (miniproject, major project)
- Purple `#7c3aed` = DLOC / Honours / ILOC
- Orange `#ea580c` = combined batch practical

### Cell States
```
default:   white bg, thin grey border
hover:     light blue bg, darker border, cursor pointer
selected:  blue bg, white text, action toolbar appears below
conflict:  red border (2px), red badge "CLASH", red bg tint
locked:    grey bg, lock icon, dragging disabled, click shows tooltip "Fixed slot"
combined:  orange-tinted bg, "B1+B2" badge
```

### Edit Modal (opens on cell click, non-locked)
```
┌──────────────────────────────────────┐
│ Edit Slot — Monday 08:15–09:15        │
├──────────────────────────────────────┤
│ Subject: [DBMS ▼]      (disabled for coordinator) │
│ Faculty: [Leena R. ▼]  (disabled for coordinator) │
│ Room:    [308A ▼]      (enabled for all with edit) │
│ Batch:   [B1 ▼]        (disabled for coordinator) │
│ Type:    [Practical ▼] (disabled for coordinator) │
├──────────────────────────────────────┤
│ ⚠ Conflict: Leena R. also in 517 at this time     │
├──────────────────────────────────────┤
│             [Cancel]    [Save]        │
└──────────────────────────────────────┘
```

### Drag and Drop
- Use `@dnd-kit/core` or `react-beautiful-dnd`
- On drag start: highlight valid drop targets (empty slots or swappable occupied slots)
- On drag over occupied slot: show swap preview
- On drop: check conflicts → if clean, commit; if conflict, show modal asking "override?" or "cancel"
- Break columns are never valid drop targets

### Undo/Redo
- Store last 10 edit states in `useReducer` + history array
- `Ctrl+Z` / `Ctrl+Y` keyboard shortcuts
- Undo/Redo buttons in toolbar with count badge (e.g. "Undo (3)")

### Conflict Detection (real-time, via Socket.IO)
When user moves/edits a slot:
1. Frontend sends `check-conflict` Socket.IO event with `{facultyId, roomId, day, timeSlot, excludeSlotId}`
2. Server queries all slots at that time for that faculty + room
3. Server emits back `conflict-result: { hasConflict, type, details }`
4. Frontend highlights affected cells immediately

## C4. ADMIN ROOM ALLOCATION PANEL (Constraint C9)

### Component: `RoomAllocationAdmin.jsx`

Located at: `/admin/rooms/allocate`

```
Layout:
┌──────────────────────────────────────────────────────────────┐
│ Room Allocation — Even Semester 2025-26                        │
│ Department: [CSEDS ▼]  Semester: [Even 2025-26 ▼]            │
├───────────────────┬──────────────┬───────────┬───────────────┤
│ Room              │ Type         │ Accessible│ Shared With   │
├───────────────────┼──────────────┼───────────┼───────────────┤
│ 517               │ Classroom    │ [ON  ●]   │ —             │
│ 519               │ Classroom    │ [ON  ●]   │ —             │
│ 520               │ Classroom    │ [ON  ●]   │ —             │
│ 425               │ Classroom    │ [ON  ●]   │ AIDS (50%)    │
│ 308A              │ Lab          │ [ON  ●]   │ —             │
│ 308B              │ Lab          │ [ON  ●]   │ —             │
│ 308C              │ Lab          │ [ON  ●]   │ —             │
│ 308D              │ Lab          │ [ON  ●]   │ —             │
│ 115-C             │ Lab          │ [OFF ○]   │ —             │ ← greyed out, not available
│ 115-D             │ Lab          │ [OFF ○]   │ —             │
│ 220               │ Lab          │ [ON  ●]   │ —             │
│ 221               │ Lab          │ [ON  ●]   │ —             │
│ 222               │ Lab          │ [ON  ●]   │ —             │
│ 12 (211)          │ Lab          │ [ON  ●]   │ —             │
│ 7/208             │ Lab          │ [ON  ●]   │ —             │
│ 8/208             │ Lab          │ [ON  ●]   │ —             │
├───────────────────┴──────────────┴───────────┴───────────────┤
│ CSEDS Classroom Summary:                                       │
│ Full classrooms: 3  |  Shared classrooms: 0.5  |  Total: 3.5 │
│                                            [Save Allocation]  │
└──────────────────────────────────────────────────────────────┘
```

**Business rules:**
- Admin can toggle ON/OFF any room. OFF rooms are excluded from generation.
- For shared rooms (425): Admin sets sharing percentage per department.
- The 3.5 classroom count auto-calculates: sum(full classrooms) + sum(shared rooms × share%)
- If total classrooms < minimum needed (based on classes × simultaneous sessions), show warning.
- Changes saved to `RoomAllocation` collection keyed by `{deptId, semesterId}`.

## C5. PROFILE MANAGEMENT (Feature R4)

### Faculty Profile Editor — Admin Access
Route: `/admin/faculty/:id/edit`

```
Fields editable by Admin:
  - Full Name (text)
  - Short Code / Abbreviation (text, max 5 chars)
  - Designation (dropdown: Professor / Associate Professor / Assistant Professor / HOD)
  - Department (multi-select: CSEDS, AIDS, Mech, etc.)  ← cross-dept flag
  - Email (text, validated)
  - Phone (text)
  - Max Theory Hours/Week (number, set by HOD via workload)
  - Max Practical Hours/Week (number)
  - Subjects Can Teach (multi-select from Subject master)
  - Is Cross-Department: (toggle) — if ON, appears in cross-dept faculty picker
  - Unavailability: Add date ranges when faculty is not available (e.g. conference, leave)
    Format: { from: Date, to: Date, reason: string }
```

**MongoDB `Faculty` schema additions:**
```javascript
{
  ...existing,
  shortCode: String,          // e.g. "SSS", "YP", "NMR"
  departments: [ObjectId],    // array — supports cross-dept
  subjectIds: [ObjectId],     // subjects this faculty can teach
  isCrossDept: Boolean,
  unavailability: [{
    from: Date,
    to: Date,
    reason: String
  }],
  maxTheoryHours: Number,
  maxPracticalHours: Number
}
```

### Student Profile Editor — Faculty Access (own class only)
Route: `/faculty/students/:classId`

```
Faculty can view and edit:
  - Student name (read-only)
  - Roll number (read-only)
  - Class (read-only)
  - Practical Batch Assignment: [B1 ▼] [B2 ▼] [B3 ▼] [B4 ▼]  ← editable
  - DLOC/ILOC group assignment (if applicable)

Faculty CANNOT edit:
  - Student email, phone, parent info
  - Academic records
  - Attendance
```

**Constraint:** Faculty can only access students belonging to classes where they are assigned as Class Coordinator. Enforced via middleware:
```javascript
async function validateClassCoordinator(req, res, next) {
  const { classId } = req.params;
  const faculty = await Faculty.findById(req.user.id);
  const isCoord = await Class.exists({ _id: classId, coordinatorId: faculty._id });
  if (!isCoord) return res.status(403).json({ error: 'Not coordinator of this class' });
  next();
}
```

## C6. SUBJECT CONFIGURATION PANEL — FULL SPEC (Feature R3)

### Component: `SubjectConfigPanel.jsx`

Route: `/coordinator/subjects/:classId`

Coordinator sees only their assigned class(es).

```
Header:
  Class: SE1  |  Semester: Even 2025-26  |  Department: CSEDS
  Status: [DRAFT]  [HOD: Pending Approval]
  Hours used: 18 / 22 allocated  ████████░░  ← progress bar

Subject List (table):
┌──────┬──────────┬──────────┬────────┬────────┬────────────────┬──────────┬──────┐
│ Code │ Name     │ Type     │ Lect/wk│ Prac/wk│ Faculty        │ Combined │ Fixed│
├──────┼──────────┼──────────┼────────┼────────┼────────────────┼──────────┼──────┤
│ DBMS │ Database │ Practical│ 3      │ B1:2.. │ Leena R. ▼     │ No       │ —    │
│ OS   │ Oper Sys │ Practical│ 3      │ B2:2.. │ Neha R. ▼      │ No       │ —    │
│ CC   │ Compiler │ Practical│ 0      │ B1+B2..│ Sejal D. ▼     │ YES B1+B2│ —    │
│ MP   │ Mini Proj│ Project  │ 0      │ —      │ As per guide   │ No       │ FIXED│
└──────┴──────────┴──────────┴────────┴────────┴────────────────┴──────────┴──────┘
                                                      [+ Add Subject]

[Submit to HOD]  (disabled until all required subjects filled)
```

### Add/Edit Subject Modal
```
Subject Code: [DBMS]
Subject Name: [Database Management System]
Type: [Practical ▼]  (Theory / Practical / Project / OE / DLOC / ILOC / Honours)
Theory Hours/week: [3]
Practical Config:
  Batch 1: Faculty [Sayalee S. ▼]  Lab [308A ▼]  Hours [2]
  Batch 2: Faculty [Leena R. ▼]    Lab [308A ▼]  Hours [2]
  Batch 3: Faculty [Leena R. ▼]    Lab [308D ▼]  Hours [2]
  Batch 4: Faculty [Dr.Satish S. ▼] Lab [115D ▼] Hours [2]

Combined Batches: [No ▼]
  If YES → merge options: [B1+B2] or [B3+B4] or [B1+B2 AND B3+B4]

Fixed Slot: [No ▼]
  If YES → Day: [Monday ▼]  Time: [08:15-10:15 ▼]  Room: [308A ▼]

DLOC/Honours/ILOC: [No ▼]
  If YES → auto-locked, pre-fills fixed slot

Cross-dept faculty: [Search faculty from other depts...]
```

### Validation rules:
- Total hours entered must match HOD's allocated workload for each faculty
- If hours exceed allocation → show red warning, block submission
- If a fixed slot conflicts with another already-fixed slot → show error immediately
- Combined batch subjects: must assign different faculty or same faculty + verify single lab can accommodate

## C7. INDIVIDUAL TIMETABLE DERIVATION (Constraint C11)

From the single `TimetableSlot` collection, derive all views on the fly:

### API endpoints (all GET, derived from master):
```
GET /api/timetable/class/:classId          → filter by class + sort by day + time
GET /api/timetable/faculty/:facultyId      → filter by facultyId across all classes
GET /api/timetable/room/:roomId            → filter by roomId
GET /api/timetable/lab/:labId             → filter by roomId (labs are rooms type=lab)
GET /api/timetable/student/:studentId     → filter by class + student's batch assignment
```

### Student timetable logic:
```javascript
async function getStudentTimetable(studentId) {
  const student = await Student.findById(studentId).populate('classId');
  const { classId, batch } = student;

  const slots = await TimetableSlot.find({
    classId,
    $or: [
      { batch: batch },           // their specific batch
      { batch: null },            // theory lectures (no batch filter)
      { isClasswide: true }       // DT classwise practical etc
    ]
  }).sort({ day: 1, startTime: 1 });

  return slots;
}
```

### View types and their sheets in Excel export:
| View | Sheet Name Pattern | Filter |
|------|--------------------|--------|
| Class timetable | `SE1`, `SE2`, `TE1` etc. | by classId |
| Faculty timetable | `Faculty_SSS`, `Faculty_YP` etc. | by facultyId |
| Classroom timetable | `517`, `519`, `520` etc. | by roomId, type=classroom |
| Lab timetable | `308A`, `308D`, `221` etc. | by roomId, type=lab |
| Student timetable | Generated on demand | by classId + batch |
| Master (all classes) | `CSE(DS) (even)` | all classes combined |

## C8. EXCEL EXPORT — EXACT FORMAT SPEC (Feature R5)

Match the existing `MasterCopy_2025-26_even_drive.xlsx` format exactly.

### Sheet structure (multi-sheet workbook)
One workbook contains sheets in this order:
1. `AIDS` — AIDS dept master
2. `CSE(DS) (even)` — CSEDS dept master (all classes, all days)
3. `SE1` through `BE` — individual class sheets
4. `517`, `519`, `520`, `425` — classroom-wise sheets
5. `308A`, `308B`, `308C`, `308D`, `115-C`, `115-D`, `220`, `221`, `222` etc. — lab sheets

### Cell format per timetable sheet (exact column layout):
```
Row 1: College name — merged A1:M1, center, bold, 14pt
Row 2: Department name — merged A2:M2, center, bold, 12pt
Row 3: Academic year — merged A3:M3, center, 11pt
Row 4: "Timetable Effective From: [date]" — merged A4:M4, center
Row 5: "Term from: [date] to [date]" — merged A5:M5, center
Row 6: Class name left (A6) + Coordinator name right (M6), 10pt bold

Row 7 (column headers):
  A: Day/Time
  B: 08:15-09:15    (col width 22)
  C: 09:15-10:15    (col width 22)
  D: BREAK          (col width 8, grey fill #e0e0e0)
  E: 10:30-11:15    (col width 20)
  F: BREAK          (col width 8, grey fill)
  G: 11:30-12:15    (col width 20)
  H: BREAK          (col width 8, grey fill)
  I: 12:30-13:30    (col width 22)
  J: 13:30-14:30    (col width 22)
  K: 14:30-15:30    (col width 22)
  L: 15:30-16:30    (col width 22)
  M: 16:30-17:30    (col width 22)

Data rows (one row per day):
  A: Day name (Monday, Tuesday, etc.) — bold, vertical center
  B–M: Cell content (wrapped text, vertical center, center horizontal)

Cell content format (multi-line using \n):
  Theory slot:   "DBMS (Leena R.)\nLect-517"
  Prac slot:     "B1 DBMS(SS) 308A\nB2 OS(NR) lab 222\nB3 MDM(SC) lab 220\nB4 MP(NKR) 308B"
  Fixed slot:    "Miniproject (Guided)\n- *as per guide"
  Empty:         ""
  Break:         "BREAK" — grey fill, no text
```

### Cell color coding (fill colors):
| Slot Type | Fill Color |
|-----------|-----------|
| Theory lecture | `#EBF3FB` (light blue) |
| Practical / Lab | `#FFFBEB` (light yellow) |
| Miniproject | `#E8F5E9` (light green) |
| Major Project | `#E8F5E9` (light green) |
| DLOC / Honours / ILOC | `#F3E5F5` (light purple) |
| Combined batch | `#FFF3E0` (light orange) |
| Break | `#E0E0E0` (grey) |
| Empty | White |

### Borders and formatting:
- All data cells: `thin` border on all sides using `openpyxl` border style
- Header row (row 7): Bold, teal fill `#1E6F7E`, white text
- Row height: minimum 45pt for data rows, auto-fit if content exceeds
- Freeze panes: row 7 + column A frozen

### PDF Export:
- Paper: A3 Landscape
- Same colour coding
- Each sheet → one page (scale to fit if needed)
- Header repeated on every page
- Generate individual PDFs (one per class, faculty, room) or a combined bookmarked PDF

## C9. RESPONSIVENESS SPEC (Feature R7)

### Breakpoints
```css
/* Mobile first */
--bp-mobile:  < 640px
--bp-tablet:  640px – 1024px
--bp-desktop: > 1024px
```

### Layout rules per breakpoint

**Desktop (> 1024px):**
- Sidebar: 240px wide, always visible, expanded
- Timetable grid: full week visible, all 9 slots across
- Master timetable: scrollable horizontal table showing all classes

**Tablet (640px – 1024px):**
- Sidebar: collapses to icon-only rail (56px wide), hover to expand
- Timetable grid: horizontal scroll enabled, day labels sticky left
- Workload cards: 2-column grid instead of 4

**Mobile (< 640px):**
- Sidebar: hidden, accessible via hamburger menu → full-screen overlay
- Timetable: **card view** — one day at a time, swipe left/right to change day
  ```
  ┌─────────────────────┐
  │ ◀ Monday ▶          │  ← day navigation
  ├─────────────────────┤
  │ 08:15  DBMS         │
  │        Leena R.  308A│
  ├─────────────────────┤
  │ 09:15  OS           │
  │        Neha R.   424 │
  ├─────────────────────┤
  │ 10:15  ─ BREAK ─    │
  │ ...                 │
  └─────────────────────┘
  ```
- Bottom navigation bar replaces sidebar:
  `[Dashboard] [My TT] [Workload] [Reports] [More]`
- Export button: opens bottom sheet instead of modal

### CSS approach:
Use CSS Grid + CSS custom properties. No extra library required.
```css
/* Timetable grid — responsive */
.timetable-grid {
  display: grid;
  grid-template-columns: 80px repeat(9, minmax(120px, 1fr)) repeat(3, 50px);
  /* 9 teaching slots + 3 break slots */
  overflow-x: auto;
}

@media (max-width: 640px) {
  .timetable-grid { display: none; }
  .timetable-cards { display: flex; flex-direction: column; gap: 8px; }
  .sidebar { display: none; }
  .bottom-nav { display: flex; }
}
```

---

# PART D — COMPLETE DATABASE SCHEMAS

```javascript
// ── SemesterConfig ────────────────────────────────────────────────────────
const SemesterConfigSchema = new Schema({
  semester: { type: String, enum: ['odd', 'even'], required: true },
  academicYear: { type: String, required: true },         // e.g. "2025-26"
  departments: [{ type: ObjectId, ref: 'Department' }],
  generationState: {
    type: String,
    enum: ['idle', 'semester_init', 'rooms_configured', 'workload_pending',
           'subject_config_pending', 'ready_to_generate', 'generating',
           'draft_generated', 'pending_approval', 'approved', 'rejected', 'published'],
    default: 'idle'
  },
  stateHistory: [{
    state: String,
    changedBy: { type: ObjectId, ref: 'User' },
    changedAt: Date,
    note: String
  }],
  effectiveFrom: Date,
  termEndDate: Date,
  createdBy: { type: ObjectId, ref: 'User' }
}, { timestamps: true });

// ── RoomAllocation ────────────────────────────────────────────────────────
const RoomAllocationSchema = new Schema({
  semesterId: { type: ObjectId, ref: 'SemesterConfig', required: true },
  departmentId: { type: ObjectId, ref: 'Department', required: true },
  rooms: [{
    roomId: { type: ObjectId, ref: 'Room' },
    isAccessible: { type: Boolean, default: true },
    sharingPercentage: { type: Number, default: 100 }, // 100 = full, 50 = shared
    sharedWithDeptId: { type: ObjectId, ref: 'Department' }
  }],
  batchConfig: [{
    classId: { type: ObjectId, ref: 'Class' },
    batchCount: { type: Number, default: 4 },          // 3 for BE, 4 for SE/TE
    batchLabels: [String]                              // ["B1","B2","B3","B4"]
  }]
});

// ── Room ─────────────────────────────────────────────────────────────────
const RoomSchema = new Schema({
  roomNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['classroom', 'lab'], required: true },
  capacity: Number,
  building: String,
  floor: String,
  department: { type: ObjectId, ref: 'Department' },
  isShared: { type: Boolean, default: false },
  sharedWith: [{ deptId: ObjectId, percentage: Number }],
  unavailableDates: [{ from: Date, to: Date, reason: String }]
});

// ── Faculty ───────────────────────────────────────────────────────────────
const FacultySchema = new Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  shortCode: { type: String, maxlength: 5 },           // "SSS", "YP"
  designation: {
    type: String,
    enum: ['Professor', 'Associate Professor', 'Assistant Professor', 'HOD', 'Adjunct']
  },
  departments: [{ type: ObjectId, ref: 'Department' }], // supports cross-dept
  subjectIds: [{ type: ObjectId, ref: 'Subject' }],
  isCrossDept: { type: Boolean, default: false },
  unavailability: [{ from: Date, to: Date, reason: String }],
  maxTheoryHours: Number,
  maxPracticalHours: Number,
  phone: String,
  email: String
});

// ── FacultyWorkload ───────────────────────────────────────────────────────
const FacultyWorkloadSchema = new Schema({
  facultyId: { type: ObjectId, ref: 'Faculty', required: true },
  semesterId: { type: ObjectId, ref: 'SemesterConfig', required: true },
  allocations: [{
    classId: { type: ObjectId, ref: 'Class' },
    subjectId: { type: ObjectId, ref: 'Subject' },
    theoryLoad: { type: Number, default: 0 },
    practicalLoad: {
      batch1: { type: Number, default: 0 },
      batch2: { type: Number, default: 0 },
      batch3: { type: Number, default: 0 },
      batch4: { type: Number, default: 0 }
    },
    totalLoad: Number,
    extraLoad: { type: Number, default: 0 },
    extraLoadDescription: String,
    majorProjectLoad: { type: Number, default: 0 },
    miniProjectLoad: { type: Number, default: 0 }
  }],
  totalTeachingLoad: Number,
  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' },
  approvedBy: { type: ObjectId, ref: 'User' },
  approvedAt: Date
});

// ── Student ───────────────────────────────────────────────────────────────
const StudentSchema = new Schema({
  userId: { type: ObjectId, ref: 'User' },
  fullName: { type: String, required: true },
  rollNumber: { type: String, unique: true },
  classId: { type: ObjectId, ref: 'Class', required: true },
  batch: { type: String, enum: ['B1', 'B2', 'B3', 'B4'] },
  dlocGroup: String,
  ilocGroup: String,
  email: String
});

// ── SubjectAllocation ─────────────────────────────────────────────────────
const SubjectAllocationSchema = new Schema({
  semesterId: { type: ObjectId, ref: 'SemesterConfig', required: true },
  departmentId: { type: ObjectId, ref: 'Department', required: true },
  classId: { type: ObjectId, ref: 'Class', required: true },
  subject: {
    code: String,
    name: String,
    type: {
      type: String,
      enum: ['theory', 'practical', 'project', 'OE', 'DLOC', 'ILOC', 'honours', 'combined']
    }
  },
  theoryHours: Number,
  theoryFacultyId: { type: ObjectId, ref: 'Faculty' },
  theoryRoomId: { type: ObjectId, ref: 'Room' },
  batches: [{
    batchLabel: String,           // "B1", "B2", "B3", "B4"
    facultyId: { type: ObjectId, ref: 'Faculty' },
    labId: { type: ObjectId, ref: 'Room' },
    hours: Number
  }],
  isCombinedBatch: { type: Boolean, default: false },
  combinedGroups: [{
    batches: [String],            // ["B1","B2"] or ["B3","B4"]
    facultyId: { type: ObjectId, ref: 'Faculty' },
    labId: { type: ObjectId, ref: 'Room' }
  }],
  fixedSlots: [{
    day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
    startTime: String,
    endTime: String,
    roomId: { type: ObjectId, ref: 'Room' },
    isLocked: { type: Boolean, default: true }
  }],
  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' }
});

// ── TimetableSlot ─────────────────────────────────────────────────────────
const TimetableSlotSchema = new Schema({
  masterTimetableId: { type: ObjectId, ref: 'MasterTimetable', required: true },
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
  startTime: { type: String, required: true },          // "08:15"
  endTime: { type: String, required: true },            // "09:15"
  classId: { type: ObjectId, ref: 'Class' },
  batch: String,                                        // null = applies to all batches (theory)
  subjectId: { type: ObjectId, ref: 'Subject' },
  facultyId: { type: ObjectId, ref: 'Faculty' },
  roomId: { type: ObjectId, ref: 'Room' },
  slotType: {
    type: String,
    enum: ['theory','practical','break','miniproject','majorproject',
           'honours','DLOC','ILOC','mentor','library','combined']
  },
  isLocked: { type: Boolean, default: false },
  isClasswide: { type: Boolean, default: false },       // DT classwise practical
  combinedBatches: [String],                            // ["B1","B2"] for combined
  combinedFacultyId: { type: ObjectId, ref: 'Faculty' },// alternate faculty for B3+B4
  combinedRoomId: { type: ObjectId, ref: 'Room' },
  note: String
});

// Index for fast conflict checks
TimetableSlotSchema.index({ masterTimetableId: 1, day: 1, startTime: 1, facultyId: 1 });
TimetableSlotSchema.index({ masterTimetableId: 1, day: 1, startTime: 1, roomId: 1 });
TimetableSlotSchema.index({ masterTimetableId: 1, classId: 1, batch: 1 });
```

---

# PART E — COMPLETE API ENDPOINTS

```
── Semester Setup ──────────────────────────────────────────────────────────
POST   /api/semester                       create semester config
PUT    /api/semester/:id/state             advance generation state
GET    /api/semester/:id                   get config + current state

── Room Allocation (Admin) ──────────────────────────────────────────────────
GET    /api/rooms                          list all rooms
PUT    /api/rooms/:id/accessibility        toggle room on/off for semester
POST   /api/rooms/allocate                 set dept-level room allocation + batch config
GET    /api/rooms/allocation/:deptId/:semId get current allocation

── Workload (HOD) ───────────────────────────────────────────────────────────
POST   /api/workload/upload-excel          parse HOD Excel, create FacultyWorkload docs
GET    /api/workload/:deptId/:semId        get workload summary
PUT    /api/workload/:id/submit            HOD submits workload
PUT    /api/workload/:id/approve           HOD final-approves

── Subject Configuration (Coordinator) ──────────────────────────────────────
POST   /api/subject-config                 create/update subject config for a class
GET    /api/subject-config/:classId/:semId get subject config
PUT    /api/subject-config/:id/submit      coordinator submits to HOD
PUT    /api/subject-config/:id/approve     HOD approves

── Timetable Generation ──────────────────────────────────────────────────────
POST   /api/timetable/generate             trigger generation (must be READY_TO_GENERATE)
GET    /api/timetable/status/:semId        poll generation progress

── Timetable Read ───────────────────────────────────────────────────────────
GET    /api/timetable/master/:deptId/:semId         full master timetable
GET    /api/timetable/class/:classId/:semId         class timetable
GET    /api/timetable/faculty/:facultyId/:semId     faculty timetable
GET    /api/timetable/room/:roomId/:semId           room/classroom timetable
GET    /api/timetable/lab/:labId/:semId             lab timetable
GET    /api/timetable/student/:studentId/:semId     student timetable (uses batch)

── Timetable Edit ───────────────────────────────────────────────────────────
POST   /api/timetable/slots                         create a slot (admin)
PUT    /api/timetable/slots/:id                     full edit (admin only)
PATCH  /api/timetable/slots/:id/room                edit room only (coordinator + admin)
DELETE /api/timetable/slots/:id                     delete slot (admin only)
POST   /api/timetable/slots/check-conflict          check if slot causes conflict

── Approval Workflow ────────────────────────────────────────────────────────
PUT    /api/timetable/:masterId/submit              HOD submits for principal review
PUT    /api/timetable/:masterId/approve             principal approves
PUT    /api/timetable/:masterId/reject              principal rejects with reason
PUT    /api/timetable/:masterId/publish             admin publishes (post-approval)

── Export ───────────────────────────────────────────────────────────────────
GET    /api/export/excel/:masterId?view=master|class|faculty|room|student
GET    /api/export/pdf/:masterId?view=master|class|faculty|room|student&id=...

── Profile Management ───────────────────────────────────────────────────────
GET    /api/faculty                                 list faculty (admin/hod)
PUT    /api/faculty/:id                             edit faculty profile (admin)
GET    /api/students/:classId                       list students in class (faculty/admin)
PUT    /api/students/:id/batch                      update student batch (faculty/admin)
```

---

# PART F — GENERATION ALGORITHM SPEC

```javascript
// server/services/timetableGenerator.js

async function generateTimetable(semesterId) {

  // PHASE 1: Load all constraints
  const config     = await SemesterConfig.findById(semesterId);
  const rooms      = await RoomAllocation.getAccessible(semesterId);
  const workloads  = await FacultyWorkload.find({ semesterId, status: 'approved' });
  const subjects   = await SubjectAllocation.find({ semesterId, status: 'approved' });

  // PHASE 2: Pre-seed all fixed/locked slots (DO NOT OVERWRITE THESE)
  const fixedSlots = extractFixedSlots(subjects);
  // Fixed types: miniproject, majorproject, DLOC, ILOC, Honours, Mentor, Library
  const matrix = buildEmptyMatrix();   // day × timeSlot × class
  fixedSlots.forEach(slot => lockSlot(matrix, slot));

  // PHASE 3: Build scheduling requirements
  // For each faculty × class × subject → list of sessions needed
  const requirements = buildRequirements(workloads, subjects);
  // e.g. { faculty: SSS, class: SE2, subject: DBMS, type: theory, count: 3/week }
  // e.g. { faculty: LR, class: SE1, subject: DBMS, type: practical, batch: B2, count: 2/week }

  // PHASE 4: Sort requirements by constraint tightness
  // Most constrained first:
  // 1. Combined batch practicals (CC) — need 2 simultaneous labs
  // 2. Cross-dept faculty (limited availability windows)
  // 3. Faculty with highest total load
  // 4. Theory lectures (need classrooms)
  // 5. Standard practicals (need labs)
  requirements.sort(byConstraintTightness);

  // PHASE 5: Greedy assignment with backtracking
  for (const req of requirements) {
    const validSlots = findValidSlots(matrix, req, rooms);

    if (validSlots.length === 0) {
      // Backtrack: unassign last non-locked slot and retry
      backtrack(matrix, req);
      continue;
    }

    // Prefer slots that balance faculty load across week
    const best = selectBestSlot(validSlots, req);
    assignSlot(matrix, best, req);
  }

  // PHASE 6: Validate completeness
  const unscheduled = requirements.filter(r => !r.scheduled);
  if (unscheduled.length > 0) {
    emit('generation-warning', { unscheduled });
  }

  // PHASE 7: Save to TimetableSlot collection
  await saveTimetableSlots(matrix, semesterId);
  await SemesterConfig.updateState(semesterId, 'draft_generated');
  emit('generation-complete', { semesterId });
}

// Conflict check rules:
function isSlotValid(matrix, slot, req) {
  const { day, time } = slot;
  return (
    !isFacultyBusy(matrix, req.facultyId, day, time) &&
    !isRoomBusy(matrix, req.roomId, day, time) &&
    !isClassBusy(matrix, req.classId, day, time) &&
    !isBreakSlot(time) &&
    !isLockedSlot(matrix, req.classId, day, time) &&
    isRoomAccessible(req.roomId) &&
    isWithinClassroomLimit(req.roomId, req.classId) &&  // 3.5 classroom rule
    isCrossDeptFacultyAvailable(req.facultyId, day, time)  // check other dept TT
  );
}
```

---

# PART G — SOCKET.IO EVENTS

```javascript
// Events emitted by server:

'semester-state-changed'    payload: { semesterId, newState, changedBy }
'generation-progress'       payload: { semesterId, percent, message }
'generation-complete'       payload: { semesterId }
'generation-warning'        payload: { semesterId, unscheduled: [...] }
'slot-updated'              payload: { slotId, updatedBy, changes }
'conflict-detected'         payload: { slotId, conflictType, conflictWith }
'conflict-result'           payload: { hasConflict, type, details }
'approval-requested'        payload: { masterId, requestedBy }
'timetable-approved'        payload: { masterId, approvedBy }
'timetable-published'       payload: { masterId }

// Events listened to by server:
'join-semester'             payload: { semesterId }  → join room for semester updates
'join-department'           payload: { deptId }      → join dept room
'check-conflict'            payload: { facultyId, roomId, day, timeSlot, excludeSlotId }
```

---

# PART H — REACT COMPONENT LIST

Build all of the following components:

```
/client/src/pages/
  SemesterSetup.jsx           — Admin: create semester, advance state machine
  RoomAllocationAdmin.jsx     — Admin: toggle rooms, set allocations, batch counts
  WorkloadUpload.jsx          — HOD: upload Excel + review/edit workload table
  SubjectConfigPanel.jsx      — Coordinator: add subjects, assign faculty+lab, mark combined/fixed
  TimetableEditor.jsx         — Admin+Coordinator: interactive drag-drop editor
  MasterTimetableView.jsx     — All roles: read-only master with filters
  IndividualTimetable.jsx     — Faculty/Student: own timetable view
  ApprovalDashboard.jsx       — Principal: review and approve/reject
  ExportCenter.jsx            — All: choose export format and scope
  FacultyProfileEditor.jsx    — Admin: edit faculty profiles
  StudentBatchManager.jsx     — Faculty: manage student batch assignments
  WorkloadDashboard.jsx       — HOD+Faculty: workload progress bars

/client/src/components/
  TimetableGrid.jsx           — Reusable grid (used in editor + view)
  TimetableCell.jsx           — Individual cell with all states
  SlotEditModal.jsx           — Edit modal (role-aware field disabling)
  ConflictBadge.jsx           — Red conflict indicator
  WorkloadBar.jsx             — Progress bar for faculty load
  StateTracker.jsx            — Visual state machine progress indicator
  RoomToggle.jsx              — ON/OFF toggle for room accessibility
  BatchSelector.jsx           — Batch filter (B1/B2/B3/B4/All)
  ExportModal.jsx             — Export format and scope picker
  MobileCalendarCard.jsx      — Mobile day-view card for timetable
  BottomNavBar.jsx            — Mobile bottom navigation
```

---

# PART I — DELIVERABLES CHECKLIST

Gemini must produce ALL of the following:

**Backend:**
- [ ] All MongoDB schemas (Part D) — complete, with indexes
- [ ] All API routes + controllers (Part E)
- [ ] Generation algorithm (Part F) — `timetableGenerator.js`
- [ ] State machine enforcement middleware
- [ ] Role-based permission middleware (Part C2)
- [ ] Excel workload parser (reads HOD's exact Excel format from Part B6)
- [ ] Socket.IO event handlers (Part G)
- [ ] Excel export service (multi-sheet, exact format from Part C8)
- [ ] PDF export service (A3 landscape, colour-coded)
- [ ] Student timetable derivation service (Part C7)

**Frontend:**
- [ ] All React components listed in Part H
- [ ] TimetableEditor with drag-drop + conflict detection
- [ ] Role-aware edit modal (field disabling per role)
- [ ] State machine UI (SemesterSetup page)
- [ ] Room allocation admin panel (Part C4)
- [ ] Subject config panel (Part C6)
- [ ] Faculty profile editor + student batch manager (Part C5)
- [ ] Mobile responsive layout — card view + bottom nav (Part C9)
- [ ] Responsive CSS using CSS Grid + custom properties

**Code quality:**
- All code must be modular, production-ready
- Follow existing project folder structure
- No hardcoded values — all config via env or DB
- Real-time updates via Socket.IO for editor conflicts and state changes

---

*End of complete prompt. Covers all 7 features (R1–R7) and all 15 constraints (C1–C15).*
