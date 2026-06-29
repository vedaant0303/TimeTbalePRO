const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const TimeSlot = require('./models/TimeSlot');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const timeSlots = [
  { startTime: '08:15', endTime: '09:15', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '09:15', endTime: '10:15', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '10:15', endTime: '11:15', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '11:15', endTime: '11:30', isBreak: true, breakType: 'short', isActive: true },
  { startTime: '11:30', endTime: '12:30', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '12:30', endTime: '13:30', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '13:30', endTime: '14:30', isBreak: true, breakType: 'lunch', isActive: true },
  { startTime: '14:30', endTime: '15:30', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '15:30', endTime: '16:30', isBreak: false, breakType: 'none', isActive: true },
  { startTime: '16:30', endTime: '17:30', isBreak: false, breakType: 'none', isActive: true }
];

async function seedTimeSlots() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const academicYear = "2025-26";
    
    await TimeSlot.deleteMany({ academicYear });
    console.log('Cleared existing time slots for ' + academicYear);
    
    const slotsToInsert = timeSlots.map((slot, index) => ({
      ...slot,
      slotNumber: index + 1,
      academicYear
    }));
    
    await TimeSlot.insertMany(slotsToInsert);
    console.log(`Inserted ${slotsToInsert.length} requested time slots successfully!`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error seeding time slots:', err);
    process.exit(1);
  }
}

seedTimeSlots();
