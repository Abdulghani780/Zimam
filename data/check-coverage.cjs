const fs = require('fs');
const path = require('path');
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-keys.json'), 'utf8'));
const src = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'lib', 'i18n-en.ts'), 'utf8');
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const missing = keys.filter((k) => !src.includes("'" + esc(k) + "'"));
console.log('total keys:', keys.length, 'missing:', missing.length);
missing.slice(0, 60).forEach((m) => console.log('-', m.slice(0, 90)));
fs.writeFileSync(path.join(__dirname, 'i18n-missing.txt'), missing.join('\n'), 'utf8');
