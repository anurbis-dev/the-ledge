import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';
import { VEHICLE_DEF } from '../entities/vehicles.js';

var root = document.getElementById('edVehicleSettings');
var body = document.getElementById('edVehicleSettingsBody');
var current = null;
var onChange = null;

export function bindVehicleSettings(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

export function closeVehicleSettings(){
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeVehicleSettings();
}

export function openVehicleSettings(v, clientX, clientY){
  if (!root || !v) return;
  current = v;
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
  var v = current;
  slider(body, 'Contact damage', 0, 5, 1,
    v.dmg != null ? v.dmg : VEHICLE_DEF.dmg,
    function(x){ v.dmg = x; }, VEHICLE_DEF.dmg);
  slider(body, 'Speed multiplier', 0.5, 3, 0.1,
    v.speedMul != null ? v.speedMul : VEHICLE_DEF.speedMul,
    function(x){ v.speedMul = x; }, VEHICLE_DEF.speedMul);
}

var closeBtn = document.getElementById('edVehicleSettingsX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeVehicleSettings(); });
