const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const Class = require('./models/Class');
  const Department = require('./models/Department');

  // Check existing classes
  const classes = await Class.find({}).populate('department');
  console.log(`\nExisting classes: ${classes.length}`);
  classes.forEach(c => console.log(`  ${c.name} | year=${c.year} | div=${c.divisionNumber} | dept=${c.department?.name || c.department}`));

  // Check departments
  const depts = await Department.find({});
  console.log(`\nDepartments: ${depts.length}`);
  depts.forEach(d => console.log(`  ${d._id} | ${d.name}`));

  // If no classes, seed them for all departments
  if (classes.length === 0 && depts.length > 0) {
    console.log('\nNo classes found. Seeding...');
    const years = ['FE', 'SE', 'TE', 'BE'];
    const semesterMap = { FE: 2, SE: 4, TE: 6, BE: 8 };
    let count = 0;
    for (const dept of depts) {
      for (const year of years) {
        for (let div = 1; div <= 3; div++) {
          const name = `${year}${div}`;
          try {
            const cls = new Class({
              name, year, divisionNumber: div,
              department: dept._id,
              semester: semesterMap[year],
              batchCount: 4,
              batchLabels: ['B1', 'B2', 'B3', 'B4'],
              isActive: true
            });
            await cls.save();
            count++;
          } catch (e) {
            if (e.code === 11000) console.log(`  ${name} already exists for ${dept.name}`);
            else console.error(`  Error creating ${name}:`, e.message);
          }
        }
      }
    }
    console.log(`Created ${count} classes`);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
