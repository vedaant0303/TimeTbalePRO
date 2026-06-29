/**
 * Seed sample students for each class
 * Creates ~15 students per division with roll numbers and batch assignments
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('./models/Student');
const Class = require('./models/Class');
const Department = require('./models/Department');

const firstNames = [
  'Aarav', 'Aditi', 'Arnav', 'Ananya', 'Dhruv', 'Diya', 'Ishaan', 'Kavya',
  'Krish', 'Meera', 'Neel', 'Pooja', 'Rahul', 'Riya', 'Sahil', 'Shreya',
  'Tanvi', 'Varun', 'Vaishnavi', 'Yash', 'Priya', 'Rohan', 'Sneha', 'Aditya',
  'Neha', 'Amit', 'Ankita', 'Siddharth', 'Nikita', 'Omkar', 'Pallavi', 'Pratik',
  'Ritika', 'Sameer', 'Trisha', 'Vikram', 'Zara', 'Arjun', 'Bhavna', 'Chirag',
  'Deepika', 'Gaurav', 'Harsha', 'Jatin', 'Komal', 'Lakshmi', 'Manish', 'Nisha'
];

const lastNames = [
  'Patil', 'Sharma', 'Desai', 'Joshi', 'Kulkarni', 'More', 'Pawar', 'Sawant',
  'Bhosale', 'Chavan', 'Gaikwad', 'Jadhav', 'Kadam', 'Mane', 'Nikam', 'Rajput',
  'Shinde', 'Thakur', 'Yadav', 'Gupta', 'Iyer', 'Khan', 'Malik', 'Naik',
  'Pandey', 'Rao', 'Singh', 'Tiwari', 'Verma', 'Wagh'
];

const batches = ['B1', 'B2', 'B3', 'B4'];

async function seedStudents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Student.deleteMany({});
    console.log('✅ Cleared existing students');

    const classes = await Class.find({ isActive: true }).populate('department');
    console.log(`Found ${classes.length} classes`);

    let totalStudents = 0;
    const usedEmails = new Set();

    for (const cls of classes) {
      const studentsPerClass = cls.year === 'BE' ? 12 : 16; // BE smaller, SE/TE bigger
      const batchCount = cls.batchCount || 4;
      const studentList = [];

      for (let i = 0; i < studentsPerClass; i++) {
        const firstName = firstNames[(totalStudents + i) % firstNames.length];
        const lastName = lastNames[(totalStudents + i * 3) % lastNames.length];
        const name = `${firstName} ${lastName}`;
        
        // Unique email
        let email;
        let counter = 0;
        do {
          const suffix = counter > 0 ? counter : '';
          email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@vcet.edu.in`;
          counter++;
        } while (usedEmails.has(email));
        usedEmails.add(email);

        const batchIndex = i % batchCount;
        const batch = batches[batchIndex];
        const rollNum = `${cls.year}${cls.divisionNumber}${String(i + 1).padStart(3, '0')}`;
        const semester = cls.semester || (cls.year === 'SE' ? 4 : cls.year === 'TE' ? 6 : cls.year === 'BE' ? 8 : 2);

        studentList.push({
          name,
          email,
          password: 'student123',
          department: cls.department._id,
          classId: cls._id,
          division: String(cls.divisionNumber),
          semester,
          batch,
          rollNumber: rollNum,
          isActive: true
        });
      }

      await Student.insertMany(studentList);
      totalStudents += studentList.length;
      console.log(`  ✅ ${cls.name}: ${studentList.length} students (${batchCount} batches)`);
    }

    console.log(`\n✅ Total students seeded: ${totalStudents}`);
    console.log('  Students can login with: student123');
    process.exit(0);
  } catch (error) {
    console.error('Student seed error:', error);
    process.exit(1);
  }
}

seedStudents();
