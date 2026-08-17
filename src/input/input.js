import { resumeAudio } from '../audio/sfx.js';

export var held = { l:false, r:false, u:false, d:false, j:false, a:false };
export var latch = { j:false, u:false, d:false, a:false };
export var ax = 0;
export var stick = { on:false, id:-1, bx:0, by:0, dx:0, dy:0, up:false, dn:false, hx:0 };

var ringEl = null, knobEl = null;
var DEAD = 15, MAXR = 46, VEN = 21, VEX = 13;
var bound = false;

function place(el, x, y){ el.style.left = x + 'px'; el.style.top = y + 'px'; }

function stickReset(){
  stick.on = false; stick.id = -1; stick.dx = 0; stick.dy = 0;
  stick.up = false; stick.dn = false; stick.hx = 0; ax = 0;
  if (ringEl) ringEl.style.opacity = 0;
  if (knobEl) knobEl.style.opacity = 0;
}

function stickCalc(){
  var dx = stick.dx, dy = stick.dy, m = Math.sqrt(dx*dx + dy*dy);
  if (m > MAXR){ dx *= MAXR/m; dy *= MAXR/m; m = MAXR; }
  place(knobEl, stick.bx + dx, stick.by + dy);
  var adx = Math.abs(dx), ady = Math.abs(dy);
  var hOn = stick.hx !== 0 ? adx > DEAD*0.6 : adx > DEAD;          // гистерезис по горизонтали
  if (hOn){
    stick.hx = dx > 0 ? 1 : -1;
    ax = stick.hx * Math.min(1, Math.max(0.42, (adx - DEAD*0.6) / (MAXR - DEAD)));
  } else { stick.hx = 0; ax = 0; }
  stick.up = stick.up ? (dy < -VEX && ady > adx*0.32) : (dy < -VEN && ady > adx*0.5);
  stick.dn = stick.dn ? (dy >  VEX && ady > adx*0.32) : (dy >  VEN && ady > adx*0.5);
}

function kmap(e){
  var k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') return 'l';
  if (k === 'arrowright' || k === 'd') return 'r';
  if (k === 'arrowup' || k === 'w') return 'u';
  if (k === 'arrowdown' || k === 's') return 'd';
  if (k === ' ' || k === 'z' || k === 'x') return 'j';
  if (k === 'e' || k === 'f' || k === 'c') return 'a';
  return null;
}

export function getAxis(){
  var kx = (held.r?1:0) - (held.l?1:0);
  return kx !== 0 ? kx : ax;
}

export function bindInput(hooks){
  hooks = hooks || {};
  if (bound) return;
  bound = true;

  ringEl = document.getElementById('ring');
  knobEl = document.getElementById('knob');

  addEventListener('pointerdown', function(){ resumeAudio(); });
  addEventListener('keydown', function(){ resumeAudio(); });

  var stEl = document.getElementById('stick');
  stEl.addEventListener('pointerdown', function(e){
    e.preventDefault();
    resumeAudio();
    if (stick.on) return;
    stick.on = true; stick.id = e.pointerId; stick.bx = e.clientX; stick.by = e.clientY;
    stick.dx = 0; stick.dy = 0;
    place(ringEl, stick.bx, stick.by); place(knobEl, stick.bx, stick.by);
    ringEl.style.opacity = 0.75; knobEl.style.opacity = 0.9;
    try{ stEl.setPointerCapture(e.pointerId); }catch(_){}
  });
  stEl.addEventListener('pointermove', function(e){
    if (!stick.on || e.pointerId !== stick.id) return;
    e.preventDefault();
    stick.dx = e.clientX - stick.bx; stick.dy = e.clientY - stick.by;
    var wasU = stick.up, wasD = stick.dn;
    stickCalc();
    if (stick.up && !wasU) latch.u = true;
    if (stick.dn && !wasD) latch.d = true;
  });
  function stickEnd(e){ if (e.pointerId === stick.id){ e.preventDefault(); stickReset(); } }
  stEl.addEventListener('pointerup', stickEnd);
  stEl.addEventListener('pointercancel', stickEnd);

  var bA = document.getElementById('bA');
  bA.addEventListener('pointerdown', function(e){ e.preventDefault(); resumeAudio(); if(!held.a) latch.a = true; held.a = true; bA.classList.add('on');
    try{ bA.setPointerCapture(e.pointerId); }catch(_){} });
  function aUp(e){ e.preventDefault(); held.a = false; bA.classList.remove('on'); }
  bA.addEventListener('pointerup', aUp); bA.addEventListener('pointercancel', aUp);

  var bJ = document.getElementById('bJ');
  bJ.addEventListener('pointerdown', function(e){ e.preventDefault(); resumeAudio(); if(!held.j) latch.j = true; held.j = true; bJ.classList.add('on');
    try{ bJ.setPointerCapture(e.pointerId); }catch(_){} });
  function jUp(e){ e.preventDefault(); held.j = false; bJ.classList.remove('on'); }
  bJ.addEventListener('pointerup', jUp); bJ.addEventListener('pointercancel', jUp);

  addEventListener('keydown', function(e){
    if (e.key === 'r' || e.key === 'R' || e.key === 'h' || e.key === 'H' || e.key === 'p' || e.key === 'P') return;
    var m = kmap(e); if (!m) return; e.preventDefault();
    resumeAudio();
    if (!held[m] && (m === 'j' || m === 'u' || m === 'd' || m === 'a')) latch[m] = true;
    held[m] = true;
  }, { passive:false });
  addEventListener('keyup', function(e){
    var m = kmap(e); if (!m) return; e.preventDefault(); held[m] = false;
  }, { passive:false });

  var bDbg = document.getElementById('bDbg');
  if (bDbg && hooks.onDbg) bDbg.addEventListener('click', hooks.onDbg);
}
