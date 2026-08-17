import GAME from '../core/game.js';

var G = GAME;
var PKEY = 'ledge.progress.v1';

export function loadProgress(){
  try {
    var raw = localStorage.getItem(PKEY);
    if (raw){ var o = JSON.parse(raw); if (o && typeof o.max === 'number') return o; }
  } catch (e) {}
  return { max: 0, done: {} };            // max — индекс последнего открытого уровня
}
export function saveProgress(){
  try { localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {}
}

export var prog = loadProgress();
var inMenu = true;
var startLevelCb = null;
var menuEl = document.getElementById('menu'), listEl = document.getElementById('mlist');

export function isMenu(){ return inMenu; }
export function setMenu(v){
  inMenu = !!v;
  if (inMenu) menuEl.classList.remove('hide');
  else menuEl.classList.add('hide');
}

export function buildMenu(onStart){
  if (typeof onStart === 'function') startLevelCb = onStart;
  listEl.textContent = '';
  for (var i = 0; i < G.LEVELS.length; i++){
    (function(idx){
      var lv = G.LEVELS[idx];
      var open = idx <= prog.max || !!lv.blank;
      var row = document.createElement('div');
      row.className = 'mrow' + (open ? ' on' : ' lock') + (prog.done[idx] ? ' done' : '');
      var num = document.createElement('div');
      num.className = 'mnum'; num.textContent = prog.done[idx] ? '✓' : (idx + 1);
      var name = document.createElement('div');
      name.textContent = open ? lv.name : '— locked —';
      row.appendChild(num); row.appendChild(name);
      if (open) row.addEventListener('click', function(){
        if (startLevelCb) startLevelCb(idx);
      });
      listEl.appendChild(row);
    })(i);
  }
  var add = document.createElement('div');
  add.className = 'mrow on';
  add.id = 'mNew';
  var plus = document.createElement('div');
  plus.className = 'mnum'; plus.textContent = '+';
  var lab = document.createElement('div');
  lab.textContent = 'New Level';
  add.appendChild(plus); add.appendChild(lab);
  add.addEventListener('click', function(){
    var idx = G.newBlankLevel();
    prog.max = Math.max(prog.max, idx);
    saveProgress();
    if (startLevelCb) startLevelCb(idx);
  });
  listEl.appendChild(add);
}
export function showMenu(){
  setMenu(true); buildMenu();
}
