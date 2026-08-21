import { VOLUME_MASKS } from '../entities/volumes.js';
import { SAND_EMIT_DEF } from '../entities/emitters.js';
import { PLAT_DEF } from '../entities/plats.js';
import { LIFT_DEF, syncLiftFloors } from '../entities/lifts.js';
import { initSliders, bindResetHover } from './slider.js';
import { touchOp } from './history.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';
import { listSpriteDefs } from '../core/spriteset.js';
import { ITEMS } from '../entities/catalog.js';
import GAME from '../core/game.js';
import { findById } from '../entities/ids.js';
import { runtime } from '../core/runtime.js';
import { C, T } from '../core/constants.js';

var DEF = {
  sound: { mode: 'falloff', vol: 0.4, radius: 96, freq: 220, type: 'sine' },
  light: { color: '#ffbe74', intensity: 1, radius: 82, sprite: 'lantern' },
  volume: { mode: 'color', mask: 'circle', hue: 0, sat: 1, bright: 0, contrast: 1, tint: '#88a0ff', tintAmt: 0.15 },
  fx_sand: SAND_EMIT_DEF,
  plat: PLAT_DEF,
  lift: LIFT_DEF
};

var root = document.getElementById('edInspect');
var titleEl = document.getElementById('edInspectTitle');
var body = document.getElementById('edInspectBody');
var onChange = null;
var onClose = null;
var current = null;

export function bindInspect(hooks){
  onChange = hooks && hooks.onChange;
  onClose = hooks && hooks.onClose;
}

export function showInspect(sel){
  current = sel;
  if (!root) return;
  if (!sel || !sel.obj){ root.hidden = true; return; }
  root.hidden = false;
  if (titleEl){
    titleEl.textContent = sel.type === 'volume' ? 'Volume'
      : (sel.type === 'light' ? 'Light'
        : (sel.type === 'fx_sand' ? 'FX Sand'
          : (sel.type === 'plat' ? (sel.obj && sel.obj.vert ? 'Plat V' : 'Plat H')
            : (sel.type === 'lift' ? 'Lift'
              : (sel.type === 'player_start' ? 'Start'
                : (sel.type === 'level_exit' ? 'Exit'
                  : (sel.type === 'door' ? 'Door' : 'Sound')))))));
  }
  fillBody(sel);
  if (!hasFloatPos(root)) placeFloat(root, innerWidth - 250, 8);
  raiseFloat(root);
}

function notify(){
  if (onChange) onChange();
}

