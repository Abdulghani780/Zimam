const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'frontend', 'src');
const keys = new Set();
const re = /\bt\('((?:[^'\\]|\\[\s\S])*)'\)/g;
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(f)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(re)) {
      keys.add(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    }
  }
};
walk(SRC);
const arr = [...keys].sort((a, b) => a.localeCompare(b, 'ar'));
console.log('keys:', arr.length);
fs.writeFileSync(path.join(__dirname, 'i18n-keys.json'), JSON.stringify(arr, null, 0), 'utf8');
fs.writeFileSync(path.join(__dirname, 'i18n-keys.txt'), arr.join('\n'), 'utf8');
