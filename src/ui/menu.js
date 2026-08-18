import GAME from '../core/game.js';
import { APP_VERSION, formatAppVersion } from '../core/version.js';
import { getMix } from '../audio/music.js';
import { loadTalkPrefs } from '../audio/talk.js';
import { loadSettings, applySettings, clampPct } from './settings.js';

export { applyBootSettings, getFxVol } from './settings.js';

var G = GAME;
var PKEY = 'ledge.progress.v1';


var FLAME = '<svg class="flame-ic" viewBox="0 0 11 14" fill="none" aria-hidden="true"><path d="M5.5 0c0 2.5 2.5 3.7 2.5 6.4 0 2.2-1.2 4.2-2.5 5.8 1.3-1.7 1.4-3.2.5-4.8-.3 1.7-1.4 2.7-2.7 3.5C2 9.9 1 8.3 1 6.6 1 4.2 2.5 3 2.5 1.5c.9 1 1.4 2 1.3 3C4.7 3.2 5.5 1.7 5.5 0Z" fill="currentColor"/></svg>';
var CHEV = '<svg class="map-ic" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M2 1l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function loadProgress(){
  try {
    var raw = localStorage.getItem(PKEY);
    if (raw){ var o = JSON.parse(raw); if (o && typeof o.max === 'number') return o; }
  } catch (e) {}
  return { max: 0, done: {} };
}
export function saveProgress(){
  try { localStorage.setItem(PKEY, JSON.stringify(prog)); } catch (e) {}
}



export var prog = loadProgress();
var inMenu = true;
var screen = 'home';
var startLevelCb = null;
var deleteLevelCb = null;
var resumeCb = null;
var canResumeFn = null;
var menuEl = document.getElementById('menu');
var listEl = document.getElementById('mlist');
var homeEl = document.getElementById('mHome');
var emberCv = document.getElementById('mEmbers');
var emberRaf = 0;
var emberPts = [];

export function isMenu(){ return inMenu; }
export function menuScreen(){ return screen; }
export function setMenu(v){
  inMenu = !!v;
  if (inMenu){
    menuEl.classList.remove('hide');
    if (document.body) document.body.classList.add('hide-pad');
    startEmbers();
  } else {
    menuEl.classList.add('hide');
    stopEmbers();
  }
}

export function dropProgressAt(idx){
  var nd = {}, k, i;
  for (k in prog.done){
    i = +k;
    if (i === idx) continue;
    nd[i > idx ? i - 1 : i] = prog.done[k];
  }
  prog.done = nd;
  if (prog.max > idx) prog.max--;
  else if (prog.max === idx) prog.max = Math.max(0, prog.max - 1);
  saveProgress();
}

function canResume(){
  return !!(canResumeFn && canResumeFn());
}

function showScreen(name){
  screen = name || 'home';
  menuEl.setAttribute('data-screen', screen);
  var panes = { home: 'mHome', path: 'mPath', settings: 'mSettings', credits: 'mCredits' };
  var id, el;
  for (id in panes){
    el = document.getElementById(panes[id]);
    if (!el) continue;
    if (id === screen) el.classList.remove('hide');
    else el.classList.add('hide');
  }
}

export function showMenuHome(){
  showScreen('home');
  buildHome();
}

function mkRow(label, extraHtml, cls){
  var row = document.createElement('div');
  row.className = 'mrow on' + (cls ? ' ' + cls : '');
  row.tabIndex = 0;
  row.innerHTML = FLAME + '<div class="mname">' + label + '</div>' + (extraHtml || '');
  return row;
}

function buildHome(){
  if (!homeEl) return;
  homeEl.textContent = '';
  var ng = mkRow('New Game');
  ng.addEventListener('click', function(){
    if (startLevelCb) startLevelCb(0);
  });
  homeEl.appendChild(ng);

  var cont = mkRow('Continue', CHEV);
  cont.addEventListener('click', function(){
    if (canResume() && resumeCb && resumeCb()) return;
    showScreen('path');
    buildPath();
  });
  homeEl.appendChild(cont);

  var st = mkRow('Settings');
  st.addEventListener('click', function(){
    showScreen('settings');
    buildSettings();
  });
  homeEl.appendChild(st);

  var cr = mkRow('Credits');
  cr.addEventListener('click', function(){
    showScreen('credits');
  });
  homeEl.appendChild(cr);
}

