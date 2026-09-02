import GAME from '../core/game.js';
import { markLevelDirty } from '../core/persist.js';
import {
  getIntroLines, setIntroLineAt, addIntroLine, removeIntroLine, resetIntroLines
} from '../core/intro.js';
import { initSliders } from './slider.js';

var host = null;

export function bindIntroPanel(){
  host = document.getElementById('edIntro');
}

export function renderIntroPanel(){
  if (!host) host = document.getElementById('edIntro');
  if (!host) return;
  host.textContent = '';
  var lv = GAME.levelSpec();

  var secLv = document.createElement('section');
  secLv.className = 'ed-pg';
  var hLv = document.createElement('h4');
  hLv.className = 'ed-pg-title';
  hLv.textContent = 'This level';
  secLv.appendChild(hLv);
  var hint = document.createElement('div');
  hint.className = 'ed-pg-empty';
  hint.textContent = 'Empty = random from the pool';
  secLv.appendChild(hint);
  var lvInp = document.createElement('input');
  lvInp.type = 'text';
  lvInp.className = 'ed-intro-in';
  lvInp.maxLength = 36;
  lvInp.placeholder = 'Random from pool';
  lvInp.value = (lv && lv.intro) || '';
  lvInp.spellcheck = false;
  lvInp.addEventListener('input', function(){
    if (!lv) return;
    lv.intro = lvInp.value;
    markLevelDirty();
  });
  secLv.appendChild(lvInp);

  var zWrap = document.createElement('div');
  zWrap.className = 'slider-wrap';
  zWrap.title = 'camZoom — общий зум камеры уровня: насколько крупно рисуются мировые пиксели на экране. 100% = обычный размер, меньше — видно больше мира, больше — крупнее пиксели/меньше обзор.';
  var zOver = document.createElement('div');
  zOver.className = 'slider-label-overlay';
  var zLab = document.createElement('span');
  zLab.textContent = 'Camera zoom';
  var zVal = document.createElement('span');
  zOver.appendChild(zLab); zOver.appendChild(zVal);
  var zInp = document.createElement('input');
  zInp.type = 'range'; zInp.min = '25'; zInp.max = '400'; zInp.step = '5';
  zInp.value = String((lv && lv.camZoom) || 100);
  zInp.dataset.default = '100';
  zInp.addEventListener('input', function(){
    if (!lv) return;
    lv.camZoom = +zInp.value;
    markLevelDirty();
  });
  zWrap.appendChild(zOver);
  zWrap.appendChild(zInp);
  secLv.appendChild(zWrap);

  host.appendChild(secLv);

  var sec = document.createElement('section');
  sec.className = 'ed-pg';
  var head = document.createElement('div');
  head.className = 'ed-intro-head';
  var h = document.createElement('h4');
  h.className = 'ed-pg-title';
  h.textContent = 'Pool';
  head.appendChild(h);
  var acts = document.createElement('div');
  acts.className = 'ed-head-acts';
  var add = document.createElement('button');
  add.type = 'button';
  add.className = 'edb';
  add.textContent = '+';
  add.title = 'Add phrase';
  add.addEventListener('click', function(){
    addIntroLine('');
    renderIntroPanel();
    var list = host.querySelectorAll('.ed-intro-in');
    var last = list[list.length - 1];
    if (last) last.focus();
  });
  var rst = document.createElement('button');
  rst.type = 'button';
  rst.className = 'edb';
  rst.textContent = 'Reset';
  rst.title = 'Restore default pool';
  rst.addEventListener('click', function(){
    resetIntroLines();
    renderIntroPanel();
  });
  acts.appendChild(add);
  acts.appendChild(rst);
  head.appendChild(acts);
  sec.appendChild(head);

  var lines = getIntroLines();
  for (var i = 0; i < lines.length; i++){
    (function(idx){
      var row = document.createElement('div');
      row.className = 'ed-intro-row';
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'ed-intro-in';
      inp.maxLength = 36;
      inp.value = lines[idx];
      inp.spellcheck = false;
      inp.addEventListener('input', function(){ setIntroLineAt(idx, inp.value); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'edb';
      del.title = 'Remove';
      del.textContent = '×';
      del.addEventListener('click', function(){
        removeIntroLine(idx);
        renderIntroPanel();
      });
      row.appendChild(inp);
      row.appendChild(del);
      sec.appendChild(row);
    })(i);
  }
  if (!lines.length){
    var empty = document.createElement('div');
    empty.className = 'ed-pg-empty';
    empty.textContent = 'Pool is empty — random uses built-in defaults';
    sec.appendChild(empty);
  }
  host.appendChild(sec);
  initSliders(host);
}
