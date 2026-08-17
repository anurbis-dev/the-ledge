/* неблокирующие реплики героини и короткие пулы NPC */
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

export var NPC_LINES = {
  already: [
    'already talked',
    'we covered that',
    'said that already',
    'anything else?',
    'you know that',
    'we chatted',
    'still on that?',
    'something else?',
    'told you already',
    'same as before'
  ],
  flee: [
    "they're here",
    'hide',
    'not now',
    'inside',
    'run'
  ],
  safe: [
    "they're gone",
    'quiet now',
    'all clear'
  ]
};

var lastPick = {};

export function pickLine(pool){
  var list = typeof pool === 'string'
    ? (HERO_LINES[pool] || NPC_LINES[pool])
    : pool;
  if (!list || !list.length) return '';
  var key = typeof pool === 'string' ? pool : 'x';
  var n = list.length;
  var i = Math.floor(Math.random() * n);
  if (n > 1 && i === lastPick[key]) i = (i + 1) % n;
  lastPick[key] = i;
  return list[i];
}
