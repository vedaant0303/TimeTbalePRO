require('dotenv').config();
const mongoose = require('mongoose');

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const User = require('./models/User');
  const TimetableEntry = require('./models/TimetableEntry');
  
  // Find the faculty user
  const fac = await User.findOne({ name: /Ichhanshu/i }).select('_id name email role');
  console.log('Faculty User:', fac ? `_id=${fac._id} name=${fac.name} email=${fac.email} role=${fac.role}` : 'NOT FOUND');
  
  // Count total entries
  const total = await TimetableEntry.countDocuments();
  console.log('Total TimetableEntry count:', total);
  
  if (fac) {
    // Check entries with this faculty ID
    const facEntries = await TimetableEntry.countDocuments({ faculty: fac._id });
    console.log('Entries with faculty._id match:', facEntries);
  }
  
  // Check what faculty IDs are stored (sample)
  const uniqueFacultyIds = await TimetableEntry.distinct('faculty');
  console.log('Unique faculty IDs in TimetableEntry:', uniqueFacultyIds.length);
  console.log('First 5:', uniqueFacultyIds.slice(0, 5));
  
  // Check if entries exist at all
  const sample = await TimetableEntry.findOne().populate('faculty', 'name email');
  if (sample) {
    console.log('Sample entry faculty:', sample.faculty ? `${sample.faculty.name} (${sample.faculty._id})` : 'NULL');
    console.log('Sample entry day:', sample.day, 'semester:', sample.semester);
  }
  
  // Also check the auto-generated timetable (TimetableSlot model if exists)
  try {
    const TimetableSlot = require('./models/TimetableSlot');
    const slotCount = await TimetableSlot.countDocuments();
    console.log('\nTimetableSlot count:', slotCount);
    if (slotCount > 0) {
      const slotSample = await TimetableSlot.findOne();
      console.log('Slot sample fields:', Object.keys(slotSample.toObject()).join(', '));
    }
  } catch (e) { console.log('No TimetableSlot model'); }
  
  process.exit();
}

debug().catch(e => { console.error(e); process.exit(1); });
