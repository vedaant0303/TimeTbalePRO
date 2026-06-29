require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  let out = '=== DATABASE: timetable_management ===\n';
  out += '=== MongoDB URL: ' + process.env.MONGODB_URI + ' ===\n\n';

  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const count = await db.collection(c.name).countDocuments();
    out += c.name + ': ' + count + ' documents\n';
  }

  out += '\n--- ALL USERS (Main Collection) ---\n';
  const users = await db.collection('users').find({}).toArray();
  if (users.length === 0) {
    out += '  (No users registered yet — register via login page with Google verification)\n';
  }
  users.forEach(u => {
    out += '  [' + u.role + '] ' + u.name + ' - ' + u.email + ' | Google Verified: ' + (u.googleVerified ? 'YES' : 'NO') + '\n';
  });

  out += '\n--- STUDENTS (Separate Collection) ---\n';
  const students = await db.collection('students').find({}).toArray();
  if (students.length === 0) out += '  (No students registered yet)\n';
  students.forEach(s => {
    out += '  ' + s.name + ' - ' + s.email + ' | Sem: ' + (s.semester || '-') + ' | Div: ' + (s.division || '-') + '\n';
  });

  out += '\n--- FACULTY (Separate Collection) ---\n';
  const faculty = await db.collection('faculties').find({}).toArray();
  if (faculty.length === 0) out += '  (No faculty registered yet)\n';
  faculty.forEach(f => {
    out += '  ' + f.name + ' - ' + f.email + ' | ID: ' + (f.employeeId || '-') + '\n';
  });

  out += '\n--- PRINCIPALS (Separate Collection) ---\n';
  const principals = await db.collection('principals').find({}).toArray();
  if (principals.length === 0) out += '  (No principals registered yet)\n';
  principals.forEach(p => {
    out += '  ' + p.name + ' - ' + p.email + '\n';
  });

  out += '\n--- DEPARTMENTS ---\n';
  const depts = await db.collection('departments').find({}).toArray();
  depts.forEach(d => {
    out += '  ' + d.code + ' - ' + d.name + ' (Divisions: ' + (d.divisions || []).join(', ') + ')\n';
  });

  out += '\n--- ROOMS ---\n';
  const rooms = await db.collection('rooms').find({}).toArray();
  rooms.forEach(r => {
    out += '  ' + r.code + ' - ' + r.name + ' (' + r.type + ', capacity: ' + r.capacity + ')\n';
  });

  out += '\n--- SUBJECTS ---\n';
  const subs = await db.collection('subjects').find({}).toArray();
  subs.forEach(s => {
    out += '  ' + s.code + ' - ' + s.name + ' (Sem ' + s.semester + ', ' + s.credits + ' credits, ' + s.type + ')\n';
  });

  out += '\n--- TIME SLOTS ---\n';
  const slots = await db.collection('timeslots').find({}).sort({ slotNumber: 1 }).toArray();
  slots.forEach(s => {
    out += '  Slot ' + s.slotNumber + ': ' + s.startTime + ' - ' + s.endTime + (s.isBreak ? ' [' + s.breakType + ' BREAK]' : '') + '\n';
  });

  out += '\n--- ACADEMIC CALENDAR ---\n';
  const cal = await db.collection('academiccalendars').findOne({ isActive: true });
  if (cal) {
    out += '  Academic Year: ' + cal.academicYear + ' | Active: ' + cal.isActive + '\n';
    cal.semesters.forEach(s => {
      out += '  Semester: ' + s.name + ' (' + s.startDate.toISOString().split('T')[0] + ' to ' + s.endDate.toISOString().split('T')[0] + ')\n';
    });
    out += '  Holidays (' + cal.holidays.length + '):\n';
    cal.holidays.forEach(h => {
      out += '    - ' + h.name + ' (' + h.date.toISOString().split('T')[0] + ', ' + h.type + ')\n';
    });
  }

  fs.writeFileSync('db-snapshot.txt', out);
  console.log('Done! View db-snapshot.txt');
  await mongoose.disconnect();
});
