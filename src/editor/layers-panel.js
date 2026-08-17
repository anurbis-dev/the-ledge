import { runtime } from '../core/runtime.js';
import {
  getLayers, setActiveLayer, addLayer, deleteLayer, relocateLayer,
  setLayerCollide, setLayerWrap, setWrapSize, toggleSolo, getActiveLayer,
  layerKind
} from '../core/layers.js';
import { invalidateAll } from '../render/tiles.js';
import { initSliders, bindResetHover } from './slider.js';
import { beginOp, endOp, touchOp } from './history.js';
import { raiseFloat } from './float.js';

var root = document.getElementById('edLayers');
var listEl = document.getElementById('edLayerList');
var propsEl = document.getElementById('edLayerProps');
var onChange = null;
var drag = { from: -1, y: 0, live: false, ptr: -1, slot: null };
var dropSlot = null;

function eyeSvg(){
  var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('class', 'eye-svg');
  s.setAttribute('aria-hidden', 'true');
  var outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outline.setAttribute('d', 'M1.4 8s2.8-4.6 6.6-4.6S14.6 8 14.6 8s-2.8 4.6-6.6 4.6S1.4 8 1.4 8z');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', 'currentColor');
  outline.setAttribute('stroke-width', '1.5');
  var pupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pupil.setAttribute('cx', '8'); pupil.setAttribute('cy', '8'); pupil.setAttribute('r', '2');
  pupil.setAttribute('fill', 'currentColor');
  s.appendChild(outline); s.appendChild(pupil);
  return s;
}

export function bindLayersPanel(hooks){
  onChange = hooks && hooks.onChange;
}

function notify(){
  invalidateAll();
  if (onChange) onChange();
  renderLayersPanel();
}

export function showLayersPanel(on){
  if (!root) return;
  root.hidden = !on;
  if (on){ renderLayersPanel(); raiseFloat(root); }
}

export function renderLayersPanel(){
  if (!listEl) return;
  listEl.textContent = '';
  var ls = getLayers();
  var solo = runtime.soloLayer;
  // сверху — передний слой (как в Pixis)
  for (var i = ls.length - 1; i >= 0; i--){
    (function(ix){
      var L = ls[ix];
      var row = document.createElement('div');
      row.className = 'layer' + (ix === runtime.activeLayer ? ' active' : '') +
        (L.visible === false ? ' hidden-layer' : '') +
        (solo && solo !== L.id ? ' dim-solo' : '');
      row.dataset.ix = String(ix);

      var eye = document.createElement('span');
      eye.className = 'eye' + (L.visible === false ? ' eye-off' : '') +
        (solo === L.id ? ' solo-on' : '');
      eye.appendChild(eyeSvg());
      eye.title = solo === L.id
        ? 'Exit solo (Ctrl+click)'
        : (L.visible === false ? 'Show · Ctrl+click to solo' : 'Hide · Ctrl+click to solo');
      eye.addEventListener('pointerdown', function(e){
        e.stopPropagation(); e.preventDefault();
        if (e.ctrlKey || e.metaKey) toggleSolo(L.id);
        else { beginOp(); L.visible = L.visible === false; }
        notify();
        endOp();
      });
      row.appendChild(eye);

      var lock = document.createElement('span');
      lock.className = 'eye lock' + (L.locked ? ' lock-on' : '');
      lock.textContent = '🔒';
      lock.title = L.locked ? 'Unlock' : 'Lock — prevents painting';
      lock.addEventListener('pointerdown', function(e){
        e.stopPropagation(); e.preventDefault();
        beginOp();
        L.locked = !L.locked;
        notify();
        endOp();
      });
      row.appendChild(lock);

      var name = document.createElement('span');
      name.className = 'layername';
      name.textContent = L.name + (L.collide ? '  ▣' : '') + (L.wrap ? '  ▦' : '');
      name.title = 'Double-click to rename';
      name.addEventListener('dblclick', function(e){
        e.stopPropagation();
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'layername-edit';
        inp.value = L.name;
        inp.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
        inp.addEventListener('keydown', function(ev){
          if (ev.key === 'Enter') inp.blur();
          if (ev.key === 'Escape'){ inp.value = L.name; inp.blur(); }
        });
        inp.addEventListener('blur', function(){
          if (inp.value && inp.value !== L.name){
            beginOp();
            L.name = inp.value;
            notify();
            endOp();
          } else notify();
        });
        row.replaceChild(inp, name);
        inp.focus(); inp.select();
      });
      row.appendChild(name);

      row.addEventListener('pointerdown', function(e){
        if (e.button !== 0) return;
        if (e.target.closest('.eye, input')) return;
        setActiveLayer(ix);
        markActive(ix);
        fillLayerProps();
        drag.from = ix;
        drag.y = e.clientY;
        drag.live = false;
        drag.ptr = e.pointerId;
        drag.slot = null;
        try { row.setPointerCapture(e.pointerId); } catch (_){}
      });
      row.addEventListener('pointermove', function(e){
        if (drag.from < 0 || e.pointerId !== drag.ptr) return;
        if (!drag.live && Math.abs(e.clientY - drag.y) < 5) return;
        drag.live = true;
        row.classList.add('dragging');
        paintDropMarks(e.clientX, e.clientY, row);
      });
      row.addEventListener('pointerup', function(e){
        endLayerDrag(e, row);
      });
      row.addEventListener('pointercancel', function(e){
        endLayerDrag(e, row);
      });
      listEl.appendChild(row);
    })(i);
  }
  fillLayerProps();
}

