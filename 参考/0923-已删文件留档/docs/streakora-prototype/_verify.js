const fs = require('fs');
const s = fs.readFileSync('C:/Users/Administrator/WorkBuddy/2026-09-12-05-35-40/streakora-prototype/index.html', 'utf8');
const m = s.match(/<script>([\s\S]*)<\/script>/);
try { new Function(m[1]); console.log('JS_SYNTAX OK'); } catch (e) { console.log('JS_SYNTAX_ERR', e.message); }

const z = s.match(/zh:\{([\s\S]*?)\n  \},/);
const e = s.match(/en:\{([\s\S]*?)\n  \}\n\};/);
function keys(b) {
  const o = {}; const re = /(\w+):/g; let mm;
  while ((mm = re.exec(b))) o[mm[1]] = 1;
  return Object.keys(o).sort();
}
const zk = keys(z[1]), ek = keys(e[1]);
const miss = zk.filter(k => !ek.includes(k));
const extra = ek.filter(k => !zk.includes(k));
console.log('zh keys:', zk.length, 'en keys:', ek.length);
console.log('missing in en:', miss.length ? miss : 'none');
console.log('missing in zh:', extra.length ? extra : 'none');

// spot-check the two changed keys resolved
const open = (s.match(/<div\b/g) || []).length;
const close = (s.match(/<\/div>/g) || []).length;
console.log('DIV', open, close, open === close ? 'BALANCED' : 'MISMATCH');
