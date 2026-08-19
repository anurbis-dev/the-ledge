/* плавающие окна редактора: drag за шапку / ПКМ, ресайз за уголок, скролл СКМ и колесом */

var KEY = 'ledge.ed.float';
var zTop = 30;
var bound = [];
var MIN_W = 160;
var MIN_H = 72;

function loadAll(){
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e){ return {}; }
}
function saveAll(o){
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e){}
}

function clamp(el, x, y){
  var w = el.offsetWidth || 220, h = el.offsetHeight || 80;
  var maxX = Math.max(4, innerWidth - Math.min(w, innerWidth - 8));
  var maxY = Math.max(4, innerHeight - Math.min(h, 48));
  return {
    x: Math.max(4, Math.min(x, maxX)),
    y: Math.max(4, Math.min(y, maxY))
  };
}

export function placeFloat(el, x, y){
  if (!el) return;
  var p = clamp(el, x, y);
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  el.style.right = 'auto';
}

export function raiseFloat(el){
  if (!el) return;
  zTop += 1;
  el.style.zIndex = String(zTop);
}

export function hasFloatPos(el){
  return !!(el && el.style.left);
}

function persist(el){
  if (!el || !el.id) return;
  var all = loadAll();
  var prev = all[el.id] || {};
  var next = {
    x: el.style.left ? parseFloat(el.style.left) || 0 : prev.x,
    y: el.style.top ? parseFloat(el.style.top) || 0 : prev.y
  };
  if (el.style.width) next.w = Math.round(el.offsetWidth);
  else if (prev.w) next.w = prev.w;
  if (el.style.height) next.h = Math.round(el.offsetHeight);
  else if (prev.h) next.h = prev.h;
  all[el.id] = next;
  saveAll(all);
}

function applySize(el, w, h){
  if (!el) return;
  var left = el.style.left ? parseFloat(el.style.left) || 0 : el.getBoundingClientRect().left;
  var top = el.style.top ? parseFloat(el.style.top) || 0 : el.getBoundingClientRect().top;
  var maxW = Math.max(MIN_W, innerWidth - left - 4);
  var maxH = Math.max(MIN_H, innerHeight - top - 4);
  if (w != null){
    el.style.width = Math.max(MIN_W, Math.min(maxW, w)) + 'px';
  }
  if (h != null){
    el.style.height = Math.max(MIN_H, Math.min(maxH, h)) + 'px';
    el.style.maxHeight = 'none';
  }
}

function restore(el){
  if (!el || !el.id) return;
  var pos = loadAll()[el.id];
  if (!pos) return;
  if (pos.w || pos.h) applySize(el, pos.w, pos.h);
  if (pos.x != null && pos.y != null) placeFloat(el, pos.x, pos.y);
}

function ensureBody(root){
  var b = root.querySelector(':scope > .ed-float-body');
  if (b) return b;
  var head = root.querySelector(':scope > .ed-float-head');
  b = document.createElement('div');
  b.className = 'ed-float-body';
  var move = [], i, ch;
  for (i = 0; i < root.children.length; i++){
    ch = root.children[i];
    if (ch !== head && !(ch.classList && ch.classList.contains('ed-float-sz'))) move.push(ch);
  }
  for (i = 0; i < move.length; i++) b.appendChild(move[i]);
  root.appendChild(b);
  return b;
}

function ensureGrip(root){
  var g = root.querySelector(':scope > .ed-float-sz');
  if (g) return g;
  g = document.createElement('div');
  g.className = 'ed-float-sz';
  g.title = 'Resize';
  root.appendChild(g);
  return g;
}

function isChrome(t){
  return !!(t && t.closest && t.closest('button, .edb, input, textarea, select, .eye, .bn-field, a, canvas, .ed-tilegeo, .ed-tile-chip'));
}

