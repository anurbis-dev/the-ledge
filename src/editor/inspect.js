import { VOLUME_MASKS } from '../entities/volumes.js';
import { initSliders, bindResetHover } from './slider.js';
import { touchOp } from './history.js';
import { raiseFloat, placeFloat, hasFloatPos } from './float.js';

var DEF = {
  sound: { mode: 'falloff', vol: 0.4, radius: 96, freq: 220, type: 'sine' },
  light: { color: '#ffbe74', intensity: 1, radius: 82 },
  volume: { mode: 'color', mask: 'circle', hue: 0, sat: 1, bright: 0, contrast: 1, tint: '#88a0ff', tintAmt: 0.15 }
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
  if (titleEl) titleEl.textContent = sel.type === 'volume' ? 'Volume' : (sel.type === 'light' ? 'Light' : 'Sound');
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

function fillBody(sel){
  if (!body) return;
  body.textContent = '';
  var o = sel.obj;
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
    color(body, 'Color', o.color, function(v){ o.color = v; }, dl.color);
    slider(body, 'Intensity', 0, 2, 0.05, o.intensity != null ? o.intensity : dl.intensity, function(v){ o.intensity = v; }, dl.intensity);
    slider(body, 'Radius', 8, 200, 1, o.radius || dl.radius, function(v){ o.radius = v; }, dl.radius);
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
  }
}

var closeBtn = document.getElementById('edInspectX');
if (closeBtn) closeBtn.addEventListener('click', function(){
  showInspect(null);
  if (onClose) onClose();
});
