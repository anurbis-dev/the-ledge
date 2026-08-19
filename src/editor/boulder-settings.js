import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';
import { BOULDER_DEF } from '../entities/boulders.js';

var root = document.getElementById('edBoulderSettings');
var body = document.getElementById('edBoulderSettingsBody');
var current = null;
var onChange = null;

export function bindBoulderSettings(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

export function closeBoulderSettings(){
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeBoulderSettings();
}

export function openBoulderSettings(b, clientX, clientY){
  if (!root || !b) return;
  current = b;
  fill();
  root.hidden = false;
  if (!hasFloatPos(root)) placeFloat(root, clientX != null ? clientX : 80, clientY != null ? clientY : 80);
  raiseFloat(root);
  document.removeEventListener('pointerdown', onOutside, true);
  setTimeout(function(){ document.addEventListener('pointerdown', onOutside, true); }, 0);
}

function slider(parent, label, min, max, step, val, set, def){
  var wrap = document.createElement('label');
  wrap.className = 'slider-wrap';
  wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
  inp.value = val;
  inp.dataset.default = String(def);
  inp.addEventListener('input', function(){ touchOp(); set(+inp.value); notify(); });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

function fill(){
  if (!body || !current) return;
  body.textContent = '';
  var b = current;
  slider(body, 'Push speed', 4, 60, 1,
    b.pushV != null ? b.pushV : BOULDER_DEF.pushV,
    function(v){ b.pushV = v; }, BOULDER_DEF.pushV);
  slider(body, 'Friction', 20, 300, 5,
    b.friction != null ? b.friction : BOULDER_DEF.friction,
    function(v){ b.friction = v; }, BOULDER_DEF.friction);
  slider(body, 'Max roll speed', 20, 200, 5,
    b.rollMax != null ? b.rollMax : BOULDER_DEF.rollMax,
    function(v){ b.rollMax = v; }, BOULDER_DEF.rollMax);
}

var closeBtn = document.getElementById('edBoulderSettingsX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeBoulderSettings(); });
