import { BAKED } from './defaults.js';
import { preferLocal, notifyDraftChange } from './persist.js';

var KEY = 'ledge.dev.intro';

export var INTRO_DEFAULTS = [
  'GO ON. SLIP.',
  'FATE FIRST',
  'THE PIT SAYS HI',
  'GRIP OR GO',
  "DON'T LOOK DOWN",
  'GRAVITY IS HUNGRY',
  'ONE MORE LEDGE',
  'NO ROPE, NO MERCY',
  'THE VOID IS PATIENT',
  'LUCK IS A FINGERHOLD',
  'TRUST THE STONE',
  'FALL OR FLY',
  'THE CAVE IS LISTENING',
  'LEAVE THE LIGHT',
  'A LONG WAY DOWN',
  'THE FALL CAN WAIT',
  'STEP INTO IT',
  'READY TO CLIMB',
  'UP WE GO',
  'JUST ONE STEP',
  'FOLLOW THE GLOW',
  'A LITTLE HIGHER',
  'HOLD ON TIGHT',
  'THE CAVE SMILES',
  'SECRET AHEAD',
  'FIND THE WAY',
  'ADVENTURE WAKES',
  'LIGHT YOUR WAY',
  'PEEK AROUND',
  'TRY A JUMP',
  'THE PATH IS WAITING',
  'A FRIENDLY LEDGE',
  'CURIOUS FEET',
  'SOFT AND BRAVE',
  'WONDER THIS WAY',
  'THE STONES ARE KIND',
  'COME SEE'
];

var lines = null;
var lastIntro = -1;

function clean(s){
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function load(){
  lines = INTRO_DEFAULTS.slice();
  if (BAKED.intro && Array.isArray(BAKED.intro.lines))
    lines = BAKED.intro.lines.map(clean);
  if (!preferLocal()) return;
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || !Array.isArray(o.lines)) return;
    lines = o.lines.map(clean);
  } catch (_){}
}

function save(){
  try { localStorage.setItem(KEY, JSON.stringify({ lines: lines })); } catch (_){}
  notifyDraftChange();
}

export function introSnapshot(){
  try {
    var raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_){ return null; }
}

function ensure(){
  if (!lines) load();
  return lines;
}

export function getIntroLines(){
  return ensure().slice();
}

export function setIntroLineAt(i, text){
  ensure();
  if (i < 0 || i >= lines.length) return;
  lines[i] = clean(text);
  save();
}

export function addIntroLine(text){
  ensure();
  lines.push(clean(text));
  save();
  return lines.length - 1;
}

export function removeIntroLine(i){
  ensure();
  if (i < 0 || i >= lines.length) return;
  lines.splice(i, 1);
  save();
}

export function resetIntroLines(){
  lines = INTRO_DEFAULTS.slice();
  try { localStorage.removeItem(KEY); } catch (_){}
  notifyDraftChange();
}

function pool(){
  var a = ensure().filter(function(s){ return !!s; });
  return a.length ? a : INTRO_DEFAULTS.slice();
}

export function pickIntroLine(lv){
  var fixed = lv && clean(lv.intro);
  if (fixed) return fixed;
  var a = pool();
  var i = Math.floor(Math.random() * a.length);
  if (a.length > 1 && i === lastIntro) i = (i + 1) % a.length;
  lastIntro = i;
  return a[i];
}
