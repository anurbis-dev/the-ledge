import { getActx } from './context.js';
import score from './scores/lantern-key.json';

var MIX_KEY = 'ledge.dev.mix';
var BASE_MASTER = score.master != null ? score.master : 0.1;
var BASE_FADE = score.fadeIn != null ? score.fadeIn : 2.6;
var CHAN = ['bass', 'pad', 'arp', 'lead', 'harm', 'echo', 'drum'];
var WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

var playing = false, hushed = true, origin = 0, pausedAt = 0, timer = null;
var master = null, noiseBuf = null;
var schedUntil = 0;
var mix = { master: 1, fadeIn: BASE_FADE, voices: {}, solo: '' };

loadMix();

function loadMix(){
  try{
    var raw = JSON.parse(localStorage.getItem(MIX_KEY) || '{}');
    if (raw && typeof raw === 'object'){
      if (raw.master != null) mix.master = +raw.master;
      if (raw.fadeIn != null) mix.fadeIn = +raw.fadeIn;
      if (raw.solo) mix.solo = String(raw.solo);
      if (raw.voices && typeof raw.voices === 'object') mix.voices = raw.voices;
    }
  }catch(e){}
}

function saveMix(){
  try{ localStorage.setItem(MIX_KEY, JSON.stringify(mix)); }catch(e){}
}

function tickSec(){
  return (60 / (score.bpm || 110)) / (score.div || 4);
}

function loopDur(){
  return (score.loopEnd - score.loopStart) * tickSec();
}

function masterLevel(){
  return BASE_MASTER * (mix.master != null ? mix.master : 1);
}

function fadeInSec(){
  var f = mix.fadeIn != null ? mix.fadeIn : BASE_FADE;
  return Math.max(0.2, f);
}

export function voiceSpec(name){
  var base = score.voices && score.voices[name] ? score.voices[name] : {};
  var ov = mix.voices[name] || {};
  var spec = {
    wave: ov.wave || base.wave || 'square',
    vol: (base.vol || 0.1) * (ov.vol != null ? ov.vol : 1),
    sub: base.sub || 0,
    atk: base.atk || 0.008,
    rel: base.rel || 0.06
  };
  if (ov.mute || (mix.solo && mix.solo !== name)){
    spec.vol = 0;
    spec.sub = 0;
  } else if (spec.sub){
    spec.sub *= (ov.vol != null ? ov.vol : 1);
  }
  return spec;
}

function ensureGraph(){
  var ctx = getActx();
  if (master && master.context === ctx) return;
  master = ctx.createGain();
  master.gain.value = 0;
  var lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  lp.Q.value = 0.35;
  master.connect(lp);
  lp.connect(ctx.destination);
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate){
    var n = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
}

function midiHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }

function playOsc(t, midi, dur, vel, spec){
  if (!spec.vol) return;
  var ctx = getActx();
  var o = ctx.createOscillator();
  var g = ctx.createGain();
  o.type = spec.wave || 'square';
  o.frequency.setValueAtTime(midiHz(midi), t);
  var amp = spec.vol * (vel / 15);
  var atk = spec.atk || 0.008;
  var rel = spec.rel || 0.06;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + atk);
  var hold = Math.max(atk + 0.01, dur - rel);
  g.gain.setValueAtTime(Math.max(0.0002, amp), t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
  if (spec.sub){
    var so = ctx.createOscillator(), sg = ctx.createGain();
    so.type = 'sine';
    so.frequency.setValueAtTime(midiHz(Math.max(12, midi - 12)), t);
    var samp = spec.sub * (vel / 15);
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(Math.max(0.0002, samp), t + Math.max(atk, 0.02));
    sg.gain.setValueAtTime(Math.max(0.0002, samp), t + hold);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    so.connect(sg); sg.connect(master);
    so.start(t);
    so.stop(t + dur + 0.02);
  }
}

