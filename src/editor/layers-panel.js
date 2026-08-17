import { runtime } from '../core/runtime.js';
import {
  getLayers, setActiveLayer, addLayer, deleteLayer, moveLayer,
  setLayerCollide, setLayerWrap, setWrapSize, toggleSolo, getActiveLayer,
  layerKind
} from '../core/layers.js';
import { invalidateAll } from '../render/tiles.js';
import { initSliders } from './slider.js';

var root = document.getElementById('edLayers');
var listEl = document.getElementById('edLayerList');
var propsEl = document.getElementById('edLayerProps');
var onChange = null;
var dragFrom = -1;

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
  if (on) renderLayersPanel();
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
        else L.visible = L.visible === false;
        notify();
      });
      row.appendChild(eye);

      var lock = document.createElement('span');
      lock.className = 'eye lock' + (L.locked ? ' lock-on' : '');
      lock.textContent = '🔒';
      lock.title = L.locked ? 'Unlock' : 'Lock — prevents painting';
      lock.addEventListener('pointerdown', function(e){
        e.stopPropagation(); e.preventDefault();
        L.locked = !L.locked;
        notify();
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
          L.name = inp.value || L.name;
          notify();
        });
        row.replaceChild(inp, name);
        inp.focus(); inp.select();
      });
      row.appendChild(name);

      row.addEventListener('pointerdown', function(e){
        if (e.button !== 0) return;
        if (e.target.closest('.eye, input')) return;
        setActiveLayer(ix);
        dragFrom = ix;
        try { row.setPointerCapture(e.pointerId); } catch (_){}
        notify();
      });
      row.addEventListener('pointerup', function(e){
        if (dragFrom < 0) return;
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var dest = el && el.closest ? el.closest('#edLayerList .layer') : null;
        if (dest && dest !== row){
          var to = +dest.dataset.ix;
          if (isFinite(to)) moveLayer(dragFrom, to);
        }
        dragFrom = -1;
        notify();
      });
      listEl.appendChild(row);
    })(i);
  }
  fillLayerProps();
}

function fillLayerProps(){
  if (!propsEl) return;
  propsEl.textContent = '';
  var L = getActiveLayer();
  if (!L) return;
  var kind = layerKind(L);
  function row(label, min, max, step, val, set){
    var wrap = document.createElement('label');
    wrap.className = 'slider-wrap';
    wrap.innerHTML = '<div class="slider-label-overlay"><span>' + label + '</span><span></span></div>';
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = val; inp.dataset.default = String(val);
    inp.addEventListener('input', function(){
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
    cb.addEventListener('change', function(){ set(cb.checked); notify(); });
    el.appendChild(cb);
    el.appendChild(document.createTextNode(' ' + label));
    propsEl.appendChild(el);
  }
  function color(label, val, set){
    var el = document.createElement('label');
    el.className = 'ed-field';
    el.appendChild(document.createTextNode(label + ' '));
    var inp = document.createElement('input');
    inp.type = 'color'; inp.value = val || '#2b2154';
    inp.addEventListener('input', function(){
      set(inp.value);
      invalidateAll();
      if (onChange) onChange();
    });
    el.appendChild(inp);
    propsEl.appendChild(el);
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
  row('Parallax X', 0, 3, 0.01, L.px == null ? 1 : L.px, function(v){
    if (L.collide) return;
    L.px = v;
  });
  row('Parallax Y', 0, 3, 0.01, L.py == null ? 0 : L.py, function(v){
    if (L.collide) return;
    L.py = v;
  });
  if (kind === 'ridge'){
    row('Amplitude', 8, 80, 1, L.amp == null ? 30 : L.amp, function(v){ L.amp = v; });
    row('Horizon', 40, 180, 1, L.y0 == null ? 140 : L.y0, function(v){ L.y0 = v; });
    color('Color', L.color || '#2b2154', function(v){ L.color = v; });
  }
  if (kind === 'fore'){
    row('Period', 40, 220, 1, L.period || 120, function(v){ L.period = v; });
    row('Height min', 4, 36, 1, L.hmin == null ? 10 : L.hmin, function(v){ L.hmin = v; });
    row('Height max', 8, 48, 1, L.hmax == null ? 20 : L.hmax, function(v){ L.hmax = v; });
    color('Color', L.col || '#1b1436', function(v){ L.col = v; });
    color('Color dark', L.colD || '#241a44', function(v){ L.colD = v; });
    row('Seed', 0, 99, 1, L.seed == null ? 7 : L.seed, function(v){ L.seed = v; });
  }
  if (kind === 'tiles'){
    check('Collision layer', !!L.collide, function(on){ setLayerCollide(L, on); });
    check('Repeat (infinite tile)', !!L.wrap, function(on){ setLayerWrap(L, on); });
    if (L.wrap){
      row('Stamp W', 1, 32, 1, L.wrapW || 8, function(v){ setWrapSize(L, v, L.wrapH || 8); });
      row('Stamp H', 1, 32, 1, L.wrapH || 8, function(v){ setWrapSize(L, L.wrapW || 8, v); });
      var note = document.createElement('div');
      note.className = 'ed-layer-kind';
      note.textContent = 'Paint the stamp — it tiles forever. 1×1 = solid fill.';
      propsEl.appendChild(note);
    }
  }
}

var addBtn = document.getElementById('edLayerAdd');
var delBtn = document.getElementById('edLayerDel');
if (addBtn) addBtn.addEventListener('click', function(){ addLayer(); notify(); });
if (delBtn) delBtn.addEventListener('click', function(){
  if (deleteLayer(runtime.activeLayer | 0)) notify();
});
