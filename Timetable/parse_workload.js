const XLSX = require('./server/node_modules/xlsx');
const fs = require('fs');

const files = [
  { name: 'EVEN SEM', path: 'c:/Users/hp/OneDrive/Desktop/Timetable/teaching workload even sem 2025-26.xlsx' },
  { name: 'ODD SEM', path: 'c:/Users/hp/OneDrive/Desktop/Timetable/Workload CSEDS -2025-26 (odd).xlsx' }
];

let output = '';
const log = (msg) => { output += msg + '\n'; };

for (const file of files) {
  log('\n' + '='.repeat(80));
  log(`FILE: ${file.name}`);
  log('='.repeat(80));
  
  const wb = XLSX.readFile(file.path);
  log('Sheet names: ' + JSON.stringify(wb.SheetNames));
  log('Total sheets: ' + wb.SheetNames.length);

  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) { log(`\n--- ${name} --- (EMPTY)`); return; }
    const range = XLSX.utils.decode_range(ws['!ref']);
    log(`\n--- ${name} --- (rows:${range.e.r + 1}, cols:${range.e.c + 1})`);
    
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    // Print first 30 rows
    const maxRows = Math.min(data.length, 35);
    for (let i = 0; i < maxRows; i++) {
      const row = data[i];
      const cells = [];
      row.forEach((cell, ci) => {
        if (cell !== '' && cell !== undefined && cell !== null) {
          cells.push('[' + ci + ']=' + String(cell).substring(0, 50));
        }
      });
      if (cells.length > 0) {
        log('Row ' + i + ': ' + cells.join(' | '));
      }
    }

    // Print merges info
    if (ws['!merges']) {
      log(`\nMerges (${ws['!merges'].length} total - showing first 10):`);
      ws['!merges'].slice(0, 10).forEach(m => {
        log('  ' + XLSX.utils.encode_range(m));
      });
    }
  });
}

fs.writeFileSync('C:/Users/hp/OneDrive/Desktop/Timetable/workload_analysis.txt', output, 'utf8');
console.log('Done! Output written to workload_analysis.txt');
