/* Per-level оверрайд движения героини — плавающая панель по образцу
   vehicle-settings.js/boulder-settings.js, но без "current"-объекта: всегда
   читает/пишет runtime.LV.spawn.moveParams (одна героиня на уровень).
   Значения — diff от текущих ГЛОБАЛЬНЫХ C.* (editor/params.js), т.е. оверрайд
   работает относительно них, а не относительно зашитых в код дефолтов. */
import { touchOp } from './history.js';
import { placeFloat, hasFloatPos, raiseFloat } from './float.js';
import { initSliders } from './slider.js';
import { C } from '../core/constants.js';
import GAME from '../core/game.js';
import { runtime } from '../core/runtime.js';
import { HERO_MOVE_KEYS } from '../core/hero-move.js';
import { PARAM_GROUPS } from './params.js';

var root = document.getElementById('edHeroMoveSettings');
var body = document.getElementById('edHeroMoveSettingsBody');
var onChange = null;

export function bindHeroMoveSettings(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  if (onChange) onChange();
}

export function closeHeroMoveSettings(){
  if (!root || root.hidden) return;
  root.hidden = true;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e){
  if (root && !root.contains(e.target)) closeHeroMoveSettings();
}

export function openHeroMoveSettings(clientX, clientY){
  if (!root) return;
  fill();
  root.hidden = false;
  if (!hasFloatPos(root)) placeFloat(root, clientX != null ? clientX : 80, clientY != null ? clientY : 80);
  raiseFloat(root);
  document.removeEventListener('pointerdown', onOutside, true);
  setTimeout(function(){ document.addEventListener('pointerdown', onOutside, true); }, 0);
}

function moveParams(){
  var spawn = runtime.LV && runtime.LV.spawn;
  if (!spawn) return null;
  if (!spawn.moveParams) spawn.moveParams = {};
  return spawn.moveParams;
}

function applyHeroMoveOverride(key, val){
  var mp = moveParams();
  if (!mp) return;
  if (val === C[key]) delete mp[key];
  else mp[key] = val;
  var p = GAME.W && GAME.W.p;
  if (p && p.mv) p.mv[key] = val;                   // мгновенный фидбек в test-play
}

function slider(parent, item){
  var wrap = document.createElement('label');
  wrap.className = 'slider-wrap';
  wrap.title = item.key + (item.hint ? ' — ' + item.hint : '');
  wrap.innerHTML = '<div class="slider-label-overlay"><span>' + item.label + '</span><span></span></div>';
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = item.min; inp.max = item.max; inp.step = item.step;
  var mp = moveParams();
  var cur = (mp && typeof mp[item.key] === 'number') ? mp[item.key] : C[item.key];
  inp.value = cur;
  inp.dataset.default = String(C[item.key]);
  inp.addEventListener('input', function(){ touchOp(); applyHeroMoveOverride(item.key, +inp.value); notify(); });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

function fill(){
  if (!body) return;
  body.textContent = '';
  var note = document.createElement('div');
  note.className = 'ed-tile-note';
  note.textContent = 'Оверрайд для этого уровня поверх общих настроек (Params). Совпадает с ними, пока слайдер не тронут; сброс к дефолту убирает оверрайд.';
  body.appendChild(note);
  var g, group, i, item;
  for (g = 0; g < PARAM_GROUPS.length; g++){
    group = PARAM_GROUPS[g];
    var items = [];
    for (i = 0; i < group.items.length; i++){
      item = group.items[i];
      if (HERO_MOVE_KEYS.indexOf(item.key) >= 0) items.push(item);
    }
    if (!items.length) continue;
    var h = document.createElement('h4');
    h.className = 'ed-pg-title';
    h.textContent = group.name;
    body.appendChild(h);
    for (i = 0; i < items.length; i++) slider(body, items[i]);
  }
}

var closeBtn = document.getElementById('edHeroMoveSettingsX');
if (closeBtn) closeBtn.addEventListener('click', function(){ closeHeroMoveSettings(); });