function slider(parent, label, min, max, step, val, set, def){
  var wrap = document.createElement('label');
  wrap.className = 'slider-wrap';
  wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
  inp.value = val;
  inp.dataset.default = String(def != null ? def : val);
  inp.addEventListener('input', function(){ touchOp(); set(+inp.value); notify(); });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

function select(parent, label, opts, val, set, def){
  var row = document.createElement('label');
  row.className = 'ed-field';
  row.textContent = label + ' ';
  var s = document.createElement('select');
  for (var i = 0; i < opts.length; i++){
    var o = document.createElement('option');
    o.value = opts[i].id; o.textContent = opts[i].name;
    if (opts[i].id === val) o.selected = true;
    s.appendChild(o);
  }
  var factory = def != null ? def : opts[0].id;
  s.addEventListener('change', function(){ touchOp(); set(s.value); notify(); showInspect(current); });
  bindResetHover(row, function(){
    if (s.value === factory) return;
    touchOp();
    s.value = factory;
    set(factory);
    notify();
    showInspect(current);
  });
  row.appendChild(s);
  parent.appendChild(row);
}

function toggle(parent, label, val, set){
  var row = document.createElement('label');
  row.className = 'ed-field';
  var inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = !!val;
  inp.addEventListener('change', function(){ touchOp(); set(!!inp.checked); notify(); showInspect(current); });
  row.appendChild(inp);
  row.appendChild(document.createTextNode(' ' + label));
  parent.appendChild(row);
}

function color(parent, label, val, set, def){
  var row = document.createElement('label');
  row.className = 'ed-field';
  row.textContent = label + ' ';
  var inp = document.createElement('input');
  var factory = toHex(def || val);
  inp.type = 'color'; inp.value = toHex(val);
  inp.addEventListener('input', function(){ touchOp(); set(inp.value); notify(); });
  bindResetHover(row, function(){
    if (inp.value === factory) return;
    touchOp();
    inp.value = factory;
    set(factory);
    notify();
  });
  row.appendChild(inp);
  parent.appendChild(row);
}

function toHex(c){
  if (!c) return '#ffbe74';
  if (c.charAt(0) === '#') return c.length === 4
    ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  return '#ffbe74';
}

function note(parent, text){
  var el = document.createElement('div');
  el.className = 'ed-tile-note';
  el.textContent = text;
  parent.appendChild(el);
}

function bagItemOpts(){
  var opts = [{ id: '', name: '(none)' }], k, info;
  for (k in ITEMS){
    info = ITEMS[k];
    if (!info || info.cat !== 'bag') continue;
    opts.push({ id: k, name: info.name || k });
  }
  return opts;
}

function levelOpts(){
  var opts = [{ id: '', name: '(none / MENU)' }], i, lv, levels = GAME.LEVELS || [];
  for (i = 0; i < levels.length; i++){
    lv = levels[i];
    opts.push({ id: String(lv.id), name: (lv.name || ('LEVEL ' + lv.id)) + ' · id ' + lv.id });
  }
  return opts;
}

function syncDoorPair(o){
  var S = runtime.W, pr;
  if (!S || !S.doors) return;
  pr = findById(S.doors, o.pair);
  if (!pr) return;
  pr.need = o.need;
  pr.consume = o.consume;
  pr.locked = o.locked;
}

function fillBody(sel){
  if (!body) return;
  body.textContent = '';
  var o = sel.obj;
  if (sel.type === 'player_start'){
    note(body, 'Level start. Only one — placing again moves it. Delete resets to the blank default.');
    return;
  }
  if (sel.type === 'level_exit'){
    note(body, 'Level transition. Multiple exits allowed. Empty target → MENU on CONTINUE.');
    select(body, 'Target level', levelOpts(),
      o.toId != null ? String(o.toId) : '',
      function(v){ o.toId = v === '' ? null : +v; },
      '');
    return;
  }
  if (sel.type === 'door'){
    note(body, o.pair >= 0
      ? ('Pair #' + (o.pair < o.id ? o.pair : o.id) + ' ↔ id ' + o.pair + '. Same color/badge; line links them. RMB/Delete removes both.')
      : 'Waiting for return door — click again to place the pair. Esc cancels.');
    select(body, 'Required item', bagItemOpts(),
      o.need || '',
      function(v){
        o.need = v === '' ? null : v;
        o.locked = !!o.need;
        if (o.need && o.consume == null) o.consume = true;
        syncDoorPair(o);
      },
      '');
    if (o.need){
      toggle(body, 'Consume item on activate', o.consume !== false, function(v){
        o.consume = v;
        syncDoorPair(o);
      });
    }
    return;
  }
  if (sel.type === 'sound'){
    var ds = DEF.sound;
    select(body, 'Mode', [
      { id: 'flat', name: 'Flat' },
      { id: 'falloff', name: 'Falloff' }
    ], o.mode || ds.mode, function(v){ o.mode = v; }, ds.mode);
    slider(body, 'Volume', 0, 1, 0.01, o.vol != null ? o.vol : ds.vol, function(v){ o.vol = v; }, ds.vol);
    slider(body, 'Radius', 16, 320, 1, o.radius || ds.radius, function(v){ o.radius = v; }, ds.radius);
    slider(body, 'Freq', 40, 880, 1, o.freq || ds.freq, function(v){ o.freq = v; }, ds.freq);
    select(body, 'Wave', [
      { id: 'sine', name: 'Sine' },
      { id: 'triangle', name: 'Triangle' },
      { id: 'square', name: 'Square' },
      { id: 'sawtooth', name: 'Saw' }
    ], o.type || ds.type, function(v){ o.type = v; }, ds.type);
  } else if (sel.type === 'light'){
    var dl = DEF.light;
    var sprOpts = [{ id: 'none', name: 'None' }];
    var defs = listSpriteDefs(), di;
    for (di = 0; di < defs.length; di++)
      sprOpts.push({ id: defs[di].id, name: defs[di].name });
    color(body, 'Color', o.color, function(v){ o.color = v; }, dl.color);
    slider(body, 'Intensity', 0, 2, 0.05, o.intensity != null ? o.intensity : dl.intensity, function(v){ o.intensity = v; }, dl.intensity);
    slider(body, 'Radius', 8, 200, 1, o.radius || dl.radius, function(v){ o.radius = v; }, dl.radius);
    select(body, 'Sprite', sprOpts, o.sprite || dl.sprite, function(v){
      o.sprite = v;
      o.lantern = v !== 'none';
    }, dl.sprite);
  } else if (sel.type === 'volume'){
    var dv = DEF.volume;
    select(body, 'Mode', [{ id: 'color', name: 'Color correct' }], o.mode || dv.mode, function(v){ o.mode = v; }, dv.mode);
    select(body, 'Mask', VOLUME_MASKS, o.mask || dv.mask, function(v){ o.mask = v; }, dv.mask);
    slider(body, 'Hue', -180, 180, 1, o.hue || 0, function(v){ o.hue = v; }, dv.hue);
    slider(body, 'Saturation', 0, 2, 0.05, o.sat != null ? o.sat : dv.sat, function(v){ o.sat = v; }, dv.sat);
    slider(body, 'Brightness', -1, 1, 0.05, o.bright || 0, function(v){ o.bright = v; }, dv.bright);
    slider(body, 'Contrast', 0, 2, 0.05, o.contrast != null ? o.contrast : dv.contrast, function(v){ o.contrast = v; }, dv.contrast);
    color(body, 'Tint', o.tint, function(v){ o.tint = v; }, dv.tint);
    slider(body, 'Tint amount', 0, 1, 0.01, o.tintAmt != null ? o.tintAmt : dv.tintAmt, function(v){ o.tintAmt = v; }, dv.tintAmt);
  } else if (sel.type === 'fx_sand'){
    var df = DEF.fx_sand;
    note(body, 'Continuous sand fall. Drag marker to move. Crumb tiles use the same particle API.');
    slider(body, 'Density', 0, 40, 0.5, o.density != null ? o.density : df.density, function(v){ o.density = v; }, df.density);
    slider(body, 'Speed', 0, 80, 1, o.speed != null ? o.speed : df.speed, function(v){ o.speed = v; }, df.speed);
    slider(body, 'Speed rand', 0, 80, 1, o.speedRand != null ? o.speedRand : df.speedRand, function(v){ o.speedRand = v; }, df.speedRand);
    color(body, 'Color', o.color || df.color, function(v){ o.color = v; }, df.color);
    slider(body, 'Life', 0.05, 2, 0.05, o.life != null ? o.life : df.life, function(v){ o.life = v; }, df.life);
    slider(body, 'Life rand', 0, 2, 0.05, o.lifeRand != null ? o.lifeRand : df.lifeRand, function(v){ o.lifeRand = v; }, df.lifeRand);
    slider(body, 'Gravity', 0, 160, 1, o.gravity != null ? o.gravity : df.gravity, function(v){ o.gravity = v; }, df.gravity);
    slider(body, 'Size', 1, 4, 1, o.size != null ? o.size : df.size, function(v){ o.size = v; }, df.size);
    slider(body, 'Spread', 0, 40, 1, o.spread != null ? o.spread : df.spread, function(v){ o.spread = v; }, df.spread);
    slider(body, 'Drag', 0, 8, 0.1, o.drag != null ? o.drag : df.drag, function(v){ o.drag = v; }, df.drag);
    slider(body, 'Lift', 0, 40, 1, o.lift != null ? o.lift : df.lift, function(v){ o.lift = v; }, df.lift);
  } else if (sel.type === 'plat'){
    var dp = DEF.plat;
    note(body, 'A/B — гизмо-ручки концов. A=min, B=max. Drag корпуса сдвигает весь путь.');
    slider(body, 'Width', 16, 96, 1, o.w != null ? o.w : dp.w, function(v){ o.w = v; }, dp.w);
    slider(body, 'Height', 4, 24, 1, o.h != null ? o.h : dp.h, function(v){ o.h = v; }, dp.h);
    slider(body, 'Speed', 8, 120, 1, o.v != null ? o.v : dp.v, function(v){ o.v = v; }, dp.v);
    slider(body, 'Pause A', 0, 5, 0.05, o.pause0 != null ? o.pause0 : dp.pause0, function(v){ o.pause0 = v; }, dp.pause0);
    slider(body, 'Pause B', 0, 5, 0.05, o.pause1 != null ? o.pause1 : dp.pause1, function(v){ o.pause1 = v; }, dp.pause1);
    select(body, 'Travel', [
      { id: 'pingpong', name: 'Two-way' },
      { id: 'oneway', name: 'One-way A→B' }
    ], o.travel || dp.travel, function(v){ o.travel = v; }, dp.travel);
    select(body, 'Loop', [
      { id: 'infinite', name: 'Infinite' },
      { id: 'once', name: 'Once' }
    ], o.loop || dp.loop, function(v){ o.loop = v; o.done = false; }, dp.loop);
    select(body, 'Trigger', [
      { id: 'auto', name: 'Auto' },
      { id: 'ride', name: 'Only when stood on' }
    ], o.trigger || dp.trigger, function(v){ o.trigger = v; }, dp.trigger);
    select(body, 'On leave', [
      { id: 'continue', name: 'Keep moving' },
      { id: 'return', name: 'Return to A' },
      { id: 'stop', name: 'Stop where left' }
    ], o.onLeave || dp.onLeave, function(v){ o.onLeave = v; }, dp.onLeave);
  } else if (sel.type === 'lift'){
    var dl = DEF.lift;
    var defV = C.LIFT_V, defD = C.LIFT_DWELL;
    note(body, 'Этажи — ручки на шахте. Call = ↑↓ в кабине / вызов с этажа.');
    slider(body, 'Width', 32, 80, 1, o.w != null ? o.w : dl.w, function(v){ o.w = v; }, dl.w);
    slider(body, 'Cabin H', 24, 56, 1, o.hh != null ? o.hh : dl.hh, function(v){ o.hh = v; }, dl.hh);
    slider(body, 'Speed', 12, 100, 1, o.v != null ? o.v : defV, function(v){ o.v = v; }, defV);
    slider(body, 'Dwell', 0, 5, 0.05, o.dwell != null ? o.dwell : defD, function(v){ o.dwell = v; }, defD);
    select(body, 'Travel', [
      { id: 'pingpong', name: 'Two-way' },
      { id: 'oneway', name: 'One-way up' }
    ], o.travel || dl.travel, function(v){ o.travel = v; }, dl.travel);
    select(body, 'Loop', [
      { id: 'infinite', name: 'Infinite' },
      { id: 'once', name: 'Once' }
    ], o.loop || dl.loop, function(v){ o.loop = v; o.done = false; }, dl.loop);
    select(body, 'Trigger', [
      { id: 'call', name: 'Call (↑↓)' },
      { id: 'auto', name: 'Auto' },
      { id: 'ride', name: 'Only with rider' }
    ], o.trigger || dl.trigger, function(v){ o.trigger = v; }, dl.trigger);
    select(body, 'On leave', [
      { id: 'stay', name: 'Stay' },
      { id: 'return', name: 'Return home' }
    ], o.onLeave || dl.onLeave, function(v){ o.onLeave = v; }, dl.onLeave);
    var floorOpts = [];
    for (var fi = 0; fi < (o.floors || []).length; fi++)
      floorOpts.push({ id: String(fi), name: 'Floor ' + fi + ' (y ' + Math.round(o.floors[fi]) + ')' });
    if (!floorOpts.length) floorOpts.push({ id: '0', name: 'Floor 0' });
    select(body, 'Home floor', floorOpts,
      String(o.homeIdx != null ? o.homeIdx : 0),
      function(v){ o.homeIdx = +v; },
      '0');
    var row = document.createElement('div');
    row.className = 'ed-field';
    var addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'edb'; addBtn.textContent = '+ Floor';
    addBtn.addEventListener('click', function(){
      touchOp();
      var fl = o.floors || [];
      var top = fl.length ? Math.min.apply(null, fl) : o.y;
      fl.push(top - (dl.floorSpan || 6) * T);
      o.floors = fl;
      syncLiftFloors(o);
      var S = runtime.W; if (S) GAME.buildGates(S);
      notify(); showInspect(current);
    });
    var rmBtn = document.createElement('button');
    rmBtn.type = 'button'; rmBtn.className = 'edb'; rmBtn.textContent = '− Floor';
    rmBtn.addEventListener('click', function(){
      if (!o.floors || o.floors.length <= 2) return;
      touchOp();
      o.floors.pop();
      syncLiftFloors(o);
      var S2 = runtime.W; if (S2) GAME.buildGates(S2);
      notify(); showInspect(current);
    });
    row.appendChild(addBtn);
    row.appendChild(document.createTextNode(' '));
    row.appendChild(rmBtn);
    body.appendChild(row);
  }
}

var closeBtn = document.getElementById('edInspectX');
if (closeBtn) closeBtn.addEventListener('click', function(){
  showInspect(null);
  if (onClose) onClose();
});
