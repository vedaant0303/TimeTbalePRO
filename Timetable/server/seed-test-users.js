const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');
const Principal = require('./models/Principal');
const Department = require('./models/Department');

async function seedTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the department
    const dept = await Department.findOne({ code: 'CSE-DS' });
    if (!dept) {
      console.error('❌ No department found! Run "node seed.js" first.');
      process.exit(1);
    }

    // Remove only test users (keep real Google-verified users)
    const testEmails = [
      'test.student@vcet.edu.in',
      'test.faculty@vcet.edu.in',
      'test.principal@vcet.edu.in',
      'test.dean@vcet.edu.in',
      'test.hod@vcet.edu.in',
      'test.coordinator@vcet.edu.in',
      'test.admin@vcet.edu.in',
    ];

    await User.deleteMany({ email: { $in: testEmails } });
    await Student.deleteMany({ email: { $in: testEmails } });
    await Faculty.deleteMany({ email: { $in: testEmails } });
    await Principal.deleteMany({ email: { $in: testEmails } });
    console.log('Cleared old test accounts');

    // Create test users for ALL roles (googleVerified=true, password set)
    const testUsers = [
      {
        name: 'Test Student',
        email: 'test.student@vcet.edu.in',
        password: 'test123',
        role: 'student',
        googleVerified: true,
        authProvider: 'local',
        department: dept._id,
        division: '1',
        semester: 4,
        isActive: true,
      },
      {
        name: 'Test Faculty',
        email: 'test.faculty@vcet.edu.in',
        password: 'test123',
        role: 'faculty',
        googleVerified: true,
        authProvider: 'local',
        department: dept._id,
        employeeId: 'TEST-FAC',
        specializations: ['AI', 'Machine Learning'],
        maxWeeklyHours: 18,
        isActive: true,
      },
      {
        name: 'Test Coordinator',
        email: 'test.coordinator@vcet.edu.in',
        password: 'test123',
        role: 'coordinator',
        googleVerified: true,
        authProvider: 'local',
        department: dept._id,
        employeeId: 'TEST-CRD',
        isActive: true,
      },
      {
        name: 'Test HOD',
        email: 'test.hod@vcet.edu.in',
        password: 'test123',
        role: 'hod',
        googleVerified: true,
        authProvider: 'local',
        department: dept._id,
        employeeId: 'TEST-HOD',
        isActive: true,
      },
      {
        name: 'Test Dean',
        email: 'test.dean@vcet.edu.in',
        password: 'test123',
        role: 'dean',
        googleVerified: true,
        authProvider: 'local',
        employeeId: 'TEST-DEN',
        isActive: true,
      },
      {
        name: 'Test Principal',
        email: 'test.principal@vcet.edu.in',
        password: 'test123',
        role: 'principal',
        googleVerified: true,
        authProvider: 'local',
        employeeId: 'TEST-PRC',
        isActive: true,
      },
      {
        name: 'Test Admin',
        email: 'test.admin@vcet.edu.in',
        password: 'test123',
        role: 'admin',
        googleVerified: true,
        authProvider: 'local',
        employeeId: 'TEST-ADM',
        isActive: true,
      },
    ];

    for (const userData of testUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`  ✅ [${userData.role.toUpperCase().padEnd(11)}] ${userData.email}`);
    }

    console.log('\n============================================');
    console.log('  🧪 TEST ACCOUNTS CREATED SUCCESSFULLY');
    console.log('============================================');
    console.log('\n  Password for ALL accounts: test123\n');
    console.log('  📧 test.student@vcet.edu.in      → Student Dashboard');
    console.log('  📧 test.faculty@vcet.edu.in      → Faculty Dashboard');
    console.log('  📧 test.coordinator@vcet.edu.in  → Coordinator Dashboard');
    console.log('  📧 test.hod@vcet.edu.in          → HOD Dashboard');
    console.log('  📧 test.dean@vcet.edu.in         → Dean Dashboard');
    console.log('  📧 test.principal@vcet.edu.in    → Principal Dashboard');
    console.log('  📧 test.admin@vcet.edu.in        → Admin Dashboard');
    console.log('\n  Login Flow: Select role → Enter email & password → Sign In');
    console.log('  (Google verification already done for test accounts)\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedTestUsers();
