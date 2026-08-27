import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';

var root = document.getElementById('edEnemySettings');
var body = document.getElementById('edEnemySettingsBody');
var current = null;
var onChange = null;

export function bindEnemySettings(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

export function closeEnemySettings(){
  if (!root || root.hidden) return;
  root.hidden = true;
  current = null;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeEnemySettings();
}

export function openEnemySettings(e, clientX, clientY){
  if (!root || !e) return;
  current = e;
  fill();
  root.hidden = false;
  if (!hasFloatPos(root)) placeFloat(root, clientX != null ? clientX : 80, clientY != null ? clientY : 80);
  raiseFloat(root);
  document.removeEventListener('pointerdown', onOutside, true);
  setTimeout(function(){ document.addEventListener('pointerdown', onOutside, true); }, 0);
}

function resetAiRuntime(e){
  e.x0 = Math.min.apply(null, e.points);
  e.x1 = Math.max.apply(null, e.points);
  e.aiState = 'patrol'; e.ptIdx = 0; e.ptDir = 1; e.pauseT = 0;
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

function toggle(parent, label, val, set){
  var row = document.createElement('label');
  row.className = 'ed-field';
  var inp = document.createElement('input');
  inp.type = 'checkbox';
  inp.checked = !!val;
  inp.addEventListener('change', function(){ touchOp(); set(!!inp.checked); notify(); fill(); });
  row.appendChild(inp);
  row.appendChild(document.createTextNode(' ' + label));
  parent.appendChild(row);
}

function pointsSection(parent, e){
  var head = document.createElement('div');
  head.className = 'ed-tile-note';
  head.textContent = 'Patrol points';
  parent.appendChild(head);
  e.points.forEach(function(pt, i){
    var row = document.createElement('div');
    row.className = 'ed-loot-row';
    var xInp = document.createElement('input');
    xInp.type = 'number'; xInp.step = '1'; xInp.value = String(Math.round(pt));
    xInp.style.width = '64px';
    xInp.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    xInp.addEventListener('change', function(){
      touchOp();
      e.points[i] = +xInp.value || 0;
      resetAiRuntime(e);
      notify();
    });
    row.appendChild(xInp);
    var pauseInp = document.createElement('input');
    pauseInp.type = 'number'; pauseInp.step = '0.1'; pauseInp.min = '0';
    pauseInp.value = String(e.pointPause[i] || 0);
    pauseInp.title = 'Pause, s';
    pauseInp.style.width = '56px';
    pauseInp.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    pauseInp.addEventListener('change', function(){
      touchOp();
      e.pointPause[i] = Math.max(0, +pauseInp.value || 0);
      notify();
    });
    row.appendChild(pauseInp);
    var del = document.createElement('button');
    del.type = 'button'; del.className = 'edb'; del.textContent = '×';
    del.disabled = e.points.length <= 2;
    del.addEventListener('click', function(ev){
      ev.stopPropagation();
      if (e.points.length <= 2) return;
      touchOp();
      e.points.splice(i, 1);
      e.pointPause.splice(i, 1);
      resetAiRuntime(e);
      notify();
      fill();
    });
    row.appendChild(del);
    parent.appendChild(row);
  });
  var addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'edb'; addBtn.textContent = '+ Point';
  addBtn.addEventListener('click', function(){
    touchOp();
    var last = e.points[e.points.length - 1];
    e.points.push(last + 40);
    e.pointPause.push(0);
    resetAiRuntime(e);
    notify();
    fill();
  });
  parent.appendChild(addBtn);
}

function fill(){
  if (!body || !current) return;
  body.textContent = '';
  var e = current;
  slider(body, 'Walk speed', 8, 80, 1, e.v, function(v){ e.v = v; }, 26);
  pointsSection(body, e);
  toggle(body, 'Can chase', e.canChase, function(v){ e.canChase = v; });
  if (e.canChase){
    slider(body, 'Chase speed', 20, 160, 1, e.chaseV, function(v){ e.chaseV = v; }, Math.round(e.v * 1.6));
    slider(body, 'Sight range', 16, 200, 1, e.sightFwd, function(v){ e.sightFwd = v; }, 90);
    slider(body, 'Hear range', 0, 160, 1, e.hearBack, function(v){ e.hearBack = v; }, 50);
  }
}

var closeBtn = document.getElementById('edEnemySettingsX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeEnemySettings(); });
