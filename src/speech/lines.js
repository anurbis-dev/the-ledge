/* неблокирующие реплики героини — пулы на английском */
export var HERO_LINES = {
  empty: [
    'empty',
    'nothing',
    'nothing here',
    'all empty',
    'someone was here',
    'picked clean',
    'nothing to take'
  ],
  locked: [
    'locked',
    "won't budge",
    "can't get in",
    "keys don't fit",
    'no keys',
    'need to find keys'
  ],
  first: [
    'oh wow',
    'nice',
    "this'll help",
    'good find',
    'looks useful'
  ]
};

var lastPick = {};

export function pickLine(pool){
  var list = typeof pool === 'string' ? HERO_LINES[pool] : pool;
  if (!list || !list.length) return '';
  var key = list === HERO_LINES.empty ? 'empty'
    : list === HERO_LINES.locked ? 'locked'
    : list === HERO_LINES.first ? 'first' : 'x';
  var n = list.length;
  var i = Math.floor(Math.random() * n);
  if (n > 1 && i === lastPick[key]) i = (i + 1) % n;
  lastPick[key] = i;
  return list[i];
}
