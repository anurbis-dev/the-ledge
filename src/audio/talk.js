import { getActx, resumeAudio } from './context.js';
import { BAKED } from '../core/defaults.js';

var TALK_KEY = 'ledge.dev.talk';

export var TALK_VARIANTS = [
  {
    id: 'triChirp',
    name: 'Triangle chirp',
    desc: 'Soft hops with a tiny up-slide. Close to Animal Crossing.',
    osc: 'triangle', dur: 0.036, slide: 1.14, peak: 0.018
  },
  {
    id: 'squareTalk',
    name: 'Square talk',
    desc: 'Classic RPG blips. Clicky, readable, a bit toy-like.',
    osc: 'square', dur: 0.026, slide: 0.94, peak: 0.012
  },
  {
    id: 'sineMurmur',
    name: 'Sine murmur',
    desc: 'Round and quiet. Least beepy, almost a hum.',
    osc: 'sine', dur: 0.048, slide: 1.04, peak: 0.022
  },
  {
    id: 'pulseGb',
    name: 'Pulse GB',
    desc: 'Short Game Boy pulses. Dry, old handheld feel.',
    osc: 'square', dur: 0.02, slide: 1.0, peak: 0.01, fast: true
  },
  {
    id: 'sawMumble',
    name: 'Saw mumble',
    desc: 'Gravelly saw. Suits an older NPC.',
    osc: 'sawtooth', dur: 0.034, slide: 0.86, peak: 0.01
  },
  {
    id: 'duoFifth',
    name: 'Duo fifth',
    desc: 'Two triangles a fifth apart. Thicker, a bit choral.',
    osc: 'triangle', dur: 0.04, slide: 1.06, peak: 0.012, fifth: true
  },
  {
    id: 'pentaHop',
    name: 'Penta hop',
    desc: 'Pitches snap to a minor pentatonic. More song than speech.',
    osc: 'triangle', dur: 0.032, slide: 1.0, peak: 0.016, scale: 'penta'
  },
  {
    id: 'breathPop',
    name: 'Breath pop',
    desc: 'Sine plus a speck of noise. Soft mouth-click.',
    osc: 'sine', dur: 0.028, slide: 1.08, peak: 0.014, noise: 0.35
  }
];

export var TALK_VOICES = {
  hero:   { id: 'hero',   variant: 'triChirp',   base: 540, spread: 90, vol: 1, rate: 0.028 },
  hermit: { id: 'hermit', variant: 'sawMumble',  base: 210, spread: 38, vol: 1, rate: 0.038 },
  wanderer:{ id: 'wanderer', variant: 'squareTalk', base: 310, spread: 52, vol: 1, rate: 0.032 },
  npc:    { id: 'npc',    variant: 'squareTalk', base: 300, spread: 50, vol: 1, rate: 0.032 }
};

var PENTA = [0, 3, 5, 7, 10];

export function defaultTalkPrefs(){
  var d = { hero: 'triChirp', npc: 'squareTalk', vol: 1 };
  if (BAKED.talk){
    if (BAKED.talk.hero) d.hero = BAKED.talk.hero;
    if (BAKED.talk.npc) d.npc = BAKED.talk.npc;
    if (BAKED.talk.vol != null) d.vol = +BAKED.talk.vol;
  }
  return d;
}

export function loadTalkPrefs(){
  var d = defaultTalkPrefs();
  try {
    var o = JSON.parse(localStorage.getItem(TALK_KEY));
    if (o && typeof o === 'object'){
      if (o.hero) d.hero = o.hero;
      if (o.npc) d.npc = o.npc;
      if (o.vol != null) d.vol = +o.vol;
    }
  } catch (e){}
  return d;
}

export function saveTalkPrefs(p){
  var cur = loadTalkPrefs();
  if (p.hero) cur.hero = p.hero;
  if (p.npc) cur.npc = p.npc;
  if (p.vol != null) cur.vol = p.vol;
  try { localStorage.setItem(TALK_KEY, JSON.stringify(cur)); } catch (e){}
  return cur;
}

export function talkSnapshot(){
  try {
    var raw = localStorage.getItem(TALK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_){ return null; }
}

export function findVariant(id){
  for (var i = 0; i < TALK_VARIANTS.length; i++)
    if (TALK_VARIANTS[i].id === id) return TALK_VARIANTS[i];
  return TALK_VARIANTS[0];
}

export function resolveVoice(who){
  var prefs = loadTalkPrefs();
  var base = TALK_VOICES[who] || TALK_VOICES.npc;
  var v = {
    id: base.id,
    variant: base.variant,
    base: base.base,
    spread: base.spread,
    vol: (base.vol || 1) * (prefs.vol != null ? prefs.vol : 1),
    rate: base.rate
  };
  if (who === 'hero' && prefs.hero) v.variant = prefs.hero;
  if (who !== 'hero' && prefs.npc) v.variant = prefs.npc;
  return v;
}

function letterHz(ch, voice, spec){
  var c = ch.toLowerCase();
  var code = c.charCodeAt(0);
  var vowel = 'aeiou'.indexOf(c) >= 0;
  var n = (code * 13 + 7) % 11;
  var f;
  if (spec.scale === 'penta'){
    var deg = PENTA[code % PENTA.length];
    f = voice.base * Math.pow(2, (deg - 5) / 12);
  } else {
    f = voice.base * Math.pow(2, (n - 5) * (voice.spread / 90) / 12);
  }
  if (vowel) f *= 1.08;
  return f;
}

function noiseBuf(actx){
  var n = actx.createBuffer(1, 256, actx.sampleRate);
  var d = n.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return n;
}

var _noise = null;

export function talkBlip(ch, who){
  if (!ch || ch === ' ') return;
  if ('.,!?;:\'"-'.indexOf(ch) >= 0) return;
  try {
    resumeAudio();
    var actx = getActx();
    if (!actx) return;
    var voice = typeof who === 'string' || !who ? resolveVoice(who || 'hero') : who;
    var spec = findVariant(voice.variant);
    var f = letterHz(ch, voice, spec);
    var now = actx.currentTime;
    var dur = spec.dur;
    var peak = (spec.peak || 0.016) * (voice.vol || 1);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    g.connect(actx.destination);

    var o = actx.createOscillator();
    o.type = spec.osc || 'triangle';
    o.frequency.setValueAtTime(f, now);
    if (spec.slide && spec.slide !== 1)
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f * spec.slide), now + dur);
    o.connect(g);
    o.start(now);
    o.stop(now + dur + 0.01);

    if (spec.fifth){
      var o2 = actx.createOscillator();
      o2.type = spec.osc || 'triangle';
      o2.frequency.setValueAtTime(f * 1.5, now);
      o2.connect(g);
      o2.start(now);
      o2.stop(now + dur + 0.01);
    }
    if (spec.noise){
      if (!_noise) _noise = noiseBuf(actx);
      var src = actx.createBufferSource();
      src.buffer = _noise;
      var ng = actx.createGain();
      ng.gain.setValueAtTime(peak * spec.noise, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.6);
      src.connect(ng); ng.connect(actx.destination);
      src.start(now);
      src.stop(now + dur);
    }
  } catch (e){}
}