function markActive(ix){
  if (!listEl) return;
  var rows = listEl.querySelectorAll('.layer'), i;
  for (i = 0; i < rows.length; i++)
    rows[i].classList.toggle('active', +rows[i].dataset.ix === ix);
}

function ensureDropSlot(){
  if (dropSlot && dropSlot.parentNode) return dropSlot;
  dropSlot = document.createElement('div');
  dropSlot.className = 'layer-drop-slot';
  dropSlot.setAttribute('aria-hidden', 'true');
  return dropSlot;
}

function clearDropMarks(){
  if (dropSlot && dropSlot.parentNode) dropSlot.parentNode.removeChild(dropSlot);
  if (!listEl) return;
  listEl.classList.remove('is-dragging');
  var rows = listEl.querySelectorAll('.layer'), i;
  for (i = 0; i < rows.length; i++)
    rows[i].classList.remove('drop-near', 'dragging');
}

/* куда встанет слой: слот над строкой или под последней */
function slotAt(y){
  if (!listEl) return null;
  var rows = listEl.querySelectorAll('.layer'), i, row, rect;
  for (i = 0; i < rows.length; i++){
    row = rows[i];
    if ((+row.dataset.ix) === drag.from) continue;
    rect = row.getBoundingClientRect();
    if (y < rect.top + rect.height / 2)
      return { dest: +row.dataset.ix, before: true, el: row };
  }
  for (i = rows.length - 1; i >= 0; i--){
    row = rows[i];
    if ((+row.dataset.ix) === drag.from) continue;
    return { dest: +row.dataset.ix, before: false, el: row };
  }
  return null;
}

function paintDropMarks(x, y, self){
  var slot = slotAt(y);
  if (self) self.classList.add('dragging');
  if (listEl) listEl.classList.add('is-dragging');
  var rows = listEl ? listEl.querySelectorAll('.layer') : [], i;
  for (i = 0; i < rows.length; i++)
    if (rows[i] !== self) rows[i].classList.remove('drop-near');
  if (!slot){
    if (dropSlot && dropSlot.parentNode) dropSlot.parentNode.removeChild(dropSlot);
    drag.slot = null;
    return;
  }
  var bar = ensureDropSlot();
  if (slot.before) listEl.insertBefore(bar, slot.el);
  else {
    if (slot.el.nextSibling) listEl.insertBefore(bar, slot.el.nextSibling);
    else listEl.appendChild(bar);
  }
  slot.el.classList.add('drop-near');
  drag.slot = slot;
}

function endLayerDrag(e, row){
  if (drag.from < 0) return;
  var moved = drag.live;
  var slot = drag.slot || (moved ? slotAt(e.clientY) : null);
  if (moved && slot && isFinite(slot.dest)){
    beginOp();
    relocateLayer(drag.from, slot.dest, slot.before);
  }
  drag.from = -1;
  drag.live = false;
  drag.ptr = -1;
  drag.slot = null;
  clearDropMarks();
  if (moved){ notify(); endOp(); }
}

