const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_management')
  .then(async () => {
    console.log('Connected to MongoDB');
    const TimeSlot = require('./models/TimeSlot');
    try {
      await TimeSlot.collection.dropIndex('slotNumber_1_academicYear_1');
      console.log('Index dropped successfully');
    } catch (e) {
      console.log('Error dropping index:', e.message);
    }
    
    try {
        await TimeSlot.collection.dropIndex('slotNumber_1_academicYear_1_department_1');
        console.log('New Index dropped successfully as well to recreate cleanly');
    } catch (e) {
        console.log('Error dropping new index:', e.message);
    }
    
    // recreate indexes based on schema
    await TimeSlot.syncIndexes();
    console.log('Indexes synced');
    
    process.exit(0);
  })
  .catch(err => console.error(err));
