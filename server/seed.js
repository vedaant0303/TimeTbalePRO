const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Department = require('./models/Department');
const Subject = require('./models/Subject');
const Room = require('./models/Room');
const TimeSlot = require('./models/TimeSlot');
const AcademicCalendar = require('./models/AcademicCalendar');
const Class = require('./models/Class');
const SemesterConfig = require('./models/SemesterConfig');
const RoomAllocation = require('./models/RoomAllocation');
const FacultyWorkload = require('./models/FacultyWorkload');
const SubjectAllocation = require('./models/SubjectAllocation');
const TimetableSlot = require('./models/TimetableSlot');
const Faculty = require('./models/Faculty');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear structural data (keep users intact except seeded ones)
    await Promise.all([
      Department.deleteMany({}), Subject.deleteMany({}), Room.deleteMany({}),
      TimeSlot.deleteMany({}), AcademicCalendar.deleteMany({}), Class.deleteMany({}),
      SemesterConfig.deleteMany({}), RoomAllocation.deleteMany({}),
      FacultyWorkload.deleteMany({}), SubjectAllocation.deleteMany({}),
      TimetableSlot.deleteMany({}), Faculty.deleteMany({})
    ]);
    console.log('✅ Cleared structural data');

    // ============================================
    // DEPARTMENTS — All VCET departments
    // ============================================
    const csedsDept = await Department.create({
      name: 'Computer Science & Engineering (Data Science)', code: 'CSE-DS',
      divisions: ['1', '2', '3'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2','B3','B4']
    });
    const ceDept = await Department.create({
      name: 'Computer Engineering', code: 'CE',
      divisions: ['A', 'B', 'C'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2','B3','B4']
    });
    const itDept = await Department.create({
      name: 'Information Technology', code: 'IT',
      divisions: ['1', '2'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2','B3']
    });
    const aidsDept = await Department.create({
      name: 'Artificial Intelligence & Data Science', code: 'AIDS',
      divisions: ['1', '2'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2','B3','B4']
    });
    const extcDept = await Department.create({
      name: 'Electronics & Telecommunication Engineering', code: 'EXTC',
      divisions: ['1', '2'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2','B3']
    });
    const mechDept = await Department.create({
      name: 'Mechanical Engineering', code: 'MECH',
      divisions: ['1'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2']
    });
    const civilDept = await Department.create({
      name: 'Civil Engineering', code: 'CIVIL',
      divisions: ['1'], semesters: [1,2,3,4,5,6,7,8], batchGroups: ['B1','B2']
    });
    console.log('✅ Created 7 departments');

    // ============================================
    // Helper to create faculty + user record
    // ============================================
    const createFaculty = async (list, deptId) => {
      const results = [];
      for (const f of list) {
        const shortCode = f.name.split(' ').map(w => w[0]).join('').toUpperCase();
        const emailName = f.name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
        const email = `${emailName}@vcet.edu.in`;

        const fac = await Faculty.create({
          name: f.name, shortCode, email,
          designation: f.designation || 'Assistant Professor',
          departments: [deptId], isCrossDept: false,
          maxTheoryHours: f.role === 'hod' ? 8 : 18,
          maxPracticalHours: f.role === 'hod' ? 8 : 18,
          isActive: true
        });
        await User.findOneAndUpdate(
          { email },
          { name: f.name, email, role: f.role || 'faculty', department: deptId, isActive: true, isApproved: true },
          { upsert: true, new: true }
        );
        results.push(fac);
      }
      return results;
    };

    // ============================================
    // FACULTY — CSE-DS (from workload)
    // ============================================
    const csedsFac = await createFaculty([
      { name: 'Mr. Satish Salunkhe', role: 'hod', designation: 'Professor' },
      { name: 'Dr. Yogesh Pingle', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Krunali Vartak', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Ms. Maya Varghese', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Janisa Pereira', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Leena Raut', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Odilia Gonsalves', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Ichhanshu Jaiswal', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Shital Cheke', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Bhavika Joshi', role: 'faculty', designation: 'Assistant Professor' },
    ], csedsDept._id);
    console.log(`✅ CSE-DS: ${csedsFac.length} faculty`);

    // ============================================
    // FACULTY — Computer Engineering
    // ============================================
    const ceFac = await createFaculty([
      { name: 'Dr. Megha Trivedi', role: 'hod', designation: 'Professor' },
      { name: 'Dr. Dinesh Patil', role: 'faculty', designation: 'Professor' },
      { name: 'Dr. Swapna Borde', role: 'faculty', designation: 'Professor' },
      { name: 'Dr. Anil Hingmire', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Ms. Smita Jawale', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Mr. Sunil Katkar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Swati Varma', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Sanket Patil', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Sneha Mhatre', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Vishal Pande', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Neha Surti', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Brinal Colaco', role: 'faculty', designation: 'Assistant Professor' },
    ], ceDept._id);
    console.log(`✅ CE: ${ceFac.length} faculty`);

    // ============================================
    // FACULTY — Information Technology
    // ============================================
    const itFac = await createFaculty([
      { name: 'Dr. Thaksen Parvat', role: 'hod', designation: 'Professor' },
      { name: 'Mr. Chandan Kolvankar', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Dr. Archana Ekbote', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Dr. Madhavi Waghmare', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Dr. Vaishali Shirsath', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Sainath Patil', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Anagha Patil', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Snehal Mhatre', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Pragati Patil', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Jessica Falcao', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Yogita Shelar', role: 'faculty', designation: 'Assistant Professor' },
    ], itDept._id);
    console.log(`✅ IT: ${itFac.length} faculty`);

    // ============================================
    // FACULTY — AI & Data Science
    // ============================================
    const aidsFac = await createFaculty([
      { name: 'Dr. Tatwadarshi Nagarhalli', role: 'hod', designation: 'Professor' },
      { name: 'Ms. Sejal Dmello', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mrs. Sneha Yadav', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Ms. Neha Raut', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Kshitija Gharat', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Raunak Joshi', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Rujuta Vartak', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Sweety Patil', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Kranti Gule', role: 'faculty', designation: 'Assistant Professor' },
    ], aidsDept._id);
    console.log(`✅ AIDS: ${aidsFac.length} faculty`);

    // ============================================
    // FACULTY — Mechanical Engineering
    // ============================================
    const mechFac = await createFaculty([
      { name: 'Dr. Uday Aswalekar', role: 'hod', designation: 'Professor' },
      { name: 'Dr. Ashish Chaudhari', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Mr. Dipak Choudhari', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Mr. Vinay Patel', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Swapnil Mane', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Vishwas Palve', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Tusharkumar Raut', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Priti Vairagi', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Kamlesh Bachkar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Mukund Kavekar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Raahul Krishna', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Rishabh Melwanki', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Umeshchandra Mane', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Avantika Prabhu', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Javed Shaikh', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Gaurav Bhawde', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Akshay Save', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Mrunal Kshirsagar', role: 'faculty', designation: 'Assistant Professor' },
    ], mechDept._id);
    console.log(`✅ MECH: ${mechFac.length} faculty`);

    // ============================================
    // FACULTY — Electronics & Telecommunication
    // ============================================
    const extcFac = await createFaculty([
      { name: 'Dr. Amrita Ruperee', role: 'hod', designation: 'Professor' },
      { name: 'Dr. Vikas Gupta', role: 'faculty', designation: 'Professor' },
      { name: 'Dr. Ashish Vanmali', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Dr. Sunayana Jadhav', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Ms. Shaista Khan', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Ms. Sandhya Supalkar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Ashwini Katkar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Neha Gharat', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Trupti Shah', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Kanchan Sarmalkar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Bharati Gondhalekar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Sandeep Pawar', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Sampada Pimpale', role: 'faculty', designation: 'Assistant Professor' },
    ], extcDept._id);
    console.log(`✅ EXTC: ${extcFac.length} faculty`);

    // ============================================
    // FACULTY — Civil Engineering
    // ============================================
    const civilFac = await createFaculty([
      { name: 'Dr. Ajay Radke', role: 'hod', designation: 'Professor' },
      { name: 'Dr. Archanaa Dongre', role: 'faculty', designation: 'Associate Professor' },
      { name: 'Dr. Jaydeep Chougale', role: 'coordinator', designation: 'Assistant Professor' },
      { name: 'Ms. Puja Ghadi', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Dr. Viren Chandanshive', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Vikrant Kothari', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Arbaz Kazi', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Mr. Prakash Panda', role: 'faculty', designation: 'Assistant Professor' },
      { name: 'Ms. Aishwarya Anil', role: 'faculty', designation: 'Assistant Professor' },
    ], civilDept._id);
    console.log(`✅ CIVIL: ${civilFac.length} faculty`);

    const totalFaculty = csedsFac.length + ceFac.length + itFac.length + aidsFac.length + mechFac.length + extcFac.length + civilFac.length;

    // ============================================
    // ROOMS
    // ============================================
    const roomsData = [
      // Classrooms (shared across departments)
      { name: 'L-517', code: 'L-517', building: 'Main Block', floor: 5, capacity: 70, type: 'classroom', facilities: ['projector','whiteboard','AC'] },
      { name: 'L-519', code: 'L-519', building: 'Main Block', floor: 5, capacity: 70, type: 'classroom', facilities: ['projector','whiteboard','AC'] },
      { name: 'L-520', code: 'L-520', building: 'Main Block', floor: 5, capacity: 70, type: 'classroom', facilities: ['projector','whiteboard','AC'] },
      { name: 'L-425', code: 'L-425', building: 'Main Block', floor: 4, capacity: 60, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-424', code: 'L-424', building: 'Main Block', floor: 4, capacity: 60, type: 'classroom', facilities: ['projector','whiteboard','AC'] },
      { name: 'L-218', code: 'L-218', building: 'Main Block', floor: 2, capacity: 60, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-219', code: 'L-219', building: 'Main Block', floor: 2, capacity: 60, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-320', code: 'L-320', building: 'Main Block', floor: 3, capacity: 65, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-321', code: 'L-321', building: 'Main Block', floor: 3, capacity: 65, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-322', code: 'L-322', building: 'Main Block', floor: 3, capacity: 60, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-118', code: 'L-118', building: 'Main Block', floor: 1, capacity: 70, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-119', code: 'L-119', building: 'Main Block', floor: 1, capacity: 70, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-420', code: 'L-420', building: 'Main Block', floor: 4, capacity: 65, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-421', code: 'L-421', building: 'Main Block', floor: 4, capacity: 65, type: 'classroom', facilities: ['projector','whiteboard'] },
      { name: 'L-120', code: 'L-120', building: 'Main Block', floor: 1, capacity: 65, type: 'classroom', facilities: ['projector','whiteboard'] },
      // CSE-DS Labs (5 labs)
      { name: 'Lab 326', code: 'LAB-326', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: csedsDept._id },
      { name: 'Lab 329', code: 'LAB-329', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: csedsDept._id },
      { name: 'Lab 330', code: 'LAB-330', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: csedsDept._id },
      { name: 'Lab 331', code: 'LAB-331', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: csedsDept._id },
      { name: 'Lab 333', code: 'LAB-333', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: csedsDept._id },
      // CE Labs
      { name: 'Lab 213', code: 'LAB-213', building: 'Main Block', floor: 2, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: ceDept._id },
      { name: 'Lab 228', code: 'LAB-228', building: 'Main Block', floor: 2, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: ceDept._id },
      { name: 'Lab 229', code: 'LAB-229', building: 'Main Block', floor: 2, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: ceDept._id },
      { name: 'Lab 336', code: 'LAB-336', building: 'Main Block', floor: 3, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: ceDept._id },
      // IT Labs
      { name: 'Lab 415', code: 'LAB-415', building: 'Main Block', floor: 4, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: itDept._id },
      { name: 'Lab 416', code: 'LAB-416', building: 'Main Block', floor: 4, capacity: 30, type: 'lab', facilities: ['computers','projector'], department: itDept._id },
      // EXTC Labs
      { name: 'Lab 514', code: 'LAB-514', building: 'Main Block', floor: 5, capacity: 30, type: 'lab', facilities: ['equipment','projector'], department: extcDept._id },
    ];
    await Room.insertMany(roomsData);
    console.log(`✅ Created ${roomsData.length} rooms`);

    // ============================================
    // TIME SLOTS
    // ============================================
    const slotsData = [
      { slotNumber: 1, startTime: '08:15', endTime: '09:15', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 2, startTime: '09:15', endTime: '10:15', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 3, startTime: '10:15', endTime: '10:30', isBreak: true, breakType: 'short', academicYear: '2025-2026' },
      { slotNumber: 4, startTime: '10:30', endTime: '11:30', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 5, startTime: '11:30', endTime: '12:30', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 6, startTime: '12:30', endTime: '01:15', isBreak: true, breakType: 'lunch', academicYear: '2025-2026' },
      { slotNumber: 7, startTime: '01:15', endTime: '02:15', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 8, startTime: '02:15', endTime: '03:15', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 9, startTime: '03:15', endTime: '03:30', isBreak: true, breakType: 'short', academicYear: '2025-2026' },
      { slotNumber: 10, startTime: '03:30', endTime: '04:30', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 11, startTime: '04:30', endTime: '05:30', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
      { slotNumber: 12, startTime: '05:30', endTime: '06:30', isBreak: false, breakType: 'none', academicYear: '2025-2026' },
    ];
    await TimeSlot.insertMany(slotsData);
    console.log(`✅ Created ${slotsData.length} time slots`);

    // ============================================
    // SUBJECTS — CSE-DS
    // ============================================
    const subjectsData = [
      // SE ODD (Sem 3)
      { name: 'Engineering Mathematics III', code: 'EM3', department: csedsDept._id, semester: 3, credits: 4, weeklyHours: 15, theoryHours: 6, practicalHours: 0, tutorialHours: 9, type: 'theory' },
      { name: 'Discrete Structures & Graph Theory', code: 'DSGT', department: csedsDept._id, semester: 3, credits: 4, weeklyHours: 9, theoryHours: 9, practicalHours: 0, type: 'theory' },
      { name: 'Analysis of Algorithms', code: 'AOA', department: csedsDept._id, semester: 3, credits: 4, weeklyHours: 27, theoryHours: 9, practicalHours: 18, type: 'theory', requiresLab: true },
      { name: 'Computer Organization & Architecture', code: 'COA', department: csedsDept._id, semester: 3, credits: 4, weeklyHours: 27, theoryHours: 9, practicalHours: 18, type: 'theory', requiresLab: true },
      { name: 'Open Elective (Sem 3)', code: 'OE3', department: csedsDept._id, semester: 3, credits: 3, weeklyHours: 6, theoryHours: 6, practicalHours: 0, type: 'OE', isElective: true },
      { name: 'Full Stack with Java', code: 'FSJ', department: csedsDept._id, semester: 3, credits: 4, weeklyHours: 24, theoryHours: 6, practicalHours: 18, type: 'practical', requiresLab: true },
      // SE EVEN (Sem 4)
      { name: 'Computer Tooling', code: 'CT', department: csedsDept._id, semester: 4, credits: 4, weeklyHours: 9, theoryHours: 9, practicalHours: 0, type: 'theory' },
      { name: 'Database Management Systems', code: 'DBMS', department: csedsDept._id, semester: 4, credits: 4, weeklyHours: 27, theoryHours: 9, practicalHours: 18, type: 'theory', requiresLab: true },
      { name: 'Operating Systems', code: 'OS', department: csedsDept._id, semester: 4, credits: 4, weeklyHours: 27, theoryHours: 9, practicalHours: 18, type: 'theory', requiresLab: true },
      { name: 'Mobile Development', code: 'MDM', department: csedsDept._id, semester: 4, credits: 4, weeklyHours: 27, theoryHours: 9, practicalHours: 18, type: 'theory', requiresLab: true },
      { name: 'Open Elective (Sem 4)', code: 'OE4', department: csedsDept._id, semester: 4, credits: 3, weeklyHours: 6, theoryHours: 6, practicalHours: 0, type: 'OE', isElective: true },
      // TE ODD (Sem 5)
      { name: 'Computer Networks', code: 'CN', department: csedsDept._id, semester: 5, credits: 4, weeklyHours: 9, theoryHours: 9, practicalHours: 0, type: 'theory' },
      { name: 'Web Computing', code: 'WC', department: csedsDept._id, semester: 5, credits: 4, weeklyHours: 9, theoryHours: 9, practicalHours: 0, type: 'theory' },
      { name: 'Artificial Intelligence', code: 'AI', department: csedsDept._id, semester: 5, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'Data Warehousing & Mining', code: 'DWM', department: csedsDept._id, semester: 5, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'DLOC-1', code: 'DLOC1', department: csedsDept._id, semester: 5, credits: 3, weeklyHours: 6, theoryHours: 6, practicalHours: 0, type: 'DLOC' },
      { name: 'WC & NL Lab', code: 'WCNL', department: csedsDept._id, semester: 5, credits: 2, weeklyHours: 24, theoryHours: 0, practicalHours: 24, type: 'practical', requiresLab: true },
      // TE EVEN (Sem 6)
      { name: 'Data Analytics & Visualization', code: 'DAV', department: csedsDept._id, semester: 6, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'Cryptography & System Security', code: 'CSSSUB', department: csedsDept._id, semester: 6, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'Software Engineering & PM', code: 'SEPM', department: csedsDept._id, semester: 6, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'Machine Learning', code: 'ML', department: csedsDept._id, semester: 6, credits: 4, weeklyHours: 33, theoryHours: 9, practicalHours: 24, type: 'theory', requiresLab: true },
      { name: 'DLOC-2', code: 'DLOC2', department: csedsDept._id, semester: 6, credits: 3, weeklyHours: 9, theoryHours: 9, practicalHours: 0, type: 'DLOC' },
      { name: 'Cloud Computing Lab', code: 'CCL', department: csedsDept._id, semester: 6, credits: 2, weeklyHours: 24, theoryHours: 0, practicalHours: 24, type: 'practical', requiresLab: true },
      // BE ODD (Sem 7)
      { name: 'Deep Learning', code: 'DL', department: csedsDept._id, semester: 7, credits: 3, weeklyHours: 9, theoryHours: 3, practicalHours: 6, type: 'theory', requiresLab: true },
      { name: 'Big Data Analytics', code: 'BDA', department: csedsDept._id, semester: 7, credits: 3, weeklyHours: 9, theoryHours: 3, practicalHours: 6, type: 'theory', requiresLab: true },
      { name: 'DLOC-3', code: 'DLOC3', department: csedsDept._id, semester: 7, credits: 3, weeklyHours: 7, theoryHours: 3, practicalHours: 4, type: 'DLOC' },
      { name: 'DLOC-4', code: 'DLOC4', department: csedsDept._id, semester: 7, credits: 3, weeklyHours: 7, theoryHours: 3, practicalHours: 4, type: 'DLOC' },
      { name: 'ILOC-1', code: 'ILOC1', department: csedsDept._id, semester: 7, credits: 3, weeklyHours: 6, theoryHours: 6, practicalHours: 0, type: 'ILOC' },
      // BE EVEN (Sem 8)
      { name: 'Applied AI', code: 'AAI', department: csedsDept._id, semester: 8, credits: 3, weeklyHours: 9, theoryHours: 3, practicalHours: 6, type: 'theory', requiresLab: true },
      { name: 'DLOC-5', code: 'DLOC5', department: csedsDept._id, semester: 8, credits: 3, weeklyHours: 9, theoryHours: 3, practicalHours: 6, type: 'DLOC' },
      { name: 'DLOC-6', code: 'DLOC6', department: csedsDept._id, semester: 8, credits: 3, weeklyHours: 9, theoryHours: 3, practicalHours: 6, type: 'DLOC' },
      { name: 'ILOC-2', code: 'ILOC2', department: csedsDept._id, semester: 8, credits: 3, weeklyHours: 3, theoryHours: 3, practicalHours: 0, type: 'ILOC' },
    ];
    const allSubjects = await Subject.insertMany(subjectsData);
    console.log(`✅ Created ${allSubjects.length} subjects`);

    // ============================================
    // CLASSES
    // ============================================
    const classesData = [
      // CSE-DS
      { name: 'SE1-CSEDS', year: 'SE', divisionNumber: 1, department: csedsDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'SE2-CSEDS', year: 'SE', divisionNumber: 2, department: csedsDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'SE3-CSEDS', year: 'SE', divisionNumber: 3, department: csedsDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE1-CSEDS', year: 'TE', divisionNumber: 1, department: csedsDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE2-CSEDS', year: 'TE', divisionNumber: 2, department: csedsDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE3-CSEDS', year: 'TE', divisionNumber: 3, department: csedsDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'BE1-CSEDS', year: 'BE', divisionNumber: 1, department: csedsDept._id, semester: 8, batchCount: 3, batchLabels: ['B1','B2','B3'] },
      { name: 'BE2-CSEDS', year: 'BE', divisionNumber: 2, department: csedsDept._id, semester: 8, batchCount: 3, batchLabels: ['B1','B2','B3'] },
      { name: 'BE3-CSEDS', year: 'BE', divisionNumber: 3, department: csedsDept._id, semester: 8, batchCount: 3, batchLabels: ['B1','B2','B3'] },
      // CE
      { name: 'SE-A-CE', year: 'SE', divisionNumber: 1, department: ceDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'SE-B-CE', year: 'SE', divisionNumber: 2, department: ceDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'SE-C-CE', year: 'SE', divisionNumber: 3, department: ceDept._id, semester: 4, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE-A-CE', year: 'TE', divisionNumber: 1, department: ceDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE-B-CE', year: 'TE', divisionNumber: 2, department: ceDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'TE-C-CE', year: 'TE', divisionNumber: 3, department: ceDept._id, semester: 6, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'BE-A-CE', year: 'BE', divisionNumber: 1, department: ceDept._id, semester: 8, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'BE-B-CE', year: 'BE', divisionNumber: 2, department: ceDept._id, semester: 8, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'BE-C-CE', year: 'BE', divisionNumber: 3, department: ceDept._id, semester: 8, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      // FE (separate TT)
      { name: 'FE1', year: 'FE', divisionNumber: 1, department: csedsDept._id, semester: 2, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'FE2', year: 'FE', divisionNumber: 2, department: ceDept._id, semester: 2, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
      { name: 'FE3', year: 'FE', divisionNumber: 3, department: ceDept._id, semester: 2, batchCount: 4, batchLabels: ['B1','B2','B3','B4'] },
    ];
    await Class.insertMany(classesData);
    console.log(`✅ Created ${classesData.length} classes`);

    // ============================================
    // ACADEMIC CALENDAR
    // ============================================
    await AcademicCalendar.create({
      academicYear: '2025-2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-05-15'),
      semesters: [
        { name: 'Odd Semester', startDate: new Date('2025-07-01'), endDate: new Date('2025-12-15'), type: 'odd' },
        { name: 'Even Semester', startDate: new Date('2026-01-06'), endDate: new Date('2026-05-15'), type: 'even' }
      ],
      holidays: [
        { name: 'Independence Day', date: new Date('2025-08-15'), type: 'national' },
        { name: 'Gandhi Jayanti', date: new Date('2025-10-02'), type: 'national' },
        { name: 'Diwali Break', date: new Date('2025-10-20'), type: 'festival' },
        { name: 'Republic Day', date: new Date('2026-01-26'), type: 'national' },
        { name: 'Holi', date: new Date('2026-03-14'), type: 'national' },
        { name: 'Dr. Ambedkar Jayanti', date: new Date('2026-04-14'), type: 'national' },
      ],
      isActive: true
    });
    console.log('✅ Created academic calendar');

    // ============================================
    // SEMESTER CONFIGS — odd & even
    // ============================================
    const allDeptIds = [csedsDept._id, ceDept._id, itDept._id, aidsDept._id, extcDept._id, mechDept._id, civilDept._id];
    await SemesterConfig.create({
      semester: 'odd', academicYear: '2025-2026',
      departments: allDeptIds, generationState: 'idle', isActive: false,
      yearGroups: [
        { name: 'FE', semesters: [1], isSeparateSchedule: true },
        { name: 'SE-TE-BE', semesters: [3, 5, 7], isSeparateSchedule: false }
      ]
    });
    await SemesterConfig.create({
      semester: 'even', academicYear: '2025-2026',
      departments: allDeptIds, generationState: 'idle', isActive: true,
      yearGroups: [
        { name: 'FE', semesters: [2], isSeparateSchedule: true },
        { name: 'SE-TE-BE', semesters: [4, 6, 8], isSeparateSchedule: false }
      ]
    });
    console.log('✅ Created semester configs (odd + even)');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('  ✅ VCET DATABASE SEEDED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Departments: 7`);
    console.log(`   Faculty: ${totalFaculty} (CSE-DS:${csedsFac.length}, CE:${ceFac.length}, IT:${itFac.length}, AIDS:${aidsFac.length}, MECH:${mechFac.length}, EXTC:${extcFac.length}, CIVIL:${civilFac.length})`);
    console.log(`   Subjects: ${allSubjects.length}`);
    console.log(`   Rooms: ${roomsData.length}`);
    console.log(`   Classes: ${classesData.length}`);
    console.log(`   Semester Configs: 2 (odd + even)`);
    console.log(`\n🔄 Odd semesters (1,3,5,7) never mix with Even (2,4,6,8)`);
    console.log(`📋 FE (1st year) has separate timetable from SE/TE/BE\n`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
