const XLSX = require('./server/node_modules/xlsx');
const fs = require('fs');
const wb = XLSX.readFile('c:/Users/hp/OneDrive/Desktop/Timetable/MasterCopy__2025-26 (even) drive.xlsx');

let output = '';
const log = (msg) => { output += msg + '\n'; };

log('Sheet names: ' + JSON.stringify(wb.SheetNames));
log('Total sheets: ' + wb.SheetNames.length);

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  log('\n========== ' + name + ' ==========');
  log('Rows: ' + (range.e.r + 1) + ', Cols: ' + (range.e.c + 1));
  
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  // Print first 25 rows
  data.slice(0, 25).forEach((row, i) => {
    const cells = [];
    row.forEach((cell, ci) => {
      if (cell !== '') cells.push('[' + ci + ']=' + String(cell).substring(0, 40));
    });
    if (cells.length > 0) {
      log('Row ' + i + ': ' + cells.join(' | '));
    }
  });

  // Print merges info
  if (ws['!merges']) {
    log('\nMerges (' + ws['!merges'].length + ' total - showing first 15):');
    ws['!merges'].slice(0, 15).forEach(m => {
      log('  ' + XLSX.utils.encode_range(m));
    });
  }
});

fs.writeFileSync('C:/Users/hp/OneDrive/Desktop/Timetable/excel_analysis.txt', output, 'utf8');
console.log('Done! Output written to excel_analysis.txt');