export function bindFloat(root){
  if (!root || root._edFloat) return;
  root._edFloat = true;
  bound.push(root);
  var head = root.querySelector(':scope > .ed-float-head');
  var scroller = ensureBody(root);
  var grip = ensureGrip(root);
  var mode = null, pid = -1, ox = 0, oy = 0, sTop = 0, sLeft = 0, sW = 0, sH = 0;
  restore(root);

  function hookWin(){
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerup', onUp, true);
    addEventListener('pointercancel', onUp, true);
  }
  function unhookWin(){
    removeEventListener('pointermove', onMove, true);
    removeEventListener('pointerup', onUp, true);
    removeEventListener('pointercancel', onUp, true);
  }

  function startMove(e){
    var r = root.getBoundingClientRect();
    mode = 'move';
    pid = e.pointerId;
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    root.classList.add('is-drag');
    raiseFloat(root);
    try { root.setPointerCapture(e.pointerId); } catch (_){}
    hookWin();
  }

  function startScroll(e){
    mode = 'scroll';
    pid = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    sTop = scroller.scrollTop;
    sLeft = scroller.scrollLeft;
    root.classList.add('is-pan');
    raiseFloat(root);
    try { root.setPointerCapture(e.pointerId); } catch (_){}
    hookWin();
  }

  function startSize(e){
    var r = root.getBoundingClientRect();
    mode = 'size';
    pid = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    sW = r.width;
    sH = r.height;
    root.classList.add('is-sz');
    raiseFloat(root);
    try { root.setPointerCapture(e.pointerId); } catch (_){}
    hookWin();
  }

  function onMove(e){
    if (!mode || e.pointerId !== pid) return;
    e.preventDefault();
    e.stopPropagation();
    if (mode === 'move') placeFloat(root, e.clientX - ox, e.clientY - oy);
    else if (mode === 'size') applySize(root, sW + (e.clientX - ox), sH + (e.clientY - oy));
    else {
      scroller.scrollTop = sTop - (e.clientY - oy);
      scroller.scrollLeft = sLeft - (e.clientX - ox);
    }
  }

  function onUp(e){
    if (e && e.pointerId !== pid) return;
    if (mode === 'move' || mode === 'size') persist(root);
    mode = null;
    pid = -1;
    root.classList.remove('is-drag', 'is-pan', 'is-sz');
    unhookWin();
  }

  root.addEventListener('pointerdown', function(e){
    if (root.hidden) return;
    raiseFloat(root);
    if (e.button === 0 && grip && (e.target === grip || grip.contains(e.target))){
      e.preventDefault();
      e.stopPropagation();
      startSize(e);
      return;
    }
    if (e.button === 2){
      if (isChrome(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      startMove(e);
      return;
    }
    if (e.button === 1){
      e.preventDefault();
      e.stopPropagation();
      startScroll(e);
      return;
    }
    if (e.button === 0 && head && head.contains(e.target) && !isChrome(e.target)){
      e.preventDefault();
      e.stopPropagation();
      startMove(e);
    }
  });

  root.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  root.addEventListener('auxclick', function(e){ if (e.button === 1) e.preventDefault(); });
  root.addEventListener('mousedown', function(e){ if (e.button === 1) e.preventDefault(); });

  root.addEventListener('wheel', function(e){
    scroller.scrollTop += e.deltaY;
    scroller.scrollLeft += e.deltaX;
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
}

export function bindAllFloats(){
  var ids = ['edLayers', 'edInspect', 'edChestList', 'edNpcTalk', 'edBoulderSettings', 'edTileEdit'];
  for (var i = 0; i < ids.length; i++){
    var el = document.getElementById(ids[i]);
    if (el) bindFloat(el);
  }
}

addEventListener('resize', function(){
  for (var i = 0; i < bound.length; i++){
    var el = bound[i];
    if (el.hidden) continue;
    if (el.style.width || el.style.height){
      applySize(el, el.offsetWidth, el.offsetHeight);
    }
    if (el.style.left) placeFloat(el, parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0);
  }
});

bindAllFloats();
