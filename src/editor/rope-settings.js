import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';
import { ROPE_DEF, rebuildRope } from '../entities/ropes.js';

var root = document.getElementById('edRopeSettings');
var body = document.getElementById('edRopeSettingsBody');
var titleEl = document.getElementById('edRopeSettingsTitle');
var current = null;
var onChange = null;

export function bindRopeSettings(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

export function closeRopeSettings(){
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeRopeSettings();
}

export function openRopeSettings(r, clientX, clientY){
  if (!root || !r) return;
  current = r;
  if (titleEl) titleEl.textContent = r.orient === 'h' ? 'Rope H' : 'Rope V';
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
  inp.addEventListener('input', function(){
    touchOp();
    set(+inp.value);
    rebuildRope(current);
    notify();
  });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

function fill(){
  if (!body || !current) return;
  body.textContent = '';
  var r = current;
  slider(body, 'Segments', 4, 24, 1,
    r.segs != null ? r.segs : ROPE_DEF.segs,
    function(v){ r.segs = v | 0; }, ROPE_DEF.segs);
  slider(body, 'Elasticity', 0, 0.5, 0.01,
    r.elasticity != null ? r.elasticity : ROPE_DEF.elasticity,
    function(v){ r.elasticity = v; }, ROPE_DEF.elasticity);
  if (r.orient !== 'h'){
    slider(body, 'Swing force', 40, 400, 5,
      r.swingForce != null ? r.swingForce : ROPE_DEF.swingForce,
      function(v){ r.swingForce = v; }, ROPE_DEF.swingForce);
  }
  slider(body, 'Wind', 0, 8, 0.1,
    r.wind != null ? r.wind : ROPE_DEF.wind,
    function(v){ r.wind = v; }, ROPE_DEF.wind);
  slider(body, 'Climb speed', 20, 120, 1,
    r.climbV != null ? r.climbV : ROPE_DEF.climbV,
    function(v){ r.climbV = v; }, ROPE_DEF.climbV);
  slider(body, 'Grab radius', 6, 28, 1,
    r.grabR != null ? r.grabR : ROPE_DEF.grabR,
    function(v){ r.grabR = v; }, ROPE_DEF.grabR);
}

var closeBtn = document.getElementById('edRopeSettingsX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeRopeSettings(); });