function playDrum(t, kind, dur, vel){
  var spec = voiceSpec('drum');
  if (!spec.vol) return;
  var ctx = getActx();
  var src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  var f = ctx.createBiquadFilter();
  var g = ctx.createGain();
  var amp = spec.vol * (vel / 15);
  if (kind === 1){
    f.type = 'highpass'; f.frequency.value = 4500; f.Q.value = 0.7;
    amp *= 0.55; dur = Math.min(dur, 0.05);
  } else {
    f.type = 'lowpass'; f.frequency.value = kind === 2 ? 1800 : 420; f.Q.value = 0.8;
    dur = Math.min(dur, kind === 2 ? 0.22 : 0.1);
  }
  g.gain.setValueAtTime(amp, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
  if (kind === 0){
    var o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(88, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
    og.gain.setValueAtTime(amp * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.1);
  } else if (kind === 2){
    var c = ctx.createOscillator(), cg = ctx.createGain();
    c.type = 'triangle'; c.frequency.value = 1568;
    cg.gain.setValueAtTime(amp * 0.45, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    c.connect(cg); cg.connect(master);
    c.start(t); c.stop(t + 0.22);
  }
}

function scheduleRange(from, to){
  var ld = loopDur();
  var ts = tickSec();
  if (ld <= 0 || to <= from) return;
  for (var v = 0; v < CHAN.length; v++){
    var name = CHAN[v];
    var evs = (score.tracks && score.tracks[name]) || [];
    var spec = voiceSpec(name);
    for (var i = 0; i < evs.length; i++){
      var ev = evs[i];
      var local = ev[0] * ts;
      var k = Math.ceil((from - origin - local) / ld - 1e-9);
      if (k < 0) k = 0;
      for (;;){
        var t = origin + k * ld + local;
        if (t >= to) break;
        if (t >= from){
          var dur = Math.max(0.03, ev[2] * ts);
          if (name === 'drum') playDrum(t, ev[1], dur, ev[3] || 10);
          else playOsc(t, ev[1], dur, ev[3] || 10, spec);
        }
        k++;
        if (k > 20000) break;
      }
    }
  }
}

function pump(){
  if (!playing || hushed) return;
  try{
    var ctx = getActx();
    ensureGraph();
    var now = ctx.currentTime;
    var from = Math.max(now - 0.01, origin, schedUntil);
    var to = now + 0.3;
    if (to > from){
      scheduleRange(from, to);
      schedUntil = to;
    }
  }catch(e){}
}

export function startMusic(){
  try{
    stopMusic();
    var ctx = getActx();
    ensureGraph();
    playing = true;
    hushed = false;
    schedUntil = 0;
    origin = ctx.currentTime + 0.06;
    pausedAt = 0;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(masterLevel(), ctx.currentTime + fadeInSec());
    if (timer) clearInterval(timer);
    timer = setInterval(pump, 40);
    pump();
  }catch(e){}
}

export function hushMusic(){
  if (!playing || hushed) return;
  try{
    var ctx = getActx();
    hushed = true;
    pausedAt = Math.max(0, ctx.currentTime - origin);
    if (master){
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
    }
  }catch(e){}
}

export function resumeMusic(){
  if (!playing) { startMusic(); return; }
  if (!hushed) return;
  try{
    var ctx = getActx();
    ensureGraph();
    hushed = false;
    origin = ctx.currentTime - pausedAt;
    schedUntil = ctx.currentTime;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
    pump();
  }catch(e){}
}

export function stopMusic(){
  playing = false;
  hushed = true;
  if (timer){ clearInterval(timer); timer = null; }
  try{
    if (master){
      var ctx = getActx();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
    }
  }catch(e){}
}

export function musicPlaying(){ return playing && !hushed; }

export function getMix(){
  return {
    master: mix.master,
    fadeIn: mix.fadeIn,
    solo: mix.solo,
    voices: mix.voices,
    channels: CHAN,
    waves: WAVES,
    defaults: score.voices || {},
    loopSec: loopDur(),
    bpm: score.bpm,
    key: score.key
  };
}

export function setMixMaster(v){
  mix.master = Math.max(0, Math.min(2, +v || 0));
  saveMix();
  try{
    if (master && playing && !hushed){
      var ctx = getActx();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.04);
    }
  }catch(e){}
}

export function setMixFade(v){
  mix.fadeIn = Math.max(0.2, Math.min(8, +v || BASE_FADE));
  saveMix();
}

export function setMixVoice(name, patch){
  if (CHAN.indexOf(name) < 0) return;
  var cur = mix.voices[name] || {};
  var next = { vol: cur.vol, wave: cur.wave, mute: cur.mute };
  if (patch.vol != null) next.vol = Math.max(0, Math.min(2.5, +patch.vol));
  if (patch.wave != null) next.wave = WAVES.indexOf(patch.wave) >= 0 ? patch.wave : next.wave;
  if (patch.mute != null) next.mute = !!patch.mute;
  mix.voices[name] = next;
  saveMix();
}

export function setMixSolo(name){
  mix.solo = name && CHAN.indexOf(name) >= 0 ? name : '';
  saveMix();
}

export function resetMix(){
  mix = { master: 1, fadeIn: BASE_FADE, voices: {}, solo: '' };
  saveMix();
  try{
    if (master && playing && !hushed){
      var ctx = getActx();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.04);
    }
  }catch(e){}
}
