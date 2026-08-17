/* плавающие окна редактора: drag за шапку / ПКМ, скролл СКМ и колесом */

var KEY = 'ledge.ed.float';
var zTop = 30;
var bound = [];

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
  if (!el || !el.id || !el.style.left) return;
  var all = loadAll();
  all[el.id] = { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
  saveAll(all);
}

function restore(el){
  if (!el || !el.id) return;
  var pos = loadAll()[el.id];
  if (!pos) return;
  placeFloat(el, pos.x, pos.y);
}

function scrollEl(root){
  return root.querySelector('.ed-float-body');
}

function isChrome(t){
  return !!(t && t.closest && t.closest('button, .edb, input, textarea, select, .eye, .bn-field, a'));
}

export function bindFloat(root){
  if (!root || root._edFloat) return;
  root._edFloat = true;
  bound.push(root);
  var head = root.querySelector('.ed-float-head');
  var mode = null, pid = -1, ox = 0, oy = 0, sTop = 0, sLeft = 0;
  restore(root);

  function body(){ return scrollEl(root); }

  function startMove(e){
    var r = root.getBoundingClientRect();
    mode = 'move';
    pid = e.pointerId;
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    root.classList.add('is-drag');
    raiseFloat(root);
    try { root.setPointerCapture(e.pointerId); } catch (_){}
  }

  function startScroll(e){
    var b = body();
    mode = 'scroll';
    pid = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    sTop = b ? b.scrollTop : 0;
    sLeft = b ? b.scrollLeft : 0;
    root.classList.add('is-pan');
    raiseFloat(root);
    try { root.setPointerCapture(e.pointerId); } catch (_){}
  }

  root.addEventListener('pointerdown', function(e){
    if (root.hidden) return;
    raiseFloat(root);
    if (e.button === 2){
      e.preventDefault();
      startMove(e);
      return;
    }
    if (e.button === 1){
      e.preventDefault();
      startScroll(e);
      return;
    }
    if (e.button === 0 && head && head.contains(e.target) && !isChrome(e.target))
      startMove(e);
  });

  root.addEventListener('pointermove', function(e){
    if (!mode || e.pointerId !== pid) return;
    e.preventDefault();
    if (mode === 'move') placeFloat(root, e.clientX - ox, e.clientY - oy);
    else if (mode === 'scroll'){
      var b = body();
      if (!b) return;
      b.scrollTop = sTop - (e.clientY - oy);
      b.scrollLeft = sLeft - (e.clientX - ox);
    }
  });

  function end(e){
    if (e && e.pointerId !== pid) return;
    if (mode === 'move') persist(root);
    mode = null;
    pid = -1;
    root.classList.remove('is-drag', 'is-pan');
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  root.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  root.addEventListener('auxclick', function(e){ if (e.button === 1) e.preventDefault(); });
  root.addEventListener('mousedown', function(e){ if (e.button === 1) e.preventDefault(); });

  root.addEventListener('wheel', function(e){
    var b = body();
    if (!b) return;
    b.scrollTop += e.deltaY;
    b.scrollLeft += e.deltaX;
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
}

export function bindAllFloats(){
  var ids = ['edLayers', 'edInspect', 'edChestList', 'edNpcTalk'];
  for (var i = 0; i < ids.length; i++){
    var el = document.getElementById(ids[i]);
    if (el) bindFloat(el);
  }
}

addEventListener('resize', function(){
  for (var i = 0; i < bound.length; i++){
    var el = bound[i];
    if (el.hidden || !el.style.left) continue;
    placeFloat(el, parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0);
  }
});
