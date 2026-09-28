const fs = require('fs');
const f = 'C:/Users/Administrator/WorkBuddy/2026-09-12-05-35-40/streakora-prototype/index.html';
let s = fs.readFileSync(f, 'utf8');
const reps = [
  ['设置 › 你的数据', '设置 › 数据安全'],
  ["data:'你的数据'", "data:'数据安全'"],
  ["rankHead:'习惯坚持排行'", "rankHead:'排行榜'"],
  ["rankHead:'Habit persistence'", "rankHead:'Leaderboard'"],
  ['<span id="rankHead">Habit persistence</span>', '<span id="rankHead">Leaderboard</span>'],
  ['<span id="dataHead">Your data</span>', '<span id="dataHead">Data security</span>']
];
for (const [a, b] of reps) {
  const n = (s.split(a).length - 1);
  if (n !== 1) console.log('WARN count!=1 for [' + a + '] => ' + n);
  s = s.split(a).join(b);
}
fs.writeFileSync(f, s);
console.log('done; file bytes:', s.length);
