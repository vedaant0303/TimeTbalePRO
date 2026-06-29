const mongoose = require('mongoose');
const TimeSlot = require('./models/TimeSlot');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');
  
  const academicYear = "2025-2026 (odd)"; // fake
  const department = new mongoose.Types.ObjectId();
  
  const defaults = [
    { slotNumber: 1, startTime: '8:15', endTime: '9:15', isBreak: false, breakType: 'none', academicYear, department },
  ];
  
  try {
    await TimeSlot.insertMany(defaults);
    console.log('Inserted');
    await TimeSlot.deleteMany({ academicYear, department });
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}
test();
