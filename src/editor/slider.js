/**
 * Blender-style range (PixisEditor: ui/widgets/blender-number.js).
 * .slider-wrap + input[type=range] → fill bar, drag, Shift fine, click-to-type, Backspace reset.
 */

var hoveredReset = null;

export function initSliders(root){
  if (!root) root = document;
  var list = root.querySelectorAll('input[type=range]');
  for (var i = 0; i < list.length; i++) upgradeRange(list[i]);
}

function upgradeRange(input){
  if (input.dataset.bnReady === '1') return;
  input.dataset.bnReady = '1';

  var wrap = input.closest('.slider-wrap');
  var labelText = '';
  var valueEl = null;
  if (wrap){
    var overlay = wrap.querySelector('.slider-label-overlay');
    if (overlay){
      var spans = overlay.querySelectorAll(':scope > span');
      labelText = (spans[0] && spans[0].textContent) || '';
      valueEl = spans[1] || null;
    }
  }

  var field = document.createElement('div');
  field.className = 'bn-field bn-slider';
  field.setAttribute('role', 'slider');
  var tip = (wrap && wrap.getAttribute('title')) || input.getAttribute('title') || labelText || '';
  if (tip) field.setAttribute('title', tip);

  var fill = document.createElement('div');
  fill.className = 'bn-fill';
  var label = document.createElement('span');
  label.className = 'bn-label';
  label.textContent = labelText;
  if (!valueEl){
    valueEl = document.createElement('span');
    valueEl.className = 'bn-value';
  } else valueEl.classList.add('bn-value');

  input.classList.add('bn-native');
  input.setAttribute('tabindex', '-1');
  field.appendChild(fill);
  field.appendChild(label);
  field.appendChild(valueEl);

  if (wrap){
    field.appendChild(input);
    wrap.replaceWith(field);
  } else {
    input.parentNode.insertBefore(field, input);
    field.appendChild(input);
  }

  if (!input.dataset.default) input.dataset.default = input.getAttribute('value') || input.value;

  function min(){ return +input.min || 0; }
  function max(){
    var m = +input.max;
    return Number.isFinite(m) ? m : 100;
  }
  function step(){
    var s = +input.step;
    return Number.isFinite(s) && s > 0 ? s : 1;
  }
  function format(v){
    var s = step();
    if (s >= 1) return String(Math.round(v));
    var dec = Math.min(4, (String(s).split('.')[1] || '').length);
    return (+v).toFixed(dec);
  }
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
  function quantize(v){
    var s = step(), a = min();
    if (!(s > 0)) return v;
    return a + Math.round((v - a) / s) * s;
  }
  function ratio(){
    var a = min(), b = max(), v = +input.value;
    if (a === b) return 0;
    return Math.min(1, Math.max(0, (v - a) / (b - a)));
  }
  function refresh(){
    var r = ratio();
    fill.style.width = (r * 100) + '%';
    field.setAttribute('aria-valuemin', String(min()));
    field.setAttribute('aria-valuemax', String(max()));
    field.setAttribute('aria-valuenow', String(input.value));
    valueEl.textContent = format(input.value);
  }
  function setValue(v, fire){
    v = clamp(quantize(v), min(), max());
    var s = step();
    if (s < 1) v = +v.toFixed(Math.min(6, (String(s).split('.')[1] || '').length));
    if (String(v) === input.value){ refresh(); return; }
    input.value = String(v);
    refresh();
    if (fire !== false) input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function reset(){
    var d = +input.dataset.default;
    if (Number.isFinite(d)) setValue(d, true);
  }

  refresh();
  input.addEventListener('input', refresh);

  var drag = null;
  field.addEventListener('pointerdown', function(e){
    if (e.button !== 0) return;
    if (e.target.classList && e.target.classList.contains('bn-edit')) return;
    e.preventDefault();
    field.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x0: e.clientX, moved: false, v0: +input.value };
    field.classList.add('bn-active');
  });
  field.addEventListener('pointermove', function(e){
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true;
    var rect = field.getBoundingClientRect();
    var t = (e.clientX - rect.left) / Math.max(1, rect.width);
    if (e.shiftKey){
      var span = max() - min();
      setValue(drag.v0 + dx / Math.max(1, rect.width) * span * 0.08, true);
    } else {
      setValue(min() + t * (max() - min()), true);
    }
  });
  function endDrag(e){
    if (!drag || e.pointerId !== drag.id) return;
    var was = drag;
    drag = null;
    field.classList.remove('bn-active');
    if (!was.moved) beginEdit();
  }
  field.addEventListener('pointerup', endDrag);
  field.addEventListener('pointercancel', function(e){
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    field.classList.remove('bn-active');
  });

  function beginEdit(){
    if (field.querySelector('.bn-edit')) return;
    field.classList.add('bn-editing');
    var ed = document.createElement('input');
    ed.className = 'bn-edit';
    ed.type = 'text';
    ed.value = format(input.value);
    field.appendChild(ed);
    ed.focus();
    ed.select();
    function commit(){
      if (!ed.parentNode) return;
      var n = parseFloat(ed.value);
      ed.remove();
      field.classList.remove('bn-editing');
      if (Number.isFinite(n)) setValue(n, true);
    }
    ed.addEventListener('blur', commit);
    ed.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter'){ ev.preventDefault(); ed.blur(); }
      if (ev.key === 'Escape'){ ev.preventDefault(); ed.value = format(input.value); ed.blur(); }
    });
  }

  field.addEventListener('mouseenter', function(){ hoveredReset = reset; });
  field.addEventListener('mouseleave', function(){ if (hoveredReset === reset) hoveredReset = null; });

  field._bnSet = setValue;
  field._bnReset = reset;
}

if (typeof document !== 'undefined'){
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Backspace' || !hoveredReset) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    hoveredReset();
  });
}
