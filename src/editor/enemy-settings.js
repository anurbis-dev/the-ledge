import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';
import { paintObjIcon } from './thumbs.js';
import { resyncEnemyRuntime } from '../entities/enemies.js';

var LOOT_NAMES = { key:'Key', coin:'Coin', gem:'Gem', shroom:'Shroom', helmet:'Helmet',
                    shield:'Shield', sword:'Sword', scuba:'Scuba', flippers:'Flippers',
                    harpoon:'Harpoon', bow:'Bow', pickaxe:'Pickaxe' };

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

function lootIcon(kind, size){
  var c = document.createElement('canvas');
  c.width = size; c.height = size;
  var cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  paintObjIcon(cx, kind, size);
  c.className = 'ed-swatch-img';
  c.style.width = size + 'px'; c.style.height = size + 'px';
  return c;
}

function lootSection(parent, e){
  var loot = e.loot || [];
  if (loot.length > 1){
    var randRow = document.createElement('label');
    randRow.className = 'ed-check';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!e.random;
    cb.addEventListener('change', function(){ touchOp(); e.random = cb.checked; notify(); });
    randRow.appendChild(cb);
    var rl = document.createElement('span');
    rl.textContent = 'Random — drop only one';
    randRow.appendChild(rl);
    parent.appendChild(randRow);
  }
  if (!loot.length){
    var empty = document.createElement('div');
    empty.className = 'ed-loot-empty';
    empty.textContent = 'No loot — drag items onto the enemy';
    parent.appendChild(empty);
    return;
  }
  loot.forEach(function(entry){
    var row = document.createElement('div');
    row.className = 'ed-loot-row';
    row.appendChild(lootIcon(entry.kind, 18));
    var name = document.createElement('span');
    name.className = 'ed-loot-name';
    name.textContent = LOOT_NAMES[entry.kind] || entry.kind;
    row.appendChild(name);
    var qtyInp = document.createElement('input');
    qtyInp.type = 'number'; qtyInp.min = '1'; qtyInp.max = '99'; qtyInp.value = String(entry.qty);
    qtyInp.addEventListener('keydown', function(ev){ ev.stopPropagation(); });
    qtyInp.addEventListener('change', function(){
      touchOp();
      entry.qty = Math.max(1, Math.min(99, +qtyInp.value || 1));
      notify();
      qtyInp.value = String(entry.qty);
    });
    row.appendChild(qtyInp);
    var del = document.createElement('button');
    del.type = 'button'; del.className = 'edb'; del.textContent = '×';
    del.addEventListener('click', function(ev){
      ev.stopPropagation();
      touchOp();
      e.loot = e.loot.filter(function(en){ return en !== entry; });
      notify();
      fill();
    });
    row.appendChild(del);
    parent.appendChild(row);
  });
}

function pointsSection(parent, e){
  var head = document.createElement('div');
  head.className = 'ed-tile-note';
  head.textContent = 'Patrol points — drag the markers on the map to move them';
  parent.appendChild(head);
  e.points.forEach(function(pt, i){
    var row = document.createElement('div');
    row.className = 'ed-loot-row';
    var name = document.createElement('span');
    name.className = 'ed-loot-name';
    name.textContent = 'Point ' + (i + 1);
    row.appendChild(name);
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
      resyncEnemyRuntime(e);
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
    resyncEnemyRuntime(e);
    notify();
    fill();
  });
  parent.appendChild(addBtn);
}

function fill(){
  if (!body || !current) return;
  body.textContent = '';
  var e = current;
  lootSection(body, e);
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