function fillLayerProps(){
  if (!propsEl) return;
  propsEl.textContent = '';
  var L = getActiveLayer();
  if (!L) return;
  var kind = layerKind(L);
  function row(label, min, max, step, val, set, def){
    var wrap = document.createElement('label');
    wrap.className = 'slider-wrap';
    wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = val;
    inp.dataset.default = String(def != null ? def : val);
    inp.addEventListener('input', function(){
      touchOp();
      set(+inp.value);
      invalidateAll();
      if (onChange) onChange();
    });
    wrap.appendChild(inp);
    propsEl.appendChild(wrap);
    initSliders(wrap);
  }
  function check(label, on, set){
    var el = document.createElement('label');
    el.className = 'ed-check';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!on;
    cb.addEventListener('change', function(){ beginOp(); set(cb.checked); notify(); endOp(); });
    el.appendChild(cb);
    el.appendChild(document.createTextNode(' ' + label));
    propsEl.appendChild(el);
  }
  function color(label, val, set, def){
    var el = document.createElement('label');
    el.className = 'ed-field';
    el.appendChild(document.createTextNode(label + ' '));
    var inp = document.createElement('input');
    var factory = def || val || '#2b2154';
    inp.type = 'color'; inp.value = val || factory;
    inp.addEventListener('input', function(){
      touchOp();
      set(inp.value);
      invalidateAll();
      if (onChange) onChange();
    });
    bindResetHover(el, function(){
      if (inp.value === factory) return;
      touchOp();
      inp.value = factory;
      set(factory);
      invalidateAll();
      if (onChange) onChange();
    });
    el.appendChild(inp);
    propsEl.appendChild(el);
  }
  function kindDef(k){
    if (k === 'sky') return { px: 0.05, py: 0.03, hue: 0, sat: 1, bright: 0 };
    if (k === 'ridge') return { px: 0.18, py: 0.108, hue: 0, sat: 1, bright: 0, amp: 30, y0: 140, color: '#2b2154' };
    if (k === 'fore') return { px: 1.3, py: 0, hue: 0, sat: 1, bright: 0, period: 120, hmin: 10, hmax: 20, seed: 7, col: '#1b1436', colD: '#241a44' };
    if (k === 'pollen') return { px: 1.9, py: 1.3, hue: 0, sat: 1, bright: 0 };
    return { px: 1, py: 1, hue: 0, sat: 1, bright: 0, wrapW: 8, wrapH: 8 };
  }
  var hint = document.createElement('div');
  hint.className = 'ed-layer-kind';
  hint.textContent = kind === 'tiles' ? (L.wrap ? 'Tiles · repeat' : 'Tiles')
    : kind === 'sky' ? 'Sky (gradient + stars)'
    : kind === 'ridge' ? 'Hills silhouette'
    : kind === 'fore' ? 'Foreground plants'
    : kind === 'pollen' ? 'Pollen dust'
    : kind;
  propsEl.appendChild(hint);
  var D = kindDef(kind);
  if (L.collide){ D.px = 1; D.py = 1; }
  row('Parallax X', 0, 3, 0.01, L.px == null ? D.px : L.px, function(v){
    if (L.collide) return;
    L.px = v;
  }, D.px);
  row('Parallax Y', 0, 3, 0.01, L.py == null ? D.py : L.py, function(v){
    if (L.collide) return;
    L.py = v;
  }, D.py);
  row('Hue', -180, 180, 1, L.hue || 0, function(v){ L.hue = v; }, D.hue);
  row('Saturation', 0, 2, 0.01, L.sat == null ? 1 : L.sat, function(v){ L.sat = v; }, D.sat);
  row('Brightness', -0.8, 1.2, 0.01, L.bright || 0, function(v){ L.bright = v; }, D.bright);
  if (kind === 'ridge'){
    row('Amplitude', 8, 80, 1, L.amp == null ? D.amp : L.amp, function(v){ L.amp = v; }, D.amp);
    row('Horizon', 40, 180, 1, L.y0 == null ? D.y0 : L.y0, function(v){ L.y0 = v; }, D.y0);
    color('Color', L.color || D.color, function(v){ L.color = v; }, D.color);
  }
  if (kind === 'fore'){
    row('Period', 40, 220, 1, L.period || D.period, function(v){ L.period = v; }, D.period);
    row('Height min', 4, 36, 1, L.hmin == null ? D.hmin : L.hmin, function(v){ L.hmin = v; }, D.hmin);
    row('Height max', 8, 48, 1, L.hmax == null ? D.hmax : L.hmax, function(v){ L.hmax = v; }, D.hmax);
    color('Color', L.col || D.col, function(v){ L.col = v; }, D.col);
    color('Color dark', L.colD || D.colD, function(v){ L.colD = v; }, D.colD);
    row('Seed', 0, 99, 1, L.seed == null ? D.seed : L.seed, function(v){ L.seed = v; }, D.seed);
  }
  if (kind === 'tiles'){
    check('Collision layer', !!L.collide, function(on){ setLayerCollide(L, on); });
    check('Repeat (infinite tile)', !!L.wrap, function(on){ setLayerWrap(L, on); });
    if (L.wrap){
      row('Stamp W', 1, 256, 1, L.wrapW || 8, function(v){ setWrapSize(L, v, L.wrapH || 8); }, 8);
      row('Stamp H', 1, 256, 1, L.wrapH || 8, function(v){ setWrapSize(L, L.wrapW || 8, v); }, 8);
      var note = document.createElement('div');
      note.className = 'ed-layer-kind';
      note.textContent = 'Paint the stamp — it tiles forever. 1×1 = solid fill.';
      propsEl.appendChild(note);
    }
    if (L.collide){
      var objNote = document.createElement('div');
      objNote.className = 'ed-layer-kind';
      objNote.textContent = 'Hero & objects live on this layer.';
      propsEl.appendChild(objNote);
    }
  }
}

var addBtn = document.getElementById('edLayerAdd');
var delBtn = document.getElementById('edLayerDel');
if (addBtn) addBtn.addEventListener('click', function(){ beginOp(); addLayer(); notify(); endOp(); });
if (delBtn) delBtn.addEventListener('click', function(){
  beginOp();
  if (deleteLayer(runtime.activeLayer | 0)) notify();
  endOp();
});
