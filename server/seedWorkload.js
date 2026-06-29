/**
 * Seed faculty workload from the teaching_workload_even_sem_2025-26.md
 * This seeds CSE-DS Even Semester workload data into FacultyWorkload collection
 * AND links faculty to subjects in the Subject collection
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Faculty = require('./models/Faculty');
const Department = require('./models/Department');
const Subject = require('./models/Subject');
const Class = require('./models/Class');
const SemesterConfig = require('./models/SemesterConfig');
const FacultyWorkload = require('./models/FacultyWorkload');

async function seedWorkload() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get departments
    const csedsDept = await Department.findOne({ code: 'CSE-DS' });
    const ceDept = await Department.findOne({ code: 'CE' });
    if (!csedsDept) { console.error('CSE-DS department not found!'); process.exit(1); }
    if (!ceDept) { console.error('CE department not found!'); process.exit(1); }

    // Get active even semester config
    const evenSem = await SemesterConfig.findOne({ semester: 'even', isActive: true });
    if (!evenSem) { console.error('No active even semester!'); process.exit(1); }

    // Clear existing workload
    await FacultyWorkload.deleteMany({});
    console.log('✅ Cleared existing workload data');

    // Helper: find faculty user by partial name match
    const findFacultyUser = async (searchName) => {
      // Try exact match first
      let user = await User.findOne({ name: new RegExp(searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), role: { $in: ['faculty', 'hod', 'coordinator'] } });
      if (user) return user;
      // Try last name match
      const parts = searchName.split(/\s+/);
      const lastName = parts[parts.length - 1];
      user = await User.findOne({ name: new RegExp(lastName, 'i'), role: { $in: ['faculty', 'hod', 'coordinator'] } });
      return user;
    };

    const findFaculty = async (searchName) => {
      let fac = await Faculty.findOne({ name: new RegExp(searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      if (fac) return fac;
      const parts = searchName.split(/\s+/);
      const lastName = parts[parts.length - 1];
      fac = await Faculty.findOne({ name: new RegExp(lastName, 'i') });
      return fac;
    };

    // Helper: parse practical load string like "-/-/2/2" into batch object
    const parsePractical = (str) => {
      if (!str || str === '—' || str === '-') return { batch1: 0, batch2: 0, batch3: 0, batch4: 0 };
      const parts = str.split('/').map(p => {
        const n = parseInt(p?.replace(/[^0-9]/g, '') || '0');
        return isNaN(n) ? 0 : n;
      });
      return { batch1: parts[0] || 0, batch2: parts[1] || 0, batch3: parts[2] || 0, batch4: parts[3] || 0 };
    };

    // =============================================
    // CSE-DS Even Semester Workload (from .md file)
    // =============================================
    const csedsWorkloadData = [
      {
        name: 'Dr. Satish Salunkhe', totalLoad: 10, miniProject: 1, majorProject: 1,
        allocations: [
          { class: 'SE-2', subject: 'DBMS', theory: 3, practical: '-/-/2/2' },
          { class: 'SE-3', subject: 'DBMS', theory: 3, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Dr. Yogesh Pingle', totalLoad: 22, miniProject: 1, majorProject: 1, extra: 4,
        allocations: [
          { class: 'SE-3', subject: 'MDM', theory: 3, practical: '2/2/2/2' },
          { class: 'SE-2', subject: 'MDM', theory: 3, practical: '2/2/2/2' }
        ]
      },
      {
        name: 'Dr. Vikrant Agaskar', totalLoad: 20, miniProject: 1, majorProject: 1, extra: 2,
        allocations: [
          { class: 'SE-1', subject: 'OS', theory: 0, practical: '2/-/2/-' },
          { class: 'SE-2', subject: 'OS', theory: 0, practical: '2/-/-/-' },
          { class: 'SE-3', subject: 'OS', theory: 3, practical: '2/2/2/2' },
          { class: 'BE', subject: 'ILOC-2', theory: 3, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Sejal DMello', totalLoad: 21, miniProject: 1, majorProject: 1, extra: 3,
        allocations: [
          { class: 'SE-2', subject: 'OS', theory: 3, practical: '-/2/2/2' },
          { class: 'TE-2', subject: 'SEPM', theory: 0, practical: '-/-/-/2' },
          { class: 'SE-3', subject: 'OE', theory: 2, practical: '-/-/-/-' },
          { class: 'TE-3', subject: 'CC', theory: 0, practical: '-/-/2/2' },
          { class: 'TE-1', subject: 'CC', theory: 0, practical: '2/2/-/-' }
        ]
      },
      {
        name: 'Neha Raut', totalLoad: 20, miniProject: 1, majorProject: 0, extra: 2,
        allocations: [
          { class: 'SE-1', subject: 'OS', theory: 3, practical: '-/2/-/2' },
          { class: 'TE-3', subject: 'DAV', theory: 3, practical: '2/2/2/2' },
          { class: 'TE-Honors', subject: 'Gaming AI', theory: 2, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Ichhanshu Jaiswal', totalLoad: 21, miniProject: 1, majorProject: 1, extra: 3,
        allocations: [
          { class: 'TE-2', subject: 'ML', theory: 3, practical: '-/2/2/-' },
          { class: 'TE-3', subject: 'ML', theory: 3, practical: '-/2/-/-' },
          { class: 'BE-1', subject: 'AAI', theory: 3, practical: '2/2/2/-' }
        ]
      },
      {
        name: 'Maya Varghese', totalLoad: 22, miniProject: 1, majorProject: 1, extra: 4,
        allocations: [
          { class: 'TE-3', subject: 'CSS', theory: 3, practical: '2/2/2/2' },
          { class: 'TE-1', subject: 'CSS', theory: 3, practical: '2/2/2/2' }
        ]
      },
      {
        name: 'Janisa Pereira', totalLoad: 21, miniProject: 1, majorProject: 1, extra: 3,
        allocations: [
          { class: 'TE-1', subject: 'DAV', theory: 3, practical: '2/2/2/2' },
          { class: 'TE-3', subject: 'CC', theory: 0, practical: '2/2/-/-' },
          { class: 'TE-1', subject: 'IVP', theory: 3, practical: '-/-/-/-' },
          { class: 'TE-2', subject: 'IVP', theory: 3, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Leena Raut', totalLoad: 20, miniProject: 1, majorProject: 1, extra: 2,
        allocations: [
          { class: 'SE-1', subject: 'DBMS', theory: 3, practical: '-/2/2/2' },
          { class: 'SE-2', subject: 'DBMS', theory: 0, practical: '-/2/-/-' },
          { class: 'SE-3', subject: 'DBMS', theory: 0, practical: '2/-/2/2' },
          { class: 'TE-1,2,3', subject: 'DC', theory: 3, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Nishiganda Pagare', totalLoad: 22, miniProject: 1, majorProject: 0, extra: 4,
        allocations: [
          { class: 'SE-2', subject: 'CT', theory: 3, practical: '-/-/-/-' },
          { class: 'SE-3', subject: 'CT', theory: 3, practical: '-/-/-/-' },
          { class: 'TE-1', subject: 'CC', theory: 0, practical: '-/-/2/2' },
          { class: 'TE-2', subject: 'CC', theory: 0, practical: '2/2/2/2' },
          { class: 'BE-Honors', subject: 'TWSMA', theory: 4, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Sayali Susvilkar', totalLoad: 22, miniProject: 1, majorProject: 0, extra: 4,
        allocations: [
          { class: 'SE-3', subject: 'DBMS', theory: 0, practical: '-/2/-/-' },
          { class: 'SE-1', subject: 'DBMS', theory: 0, practical: '2/-/-/-' },
          { class: 'SE-2', subject: 'DBMS', theory: 0, practical: '2/-/-/-' },
          { class: 'TE-2', subject: 'DAV', theory: 3, practical: '2/2/2/2' },
          { class: 'BE', subject: 'ILOC', theory: 3, practical: '-/-/-/-' },
          { class: 'TE-Honors', subject: 'Gaming AI', theory: 2, practical: '-/-/-/-' }
        ]
      },
      {
        name: 'Nivedha Raut', totalLoad: 20, miniProject: 1, majorProject: 0, extra: 2,
        allocations: [
          { class: 'TE-1', subject: 'ML', theory: 3, practical: '2/2/2/-' },
          { class: 'TE-3', subject: 'ML', theory: 0, practical: '-/-/2/2' },
          { class: 'BE', subject: 'AIFB', theory: 3, practical: '2/2/-/-' }
        ]
      },
      {
        name: 'Anjali Pardeshi', totalLoad: 21, miniProject: 1, majorProject: 0, extra: 3,
        allocations: [
          { class: 'TE-2', subject: 'SEPM', theory: 3, practical: '2/2/2/-' },
          { class: 'TE-1', subject: 'SEPM', theory: 3, practical: '-/-/-/-' },
          { class: 'BE', subject: 'SMA', theory: 3, practical: '2/2/2/-' }
        ]
      },
      {
        name: 'Shilpa Bane', totalLoad: 22, miniProject: 1, majorProject: 0, extra: 4,
        allocations: [
          { class: 'SE-1', subject: 'CT', theory: 3, practical: '-/-/-/-' },
          { class: 'TE-1', subject: 'ML', theory: 0, practical: '-/-/-/2' },
          { class: 'TE-2', subject: 'ML', theory: 0, practical: '2/-/-/2' },
          { class: 'TE-3', subject: 'ML', theory: 0, practical: '2/-/-/-' },
          { class: 'TE-3', subject: 'SEPM', theory: 3, practical: '2/2/2/2' }
        ]
      },
      {
        name: 'Ammrah Shaikh', totalLoad: 22, miniProject: 1, majorProject: 0, extra: 4,
        allocations: [
          { class: 'TE-2', subject: 'CSS', theory: 3, practical: '2/2/2/2' },
          { class: 'FE-3', subject: 'PCC', theory: 2, practical: '2/2/2/-' }
        ]
      },
      {
        name: 'Shital Cheke', totalLoad: 19, miniProject: 1, majorProject: 0, extra: 1,
        allocations: [
          { class: 'SE-1', subject: 'MDM', theory: 3, practical: '2/2/2/2' },
          { class: 'FE-2', subject: 'PCC', theory: 0, practical: '-/2/-/-' },
          { class: 'FE-1', subject: 'PCC', theory: 2, practical: '2/-/2/-' }
        ]
      },
      {
        name: 'Bhavika Joshi', totalLoad: 20, miniProject: 1, majorProject: 0, extra: 2,
        allocations: [
          { class: 'SE-1', subject: 'OE', theory: 2, practical: '-/-/-/-' },
          { class: 'SE-2', subject: 'OE', theory: 2, practical: '-/-/-/-' },
          { class: 'TE-1', subject: 'SEPM', theory: 0, practical: '2/2/2/2' },
          { class: 'FE-1', subject: 'PCC', theory: 0, practical: '-/2/-/-' },
          { class: 'FE-2', subject: 'PCC', theory: 2, practical: '2/-/2/-' }
        ]
      }
    ];

    // Process CSE-DS workload
    let savedCount = 0;
    const subjectFacultyMap = {}; // Track faculty-to-subject links

    for (const wl of csedsWorkloadData) {
      const faculty = await findFaculty(wl.name);
      if (!faculty) {
        console.warn(`  ⚠️ Faculty not found: ${wl.name}`);
        continue;
      }

      const allocations = [];
      for (const alloc of wl.allocations) {
        // Find subject by code
        const subject = await Subject.findOne({
          code: new RegExp(`^${alloc.subject}$`, 'i'),
          department: csedsDept._id
        });

        const prac = parsePractical(alloc.practical);
        allocations.push({
          subjectCode: alloc.subject,
          subjectName: subject?.name || alloc.subject,
          subjectId: subject?._id || undefined,
          theoryLoad: alloc.theory || 0,
          practicalLoad: prac,
          totalLoad: (alloc.theory || 0) + prac.batch1 + prac.batch2 + prac.batch3 + prac.batch4
        });

        // Link faculty user to subject
        if (subject) {
          const user = await findFacultyUser(wl.name);
          if (user && !subjectFacultyMap[subject._id.toString()]) {
            subjectFacultyMap[subject._id.toString()] = [];
          }
          if (user && subject) {
            if (!subjectFacultyMap[subject._id.toString()].includes(user._id.toString())) {
              subjectFacultyMap[subject._id.toString()].push(user._id.toString());
            }
          }
        }
      }

      // Use upsert to avoid duplicate key errors
      await FacultyWorkload.findOneAndUpdate(
        { facultyId: faculty._id, semesterId: evenSem._id },
        {
          allocations,
          miniProjectLoad: wl.miniProject || 0,
          majorProjectLoad: wl.majorProject || 0,
          totalTeachingLoad: wl.totalLoad,
          extraTotal: wl.extra || 0,
          status: 'approved'
        },
        { upsert: true, new: true }
      );
      savedCount++;
      console.log(`  ✅ ${wl.name} → ${faculty.name}: ${wl.totalLoad} hrs`);
    }

    console.log(`\n✅ Saved ${savedCount} CSE-DS workload records`);

    // =======================
    // LINK FACULTY TO SUBJECTS
    // =======================
    let linkedCount = 0;
    for (const [subjectId, userIds] of Object.entries(subjectFacultyMap)) {
      await Subject.findByIdAndUpdate(subjectId, {
        $addToSet: { faculty: { $each: userIds.map(id => new mongoose.Types.ObjectId(id)) } }
      });
      linkedCount++;
    }
    console.log(`✅ Linked faculty to ${linkedCount} subjects (no more TBA!)`);

    // =======================
    // SET PASSWORDS FOR ALL FACULTY
    // =======================
    const bcrypt = require('bcryptjs');
    const hashedPw = await bcrypt.hash('password123', 10);
    const updatedUsers = await User.updateMany(
      { role: { $in: ['faculty', 'hod', 'coordinator'] }, password: { $exists: false } },
      { $set: { password: hashedPw } }
    );
    const updatedUsers2 = await User.updateMany(
      { role: { $in: ['faculty', 'hod', 'coordinator'] } },
      { $set: { password: hashedPw, isApproved: true, isActive: true } }
    );
    console.log(`✅ Set password for ${updatedUsers2.modifiedCount} faculty/hod/coordinator users`);

    // Also set admin/principal/dean passwords
    const adminRoles = ['admin', 'principal', 'dean'];
    for (const role of adminRoles) {
      await User.findOneAndUpdate(
        { role },
        { $set: { password: hashedPw, isApproved: true, isActive: true } }
      );
    }
    console.log('✅ Set password for admin/principal/dean');

    console.log('\n' + '='.repeat(50));
    console.log('  WORKLOAD SEEDING COMPLETE');
    console.log('='.repeat(50));
    console.log('  All faculty can login with: password123');
    console.log('  Faculty workload visible on dashboard');
    console.log('  Subjects linked to faculty (no more TBA)');

    process.exit(0);
  } catch (error) {
    console.error('Workload seed error:', error);
    process.exit(1);
  }
}

seedWorkload();
