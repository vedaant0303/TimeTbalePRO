require('dotenv').config();
const mongoose = require('mongoose');
require('./models/SubjectAllocation');
require('./models/Subject');
require('./models/Class');
require('./models/SemesterConfig');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Class = mongoose.model('Class');
  const SA = mongoose.model('SubjectAllocation');
  const Subject = mongoose.model('Subject');
  
  const dept = '69bea57fa2a12a77022997e8';
  const sem = 8;
  
  console.log('\n=== TESTING BATCH COMBINE FLOW ===');
  
  // Step 1: Find classes
  const classes = await Class.find({ department: dept, semester: sem }).lean();
  console.log(`\n1. Classes for sem ${sem}:`, classes.map(c => `${c.name} (div:${c.divisionNumber})`));
  
  // Step 2: Find SubjectAllocations by dept
  const allAllocs = await SA.find({ departmentId: dept }).populate('classId').lean();
  console.log(`\n2. All allocations for dept:`, allAllocs.length);
  allAllocs.forEach(a => {
    console.log(`   - ${a.subject?.code} | class: ${a.classId?.name} | sem: ${a.classId?.semester} | combined: ${a.isCombinedBatch}`);
  });
  
  // Step 3: Try classId matching
  const classIds = classes.map(c => c._id);
  const matchedAllocs = await SA.find({ 
    departmentId: dept, 
    classId: { $in: classIds } 
  }).populate('classId').lean();
  console.log(`\n3. Matched by classId $in:`, matchedAllocs.length);
  matchedAllocs.forEach(a => {
    console.log(`   - ${a.subject?.code} | class: ${a.classId?.name}`);
  });
  
  // Step 4: Check subjects exist
  for (const a of allAllocs) {
    const existing = await Subject.findOne({ code: a.subject?.code, department: dept, semester: sem }).lean();
    console.log(`4. Subject "${a.subject?.code}" exists:`, existing ? 'YES' : 'NO');
  }
  
  process.exit(0);
});
