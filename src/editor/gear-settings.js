import GAME from '../core/game.js';
import { markLevelDirty } from '../core/persist.js';
import { GEAR, WEAPON_TYPES } from '../entities/gear.js';
import { initSliders } from './slider.js';

var host = null;
var NAME = { stick: 'STICK', spear: 'SPEAR', sword: 'SWORD', blade: 'BLADE', bow: 'BOW', harpoon: 'HARPOON' };

export function bindGearPanel(){
  host = document.getElementById('edGear');
}

function row(parent, lv, type){
  var def = GEAR[type].uses;
  var ov = lv.gearDurability || (lv.gearDurability = {});
  var val = ov[type] != null ? ov[type] : def;
  var wrap = document.createElement('label');
  wrap.className = 'slider-wrap';
  wrap.title = '0 = unbreakable';
  wrap.innerHTML = '<div class="slider-label-overlay"><span>' + (NAME[type] || type.toUpperCase()) +
    '</span><span></span></div>';
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = 0; inp.max = 60; inp.step = 1;
  inp.value = val;
  inp.dataset.default = String(def);
  inp.addEventListener('input', function(){
    ov[type] = +inp.value;
    markLevelDirty();
  });
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  initSliders(wrap);
}

export function renderGearPanel(){
  if (!host) host = document.getElementById('edGear');
  if (!host) return;
  host.textContent = '';
  var lv = GAME.levelSpec();
  if (!lv) return;

  var sec = document.createElement('section');
  sec.className = 'ed-pg';
  var h = document.createElement('h4');
  h.className = 'ed-pg-title';
  h.textContent = 'Weapon durability';
  sec.appendChild(h);
  var hint = document.createElement('div');
  hint.className = 'ed-pg-empty';
  hint.textContent = 'Hits/shots before it breaks. 0 = unbreakable.';
  sec.appendChild(hint);
  for (var i = 0; i < WEAPON_TYPES.length; i++) row(sec, lv, WEAPON_TYPES[i]);
  host.appendChild(sec);
}