function buildPath(){
  if (!listEl) return;
  listEl.textContent = '';
  var canDel = G.LEVELS.length > 1;
  for (var i = 0; i < G.LEVELS.length; i++){
    (function(idx){
      var lv = G.LEVELS[idx];
      var open = idx <= prog.max || !!lv.blank;
      var row = document.createElement('div');
      row.className = 'mrow' + (open ? ' on' : ' lock') + (prog.done[idx] ? ' done' : '');
      var num = document.createElement('div');
      num.className = 'mnum'; num.textContent = prog.done[idx] ? '✓' : (idx + 1);
      var name = document.createElement('div');
      name.className = 'mname';
      name.textContent = open ? lv.name : '— locked —';
      row.appendChild(num); row.appendChild(name);
      if (canDel){
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'mdel';
        del.title = 'Delete level';
        del.textContent = '×';
        del.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          if (deleteLevelCb) deleteLevelCb(idx);
          else {
            if (!confirm('Delete "' + lv.name + '"?')) return;
            var next = G.removeLevel(idx);
            dropProgressAt(idx);
            if (next >= 0) buildPath();
          }
        });
        row.appendChild(del);
      }
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
  lab.className = 'mname';
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

function buildSettings(){
  var box = document.getElementById('mSetList');
  if (!box) return;
  box.textContent = '';
  var s = loadSettings();
  var mix = getMix();
  if (mix && mix.master != null) s.music = clampPct(Math.round(mix.master * 100));
  var talk = loadTalkPrefs();
  if (talk && talk.vol != null) s.talk = clampPct(Math.round(talk.vol * 100));

  function addSlider(key, label){
    var row = document.createElement('div');
    row.className = 'mset-row';
    var top = document.createElement('div');
    top.className = 'mset-top';
    var name = document.createElement('div');
    name.textContent = label;
    var val = document.createElement('div');
    val.className = 'val';
    val.textContent = s[key] + '%';
    top.appendChild(name); top.appendChild(val);
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.value = String(s[key]);
    inp.addEventListener('input', function(){
      s[key] = clampPct(inp.value);
      val.textContent = s[key] + '%';
      applySettings(s);
    });
    row.appendChild(top); row.appendChild(inp);
    box.appendChild(row);
  }
  addSlider('music', 'Музыка');
  addSlider('talk', 'Диалоги');
  addSlider('fx', 'Эффекты');
}

function startEmbers(){
  if (!emberCv || emberRaf) return;
  var ctx = emberCv.getContext('2d');
  function resize(){
    var r = emberCv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    emberCv.width = Math.max(1, Math.round(r.width * dpr));
    emberCv.height = Math.max(1, Math.round(r.height * dpr));
    var n = 28, i, w = emberCv.width, h = emberCv.height;
    if (!emberPts.length){
      for (i = 0; i < n; i++){
        emberPts.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.6 + Math.random() * 1.4, a: 0.15 + Math.random() * 0.35,
          vx: (Math.random() - 0.5) * 8, vy: -6 - Math.random() * 14,
          ph: Math.random() * Math.PI * 2
        });
      }
    }
  }
  function tick(ts){
    if (!inMenu){ emberRaf = 0; return; }
    resize();
    var w = emberCv.width, h = emberCv.height, i, p, fl;
    ctx.clearRect(0, 0, w, h);
    for (i = 0; i < emberPts.length; i++){
      p = emberPts[i];
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      if (p.y < -8){ p.y = h + 6; p.x = Math.random() * w; }
      if (p.x < -8) p.x = w + 4;
      if (p.x > w + 8) p.x = -4;
      fl = 0.65 + Math.sin(ts / 280 + p.ph) * 0.35;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,157,61,' + (p.a * fl) + ')';
      ctx.arc(p.x, p.y, p.r * (0.8 + fl * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    emberRaf = requestAnimationFrame(tick);
  }
  resize();
  emberRaf = requestAnimationFrame(tick);
}
function stopEmbers(){
  if (emberRaf){ cancelAnimationFrame(emberRaf); emberRaf = 0; }
}

export function buildMenu(onStart, onDelete){
  if (onStart && typeof onStart === 'object'){
    if (typeof onStart.onStart === 'function') startLevelCb = onStart.onStart;
    if (typeof onStart.onDelete === 'function') deleteLevelCb = onStart.onDelete;
    if (typeof onStart.onResume === 'function') resumeCb = onStart.onResume;
    if (typeof onStart.canResume === 'function') canResumeFn = onStart.canResume;
  } else {
    if (typeof onStart === 'function') startLevelCb = onStart;
    if (typeof onDelete === 'function') deleteLevelCb = onDelete;
  }
  var foot = document.getElementById('mFoot');
  if (foot) foot.textContent = formatAppVersion(APP_VERSION) + ' · carved ledge';
  buildHome();
  if (screen === 'path') buildPath();
  if (screen === 'settings') buildSettings();
}

export function showMenu(){
  setMenu(true);
  showMenuHome();
  buildMenu();
}

function bindOnce(){
  var pathBack = document.getElementById('mPathBack');
  var setBack = document.getElementById('mSetBack');
  var credBack = document.getElementById('mCredBack');
  if (pathBack) pathBack.addEventListener('click', function(){ showMenuHome(); });
  if (setBack) setBack.addEventListener('click', function(){ showMenuHome(); });
  if (credBack) credBack.addEventListener('click', function(){ showMenuHome(); });
}
bindOnce();
