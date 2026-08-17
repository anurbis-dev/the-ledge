import { VOLUME_MASKS } from '../entities/volumes.js';
import { initSliders } from './slider.js';

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
}

function notify(){
  if (onChange) onChange();
}

function slider(parent, label, min, max, step, val, set){
  var wrap = document.createElement('label');
  wrap.className = 'slider-wrap';
  wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
  inp.value = val; inp.dataset.default = String(val);
  inp.addEventListener('input', function(){ set(+inp.value); notify(); });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

function select(parent, label, opts, val, set){
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
  s.addEventListener('change', function(){ set(s.value); notify(); showInspect(current); });
  row.appendChild(s);
  parent.appendChild(row);
}

function color(parent, label, val, set){
  var row = document.createElement('label');
  row.className = 'ed-field';
  row.textContent = label + ' ';
  var inp = document.createElement('input');
  inp.type = 'color'; inp.value = toHex(val);
  inp.addEventListener('input', function(){ set(inp.value); notify(); });
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
    select(body, 'Mode', [
      { id: 'flat', name: 'Flat' },
      { id: 'falloff', name: 'Falloff' }
    ], o.mode || 'falloff', function(v){ o.mode = v; });
    slider(body, 'Volume', 0, 1, 0.01, o.vol != null ? o.vol : 0.4, function(v){ o.vol = v; });
    slider(body, 'Radius', 16, 320, 1, o.radius || 96, function(v){ o.radius = v; });
    slider(body, 'Freq', 40, 880, 1, o.freq || 220, function(v){ o.freq = v; });
    select(body, 'Wave', [
      { id: 'sine', name: 'Sine' },
      { id: 'triangle', name: 'Triangle' },
      { id: 'square', name: 'Square' },
      { id: 'sawtooth', name: 'Saw' }
    ], o.type || 'sine', function(v){ o.type = v; });
  } else if (sel.type === 'light'){
    color(body, 'Color', o.color, function(v){ o.color = v; });
    slider(body, 'Intensity', 0, 2, 0.05, o.intensity != null ? o.intensity : 1, function(v){ o.intensity = v; });
    slider(body, 'Radius', 8, 200, 1, o.radius || 82, function(v){ o.radius = v; });
  } else if (sel.type === 'volume'){
    select(body, 'Mode', [{ id: 'color', name: 'Color correct' }], o.mode || 'color', function(v){ o.mode = v; });
    select(body, 'Mask', VOLUME_MASKS, o.mask || 'circle', function(v){ o.mask = v; });
    slider(body, 'Hue', -180, 180, 1, o.hue || 0, function(v){ o.hue = v; });
    slider(body, 'Saturation', 0, 2, 0.05, o.sat != null ? o.sat : 1, function(v){ o.sat = v; });
    slider(body, 'Brightness', -1, 1, 0.05, o.bright || 0, function(v){ o.bright = v; });
    slider(body, 'Contrast', 0, 2, 0.05, o.contrast != null ? o.contrast : 1, function(v){ o.contrast = v; });
    color(body, 'Tint', o.tint, function(v){ o.tint = v; });
    slider(body, 'Tint amount', 0, 1, 0.01, o.tintAmt || 0, function(v){ o.tintAmt = v; });
  }
}

var closeBtn = document.getElementById('edInspectX');
if (closeBtn) closeBtn.addEventListener('click', function(){
  showInspect(null);
  if (onClose) onClose();
});
