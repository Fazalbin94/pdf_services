 import fs from 'fs';
import path from 'path';

console.log('🟢 Script started');

const output: string[] = [];

function listFilesToArray(dir: string, prefix = '') {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    if (item === 'node_modules') continue;

    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      output.push(`${prefix}[DIR]  ${item}`);
      listFilesToArray(fullPath, prefix + '  ');
    } else {
      output.push(`${prefix}[FILE] ${item}`);
    }
  }
}

try {
  listFilesToArray('./'); // project root
  const filePath = path.resolve('./file-list.txt');
  fs.writeFileSync(filePath, output.join('\n'));
  console.log(`✅ Saved file list to ${filePath}`);
} catch (err) {
  console.error('❌ Error:', err);
}
