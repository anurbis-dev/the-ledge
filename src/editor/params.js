import { C } from '../core/constants.js';
import GAME from '../core/game.js';
import { initSliders } from './slider.js';
import { BAKED } from '../core/defaults.js';
import { preferLocal, notifyDraftChange } from '../core/persist.js';

var PKEY = 'ledge.dev.C';
if (BAKED.params){
  for (var _bk in BAKED.params){
    if (Object.prototype.hasOwnProperty.call(C, _bk) && typeof BAKED.params[_bk] === 'number' && Number.isFinite(BAKED.params[_bk]))
      C[_bk] = BAKED.params[_bk];
  }
}
export var C0 = {};
for (var _k in C) if (Object.prototype.hasOwnProperty.call(C, _k)) C0[_k] = C[_k];

export function paramsSnapshot(){
  try {
    var raw = localStorage.getItem(PKEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_){ return null; }
}

export var PARAM_GROUPS = [
  { id: 'hitbox', name: 'Hitbox', items: [
    { key: 'W', label: 'Stand width', min: 4, max: 20, step: 1, hint: 'body width' },
    { key: 'H', label: 'Stand height', min: 10, max: 36, step: 1, hint: 'body height' },
    { key: 'RH', label: 'Roll height', min: 6, max: 22, step: 1 },
    { key: 'CRH', label: 'Crouch height', min: 8, max: 22, step: 1 },
    { key: 'PRH', label: 'Prone height', min: 4, max: 16, step: 1 },
    { key: 'PRW', label: 'Prone width', min: 10, max: 28, step: 1 }
  ]},
  { id: 'run', name: 'Run / Walk', items: [
    { key: 'RUN', label: 'Run speed', min: 20, max: 220, step: 1 },
    { key: 'ACC', label: 'Acceleration', min: 100, max: 2400, step: 10 },
    { key: 'FRIC', label: 'Friction', min: 100, max: 3000, step: 10 },
    { key: 'WALK_V', label: 'Walk speed', min: 10, max: 120, step: 1 },
    { key: 'CROUCH_V', label: 'Crouch speed', min: 8, max: 100, step: 1 },
    { key: 'PRONE_V', label: 'Prone speed', min: 4, max: 80, step: 1 },
    { key: 'DASH_V', label: 'Dash speed', min: 40, max: 280, step: 1 },
    { key: 'SLOPE_ALONG', label: 'Slope along', min: 0.4, max: 1.2, step: 0.01, hint: 'slope speed' }
  ]},
  { id: 'jump', name: 'Jump / Gravity', items: [
    { key: 'GRAV', label: 'Gravity', min: 200, max: 1600, step: 10 },
    { key: 'MAXFALL', label: 'Max fall', min: 80, max: 700, step: 5 },
    { key: 'JUMP', label: 'Jump velocity', min: -420, max: -80, step: 1 },
    { key: 'CUT', label: 'Jump cut', min: 0.1, max: 1, step: 0.01 },
    { key: 'COYOTE', label: 'Coyote time', min: 0, max: 0.3, step: 0.01 },
    { key: 'BUF', label: 'Jump buffer', min: 0, max: 0.3, step: 0.01 }
  ]},
  { id: 'grab', name: 'Grab / Climb', items: [
    { key: 'HAND', label: 'Hand offset', min: 1, max: 10, step: 1 },
    { key: 'TOL_UP', label: 'Grab tol up', min: 1, max: 10, step: 1 },
    { key: 'TOL_DN', label: 'Grab tol down', min: 1, max: 16, step: 1 },
    { key: 'GRAB_VY', label: 'Grab max vy', min: -260, max: -20, step: 1 },
    { key: 'GRAB_CD', label: 'Grab cooldown', min: 0, max: 0.6, step: 0.01 },
    { key: 'CLIMB_UP', label: 'Climb up t', min: 0.1, max: 1.2, step: 0.01 },
    { key: 'CLIMB_DN', label: 'Climb down t', min: 0.1, max: 1.2, step: 0.01 },
    { key: 'TO_LAD', label: 'To ladder t', min: 0.05, max: 0.8, step: 0.01 },
    { key: 'VAULT_T', label: 'Vault time', min: 0.08, max: 0.6, step: 0.01, hint: 'mantle' },
    { key: 'STAND_OFF', label: 'Stand offset', min: 2, max: 16, step: 1 },
    { key: 'EDGE_HOLD', label: 'Edge hold', min: 0, max: 0.6, step: 0.01 }
  ]},
  { id: 'wall', name: 'Wall', items: [
    { key: 'SLIDE_V', label: 'Slide speed', min: 10, max: 160, step: 1 },
    { key: 'WJ_X', label: 'Walljump X', min: 40, max: 220, step: 1 },
    { key: 'WJ_Y', label: 'Walljump Y', min: -320, max: -60, step: 1 },
    { key: 'WJ_LOCK', label: 'Walljump lock', min: 0, max: 0.5, step: 0.01 },
    { key: 'WJ_SAME_X', label: 'Same-wall X', min: 20, max: 160, step: 1 },
    { key: 'WJ_SAME_Y', label: 'Same-wall Y', min: -240, max: -40, step: 1 }
  ]},
  { id: 'combat', name: 'Combat / Action', items: [
    { key: 'ATK_T', label: 'Attack time', min: 0.08, max: 0.8, step: 0.01 },
    { key: 'ATK_R', label: 'Attack reach', min: 8, max: 48, step: 1 },
    { key: 'ATK_CD', label: 'Attack cooldown', min: 0, max: 0.6, step: 0.01 },
    { key: 'HURT_CD', label: 'Hurt i-frames', min: 0.2, max: 2.5, step: 0.05 },
    { key: 'ACT_R', label: 'Action radius', min: 8, max: 48, step: 1 },
    { key: 'THROW_X', label: 'Throw X', min: 40, max: 280, step: 1 },
    { key: 'THROW_Y', label: 'Throw Y', min: -240, max: -20, step: 1 },
    { key: 'THROW_T', label: 'Throw time', min: 0.06, max: 0.6, step: 0.01 },
    { key: 'PICK_T', label: 'Pickup time', min: 0.08, max: 0.8, step: 0.01 }
  ]},
  { id: 'stance', name: 'Stance / Roll', items: [
    { key: 'STANCE_T', label: 'Stance blend', min: 0.04, max: 0.4, step: 0.01 },
    { key: 'ROLL_V', label: 'Roll speed', min: 60, max: 280, step: 1 },
    { key: 'ROLL_T', label: 'Roll time', min: 0.15, max: 1, step: 0.01 },
    { key: 'ROLL_CD', label: 'Roll cooldown', min: 0, max: 0.5, step: 0.01 },
    { key: 'STAM_MAX', label: 'Stamina', min: 0.4, max: 6, step: 0.1 }
  ]},
  { id: 'swim', name: 'Swim / Air', items: [
    { key: 'AIR_MAX', label: 'Air max', min: 3, max: 30, step: 0.5 },
    { key: 'SCUBA_AIR', label: 'Scuba air', min: 10, max: 80, step: 1 },
    { key: 'SWIM_V', label: 'Swim speed', min: 20, max: 140, step: 1 },
    { key: 'SWIM_UP', label: 'Swim up', min: -180, max: -10, step: 1 },
    { key: 'SWIM_DN', label: 'Swim down', min: 20, max: 160, step: 1 },
    { key: 'SWIM_JUMP', label: 'Swim launch', min: -320, max: -60, step: 1 },
    { key: 'FLIP_MUL', label: 'Flipper mul', min: 1, max: 2.2, step: 0.05 }
  ]},
  { id: 'harpoon', name: 'Harpoon / Grapple', items: [
    { key: 'HARPOON_V', label: 'Shot speed', min: 60, max: 420, step: 5, hint: 'bolt and hook fly' },
    { key: 'HARPOON_LEN', label: 'Grapple length', min: 32, max: 320, step: 4 },
    { key: 'HARPOON_PULL', label: 'Pull speed', min: 80, max: 480, step: 5 },
    { key: 'HARPOON_DETACH', label: 'Detach dist', min: 6, max: 56, step: 1 },
    { key: 'HARPOON_CD', label: 'Cooldown', min: 0, max: 1, step: 0.01 }
  ]},
  { id: 'ladder', name: 'Ladder / Bar / Lift', items: [
    { key: 'LAD_V', label: 'Ladder speed', min: 20, max: 140, step: 1 },
    { key: 'LAD_TOL', label: 'Ladder Y tol', min: 2, max: 16, step: 1 },
    { key: 'LAD_XTOL', label: 'Ladder X tol', min: 4, max: 20, step: 1 },
    { key: 'LAD_SNAP', label: 'Ladder snap', min: 0.04, max: 0.4, step: 0.01 },
    { key: 'BAR_V', label: 'Bar speed', min: 16, max: 120, step: 1 },
    { key: 'LIFT_V', label: 'Lift speed', min: 12, max: 100, step: 1 },
    { key: 'LIFT_DWELL', label: 'Lift dwell', min: 0.2, max: 4, step: 0.05 }
  ]},
  { id: 'fall', name: 'Fall / Damage', items: [
    { key: 'SAFE', label: 'Safe fall', min: 10, max: 120, step: 1 },
    { key: 'HURT', label: 'Hurt fall', min: 30, max: 220, step: 1 },
    { key: 'HITSTOP', label: 'Hitstop', min: 0, max: 0.2, step: 0.005 },
    { key: 'FALL_CROUCH_T', label: 'Fall crouch t', min: 0.1, max: 2, step: 0.05 },
    { key: 'FALL_PRONE_T', label: 'Fall prone t', min: 0.2, max: 3, step: 0.05 },
    { key: 'GETUP_T', label: 'Get-up t', min: 0.1, max: 1.5, step: 0.05 }
  ]},
  { id: 'world', name: 'World / Hazards', items: [
    { key: 'WARP_T', label: 'Door warp t', min: 0.2, max: 1.5, step: 0.02 },
    { key: 'ROOM_FADE', label: 'Room fade t', min: 0.08, max: 2, step: 0.02, hint: 'cover reveal' },
    { key: 'CRUMB_T', label: 'Crumb crack t', min: 0.2, max: 3, step: 0.05 },
    { key: 'TEND_REACH', label: 'Tendril reach', min: 20, max: 180, step: 1 },
    { key: 'TEND_HOLD', label: 'Tendril hold', min: 0.4, max: 6, step: 0.1 }
  ]}
];

export function loadParams(){
  if (!preferLocal()) return;
  try {
    var raw = localStorage.getItem(PKEY);
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    for (var k in o){
      if (Object.prototype.hasOwnProperty.call(C, k) && typeof o[k] === 'number' && Number.isFinite(o[k]))
        C[k] = o[k];
    }
  } catch (_){}
}

export function saveParams(){
  try {
    var o = {};
    for (var k in C) if (Object.prototype.hasOwnProperty.call(C, k) && C[k] !== C0[k]) o[k] = C[k];
    localStorage.setItem(PKEY, JSON.stringify(o));
  } catch (_){}
  notifyDraftChange();
}

export function applyParam(key, val){
  if (!Object.prototype.hasOwnProperty.call(C, key)) return;
  if (!Number.isFinite(val)) return;
  C[key] = val;
  var S = GAME.W, p = S && S.p;
  if (p){
    if (key === 'W' && p.stance !== 2) p.w = C.W;
    if (key === 'H' && p.stance === 0) p.h = C.H;
    if (key === 'CRH' && p.stance === 1) p.h = C.CRH;
    if (key === 'PRH' && p.stance === 2) p.h = C.PRH;
    if (key === 'PRW' && p.stance === 2) p.w = C.PRW;
    if (key === 'AIR_MAX' && !p.scuba) p.air = Math.min(p.air, C.AIR_MAX);
    if (key === 'SCUBA_AIR' && p.scuba) p.air = Math.min(p.air, C.SCUBA_AIR);
    if (key === 'STAM_MAX') p.stam = Math.min(p.stam, C.STAM_MAX);
  }
  saveParams();
}

export function resetAllParams(){
  for (var k in C0) C[k] = C0[k];
  try { localStorage.removeItem(PKEY); } catch (_){}
  notifyDraftChange();
  var S = GAME.W, p = S && S.p;
  if (p){
    if (p.stance === 2){ p.w = C.PRW; p.h = C.PRH; }
    else if (p.stance === 1){ p.w = C.W; p.h = C.CRH; }
    else { p.w = C.W; p.h = C.H; }
  }
}

function matches(q, group, item){
  if (!q) return true;
  var hay = (group.name + ' ' + item.key + ' ' + item.label + ' ' + (item.hint || '')).toLowerCase();
  return hay.indexOf(q) !== -1;
}

export function renderParams(host, query){
  if (!host) return;
  host.textContent = '';
  var q = (query || '').trim().toLowerCase();
  var shown = 0;
  for (var g = 0; g < PARAM_GROUPS.length; g++){
    var group = PARAM_GROUPS[g];
    var items = [];
    for (var i = 0; i < group.items.length; i++){
      if (!Object.prototype.hasOwnProperty.call(C, group.items[i].key)) continue;
      if (matches(q, group, group.items[i])) items.push(group.items[i]);
    }
    if (!items.length) continue;
    var sec = document.createElement('section');
    sec.className = 'ed-pg';
    var h = document.createElement('h4');
    h.className = 'ed-pg-title';
    h.textContent = group.name;
    sec.appendChild(h);
    for (var j = 0; j < items.length; j++){
      (function(it){
        var wrap = document.createElement('div');
        wrap.className = 'slider-wrap';
        wrap.title = it.key + (it.hint ? ' — ' + it.hint : '');
        var over = document.createElement('div');
        over.className = 'slider-label-overlay';
        var lab = document.createElement('span');
        lab.textContent = it.label;
        var val = document.createElement('span');
        over.appendChild(lab);
        over.appendChild(val);
        var inp = document.createElement('input');
        inp.type = 'range';
        inp.min = String(it.min);
        inp.max = String(it.max);
        inp.step = String(it.step);
        var cur = C[it.key];
        if (!Number.isFinite(cur)) cur = C0[it.key];
        inp.value = String(cur);
        inp.dataset.default = String(C0[it.key]);
        inp.addEventListener('input', function(){ applyParam(it.key, +inp.value); });
        wrap.appendChild(over);
        wrap.appendChild(inp);
        sec.appendChild(wrap);
      })(items[j]);
      shown++;
    }
    host.appendChild(sec);
  }
  if (!shown){
    var empty = document.createElement('div');
    empty.className = 'ed-pg-empty';
    empty.textContent = 'No matching parameters';
    host.appendChild(empty);
  }
  initSliders(host);
}

loadParams();
