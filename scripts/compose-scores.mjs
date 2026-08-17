#!/usr/bin/env node
/**
 * Авторские chip-треки формой Sonic/Contra:
 *   intro (один раз) → A verse → B chorus → C end → луп с A.
 *   node scripts/compose-scores.mjs
 * lantern-key не трогает.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'audio', 'scores');
const WAV_DIR = path.join(ROOT, 'tmp', 'scores');
const DIV = 4;
const BAR = 16;
const SR = 22050;

const PC = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
const QUAL = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

const BASE_VOICES = {
  bass: { wave: 'sawtooth', vol: 0.3, sub: 0.2, atk: 0.018, rel: 0.08 },
  pad:  { wave: 'triangle', vol: 0.065, atk: 0.08, rel: 0.12 },
  arp:  { wave: 'square', vol: 0.046, atk: 0.004, rel: 0.04 },
  lead: { wave: 'square', vol: 0.06, atk: 0.01, rel: 0.1 },
  harm: { wave: 'triangle', vol: 0.044, atk: 0.02, rel: 0.1 },
  echo: { wave: 'square', vol: 0.022, atk: 0.01, rel: 0.14 },
  drum: { wave: 'noise', vol: 0.055 },
};

function noteMidi(tok){
  const m = String(tok).match(/^([A-G](?:#|b)?)(-?\d)$/);
  if (!m) throw new Error('bad note ' + tok);
  const pc = PC[m[1]];
  if (pc == null) throw new Error('bad pitch ' + tok);
  return (Number(m[2]) + 1) * 12 + pc;
}

function parseChord(name){
  const m = String(name).match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m) throw new Error('bad chord ' + name);
  const q = m[2] === '' ? 'maj'
    : m[2] === 'm' ? 'min'
    : m[2] === 'dim' ? 'dim'
    : m[2] === '7' ? '7'
    : m[2] === 'maj7' ? 'maj7'
    : m[2] === 'm7' ? 'min7'
    : m[2];
  const ints = QUAL[q];
  if (!ints) throw new Error('bad quality ' + name);
  return { root: PC[m[1]], ints, name };
}

function clamp(m, lo, hi){
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

function scalePcs(keyRoot, mode){
  const steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11]
    : mode === 'dorian' ? [0, 2, 3, 5, 7, 9, 10]
    : mode === 'harmonic' ? [0, 2, 3, 5, 7, 8, 11]
    : [0, 2, 3, 5, 7, 8, 10];
  return new Set(steps.map((d) => (d + keyRoot) % 12));
}

function scaleThird(midi, scale){
  for (const d of [3, 4, 2, 5]){
    if (scale.has(((midi + d) % 12 + 12) % 12)) return midi + d;
  }
  return midi + 3;
}

function parseEv(tok){
  if (tok === '.' || tok[0] === 'r'){
    const n = tok === '.' ? 4 : +String(tok).replace(/^r:?/, '');
    return { rest: n || 4 };
  }
  const m = String(tok).match(/^([A-G](?:#|b)?-?\d):(\d+)(?:v(\d+))?$/);
  if (!m) throw new Error('bad ev ' + tok);
  return { midi: noteMidi(m[1]), dur: +m[2], vel: m[3] ? +m[3] : null };
}

function flattenBars(bars, t0, defaultVel, label){
  const out = [];
  for (let b = 0; b < bars.length; b++){
    const line = bars[b];
    let t = 0;
    for (const tok of line){
      const ev = parseEv(tok);
      if (ev.rest){ t += ev.rest; continue; }
      out.push([t0 + b * BAR + t, ev.midi, ev.dur, ev.vel != null ? ev.vel : defaultVel]);
      t += ev.dur;
    }
    if (t !== BAR){
      throw new Error((label || 'lead') + ' bar ' + (b + 1) + ' is ' + t + ' ticks · ' + line.join(' '));
    }
  }
  return out;
}

function mergeSame(evs){
  const out = [];
  const sorted = evs.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const ev of sorted){
    const p = out[out.length - 1];
    if (p && p[1] === ev[1] && p[0] + p[2] >= ev[0]){
      p[2] = Math.max(p[2], ev[0] + ev[2] - p[0]);
      p[3] = Math.max(p[3], ev[3]);
    } else out.push(ev.slice());
  }
  return out;
}

function bassBar(t, chord, style, barInSec, nBars){
  const c = parseChord(chord);
  const root = clamp(24 + c.root, 28, 41);
  const fifth = clamp(root + 7, 28, 43);
  const oct = clamp(root + 12, 28, 43);
  const out = [];
  if (style === 'none') return out;
  if (style === 'hold'){
    out.push([t, root, BAR, 9]);
    return out;
  }
  if (style === 'enter'){
    if (barInSec < 2) return out;
    if (barInSec < 4){ out.push([t, root, BAR, 8]); return out; }
    out.push([t, root, 8, 10]);
    out.push([t + 8, fifth, 8, 9]);
    return out;
  }
  if (style === 'drive'){
    const walk = barInSec === nBars - 1 ? oct : fifth;
    out.push([t, root, 2, 13]);
    out.push([t + 2, root, 2, 11]);
    out.push([t + 6, fifth, 2, 12]);
    out.push([t + 10, root, 2, 11]);
    out.push([t + 14, walk, 2, 10]);
    return out;
  }
  if (style === 'walk'){
    out.push([t, root, 4, 12]);
    out.push([t + 4, root, 4, 10]);
    out.push([t + 8, fifth, 4, 11]);
    out.push([t + 12, barInSec % 2 ? oct : root, 4, 10]);
    return out;
  }
  out.push([t, root, 6, 12]);
  out.push([t + 8, fifth, 6, 10]);
  if (barInSec === nBars - 1) out.push([t + 14, oct, 2, 9]);
  return out;
}

function padBar(t, chord, vel){
  const c = parseChord(chord);
  const root = clamp(48 + c.root, 48, 64);
  const third = clamp(root + c.ints[1], 50, 67);
  const fifth = clamp(root + 7, 52, 69);
  return [
    [t, root, BAR, vel],
    [t, fifth, BAR, Math.max(3, vel - 2)],
    [t, third, BAR, Math.max(3, vel - 3)],
  ];
}

function arpBar(t, chord, density){
  if (!density || density === 'none') return [];
  const c = parseChord(chord);
  const tones = c.ints.map((iv) => clamp(55 + ((c.root + iv) % 12), 55, 74));
  const step = density === 'sparse' ? 8 : density === 'busy' ? 2 : 4;
  const start = density === 'sparse' ? 4 : 2;
  const out = [];
  let k = 0;
  for (let i = start; i < BAR; i += step){
    out.push([t + i, tones[k % tones.length], 1, density === 'busy' ? 8 : 7]);
    k++;
  }
  return out;
}

function drumBar(t, kit, barInSec, nBars){
  const fill = barInSec === nBars - 1;
  const out = [];
  if (!kit || kit === 'none') return out;

  if (kit === 'build'){
    for (let h = 2; h < 16; h += 2) out.push([t + h, 1, 1, 5]);
    if (barInSec >= 2) out.push([t, 0, 2, 10]);
    if (barInSec >= 4){
      out.push([t + 8, 0, 2, 9]);
      out.push([t + 4, 2, 2, 10]);
      out.push([t + 12, 2, 2, 11]);
    }
    if (fill){
      out.push([t + 8, 2, 1, 13]);
      out.push([t + 10, 2, 1, 12]);
      out.push([t + 12, 2, 1, 14]);
      out.push([t + 14, 2, 1, 13]);
    }
    return out;
  }

  if (kit === 'soft'){
    if (barInSec % 4 === 0) out.push([t, 0, 2, 8]);
    out.push([t + 4, 1, 1, 5]);
    out.push([t + 12, 1, 1, 6]);
    if (fill){
      out.push([t + 8, 2, 1, 9]);
      out.push([t + 12, 2, 1, 10]);
    }
    return out;
  }

  if (kit === 'half'){
    out.push([t, 0, 2, 10]);
    out.push([t + 8, 2, 2, 9]);
    out.push([t + 4, 1, 1, 5]);
    out.push([t + 12, 1, 1, 5]);
    if (fill){
      out.push([t + 10, 2, 1, 12]);
      out.push([t + 12, 2, 1, 13]);
      out.push([t + 14, 2, 1, 12]);
    }
    return out;
  }

  const chorus = kit === 'chorus';
  out.push([t, 0, 2, 12]);
  out.push([t + 8, 0, 2, chorus ? 11 : 10]);
  out.push([t + 4, 2, 2, 12]);
  out.push([t + 12, 2, 2, 13]);
  if (chorus) out.push([t + 6, 0, 1, 8]);
  const hatStep = chorus ? 1 : 2;
  for (let h = 0; h < 16; h += hatStep){
    if (h === 4 || h === 12) continue;
    out.push([t + h, 1, 1, h % 4 === 0 ? 6 : 5]);
  }
  if (fill){
    out.push([t + 8, 2, 1, 13]);
    out.push([t + 10, 2, 1, 12]);
    out.push([t + 12, 2, 1, 14]);
    out.push([t + 14, 2, 1, 13]);
    out.push([t + 15, 0, 1, 12]);
  }
  return out;
}

function arrange(lead, scale, loopEnd){
  const harm = [];
  const echo = [];
  for (const e of lead){
    if (e[2] >= 4){
      const m = scaleThird(e[1], scale);
      if (m !== e[1]) harm.push([e[0], clamp(m, 58, 81), e[2], Math.max(5, e[3] - 4)]);
    }
    const et = e[0] + 3;
    if (et < loopEnd) echo.push([et, e[1], Math.max(1, e[2] - 1), Math.max(4, e[3] - 6)]);
  }
  return { harm, echo };
}

function midiToHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }

function renderWav(score, file){
  const tickSec = (60 / score.bpm) / score.div;
  const dur = score.loopEnd * tickSec;
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  function addOsc(tick, midi, dTicks, vel, wave, vol){
    const t0 = Math.floor(tick * tickSec * SR);
    const len = Math.floor(dTicks * tickSec * SR);
    const f = midiToHz(midi);
    const atk = Math.max(1, Math.floor(SR * 0.012));
    const rel = Math.max(1, Math.floor(SR * 0.06));
    const amp = vol * (vel / 15);
    for (let i = 0; i < len && t0 + i < n; i++){
      const ph = (i / SR) * f;
      let s = 0;
      if (wave === 'sine') s = Math.sin(2 * Math.PI * ph);
      else if (wave === 'sawtooth') s = 2 * (ph % 1) - 1;
      else if (wave === 'triangle') s = 2 * Math.abs(2 * (ph % 1) - 1) - 1;
      else s = (ph % 1 < 0.5 ? 1 : -1);
      let e = 1;
      if (i < atk) e = i / atk;
      else if (i > len - rel) e = Math.max(0, (len - i) / rel);
      out[t0 + i] += s * amp * e;
    }
  }
  function addNoise(tick, kind, dTicks, vel){
    const t0 = Math.floor(tick * tickSec * SR);
    const len = Math.floor(dTicks * tickSec * SR);
    const amp = (score.voices.drum.vol || 0.055) * (vel / 15);
    let lp = 0;
    for (let i = 0; i < len && t0 + i < n; i++){
      const raw = Math.random() * 2 - 1;
      lp = lp * 0.85 + raw * 0.15;
      const s = kind === 1 ? raw - lp : lp;
      const e = Math.exp(-i / (kind === 1 ? SR * 0.03 : SR * 0.07));
      out[t0 + i] += s * amp * e * (kind === 0 ? 1.4 : kind === 2 ? 1.1 : 0.65);
    }
  }
  for (const name of ['bass', 'pad', 'arp', 'lead', 'harm', 'echo']){
    const spec = score.voices[name];
    if (!spec) continue;
    for (const ev of score.tracks[name] || []){
      addOsc(ev[0], ev[1], ev[2], ev[3], spec.wave || 'square', spec.vol);
    }
  }
  for (const ev of score.tracks.drum || []) addNoise(ev[0], ev[1], ev[2], ev[3]);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.85 / peak;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++){
    buf.writeInt16LE((Math.max(-1, Math.min(1, out[i] * g)) * 32767) | 0, 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

function chordsOf(sec){
  if (Array.isArray(sec.chords)) return sec.chords;
  return String(sec.chords).trim().split(/\s+/);
}

function build(song){
  const scale = scalePcs(PC[song.tonic], song.mode);
  const tracks = { bass: [], pad: [], arp: [], lead: [], harm: [], echo: [], drum: [] };
  const form = [];
  let t = 0;
  let loopStart = 0;
  for (const sec of song.sections){
    const chords = chordsOf(sec);
    const nBars = chords.length;
    if (sec.lead.length !== nBars){
      throw new Error(song.id + ' ' + sec.id + ': lead ' + sec.lead.length + ' vs chords ' + nBars);
    }
    if (sec.once) loopStart = t + nBars * BAR;
    form.push({
      id: sec.id,
      title: sec.title || sec.id,
      start: t,
      end: t + nBars * BAR,
      once: !!sec.once,
    });
    const leadVel = sec.id === 'B' ? 13 : sec.id === 'intro' ? 10 : 12;
    tracks.lead.push(...flattenBars(sec.lead, t, leadVel, song.id + '/' + sec.id));
    const padVel = sec.id === 'intro' ? 3 : sec.id === 'B' ? 8 : sec.id === 'C' ? 5 : 6;
    for (let i = 0; i < nBars; i++){
      const bt = t + i * BAR;
      tracks.bass.push(...bassBar(bt, chords[i], sec.bass || 'pulse', i, nBars));
      if (sec.pad !== 'none') tracks.pad.push(...padBar(bt, chords[i], padVel));
      tracks.arp.push(...arpBar(bt, chords[i], sec.arp || 'none'));
      tracks.drum.push(...drumBar(bt, sec.kit || 'verse', i, nBars));
    }
    t += nBars * BAR;
  }
  const loopEnd = t;
  const layers = arrange(tracks.lead, scale, loopEnd);
  tracks.harm = layers.harm;
  tracks.echo = layers.echo;
  for (const k of Object.keys(tracks)){
    if (k !== 'pad') tracks[k] = mergeSame(tracks[k]);
  }
  const voices = {};
  for (const k of Object.keys(BASE_VOICES)){
    voices[k] = Object.assign({}, BASE_VOICES[k], (song.voices && song.voices[k]) || {});
  }
  const modeName = song.mode === 'harmonic' ? 'minor' : song.mode;
  return {
    name: song.id,
    src: 'composed',
    title: song.title,
    bpm: song.bpm,
    div: DIV,
    key: song.tonic + ' ' + modeName,
    loopStart,
    loopEnd,
    master: song.master != null ? song.master : 0.1,
    fadeIn: song.fadeIn != null ? song.fadeIn : 1.4,
    form,
    voices,
    tracks,
  };
}

const SONGS = [
  {
    id: 'moss-steps',
    title: 'Moss Steps',
    tonic: 'G',
    mode: 'major',
    bpm: 128,
    voices: {
      bass: { wave: 'square', vol: 0.24, sub: 0.16 },
      lead: { wave: 'square', vol: 0.064 },
      arp: { vol: 0.05 },
      drum: { vol: 0.06 },
    },
    sections: [
      {
        id: 'intro', title: 'Intro', once: true,
        kit: 'build', bass: 'enter', arp: 'none', pad: 'none',
        chords: 'G G G G C D G D',
        lead: [
          ['r:4', 'G4:2', 'B4:2', 'D5:4', 'r:4'],
          ['r:8', 'D5:2', 'E5:2', 'D5:4'],
          ['r:4', 'B4:4', 'A4:4', 'G4:4'],
          ['r:16'],
          ['C5:4', 'E5:4', 'G5:4', 'E5:4'],
          ['D5:4', 'F#5:4', 'A5:4', 'r:4'],
          ['G5:4', 'D5:4', 'B4:4', 'G4:4'],
          ['A4:4', 'F#4:4', 'D4:4', 'r:4'],
        ],
      },
      {
        id: 'A', title: 'Verse',
        kit: 'verse', bass: 'walk', arp: 'mid',
        chords: 'G G Em Em C C D D G G Em Em C C D D',
        lead: [
          ['G4:2', 'B4:2', 'D5:4', 'B4:2', 'A4:2', 'G4:4'],
          ['A4:4', 'B4:2', 'D5:2', 'E5:4', 'D5:4'],
          ['E5:4', 'B4:4', 'G4:4', 'E4:4'],
          ['A4:2', 'B4:2', 'G4:4', 'F#4:4', 'E4:4'],
          ['C5:4', 'E5:4', 'G5:4', 'E5:4'],
          ['D5:4', 'C5:4', 'B4:4', 'A4:4'],
          ['A4:4', 'D5:4', 'F#5:4', 'D5:4'],
          ['E5:4', 'D5:4', 'C5:2', 'B4:2', 'A4:4'],
          ['B4:2', 'D5:2', 'G5:4', 'E5:2', 'D5:2', 'B4:4'],
          ['C5:4', 'D5:2', 'E5:2', 'D5:8'],
          ['E5:4', 'C5:4', 'D5:2', 'B4:2', 'A4:4'],
          ['B4:4', 'A4:4', 'G4:8'],
          ['G4:2', 'A4:2', 'B4:4', 'D5:4', 'B4:4'],
          ['C5:2', 'D5:2', 'E5:4', 'D5:4', 'B4:4'],
          ['A4:4', 'C5:2', 'B4:2', 'A4:4', 'F#4:4'],
          ['G4:4', 'D4:4', 'G4:8'],
        ],
      },
      {
        id: 'B', title: 'Chorus',
        kit: 'chorus', bass: 'drive', arp: 'busy',
        chords: 'C C G G Am Am D D C C G G D D G G',
        lead: [
          ['E5:4', 'G5:4', 'E5:4', 'C5:4'],
          ['D5:4', 'E5:4', 'G5:8'],
          ['D5:2', 'E5:2', 'D5:4', 'B4:4', 'G4:4'],
          ['A4:4', 'B4:4', 'D5:8'],
          ['C5:4', 'E5:4', 'A5:4', 'E5:4'],
          ['G5:4', 'E5:4', 'D5:8'],
          ['F#5:4', 'A5:4', 'D5:4', 'A4:4'],
          ['G5:4', 'F#5:4', 'E5:4', 'D5:4'],
          ['E5:2', 'G5:2', 'E5:4', 'C5:4', 'G4:4'],
          ['A4:4', 'C5:4', 'E5:8'],
          ['D5:4', 'B4:4', 'G4:4', 'D5:4'],
          ['E5:4', 'D5:4', 'B4:8'],
          ['A4:4', 'D5:4', 'F#5:4', 'A5:4'],
          ['G5:4', 'F#5:4', 'E5:4', 'D5:4'],
          ['C5:4', 'B4:4', 'A4:4', 'F#4:4'],
          ['G4:8', 'D5:4', 'G5:4'],
        ],
      },
      {
        id: 'C', title: 'End',
        kit: 'half', bass: 'pulse', arp: 'sparse',
        chords: 'Em Em C C G D G D',
        lead: [
          ['E5:8', 'B4:4', 'G4:4'],
          ['A4:4', 'G4:4', 'F#4:8'],
          ['C5:8', 'G4:4', 'E4:4'],
          ['D4:4', 'E4:4', 'G4:8'],
          ['G4:4', 'B4:4', 'D5:4', 'G5:4'],
          ['F#5:4', 'D5:4', 'A4:8'],
          ['G4:4', 'A4:4', 'B4:4', 'D5:4'],
          ['A4:4', 'F#4:4', 'D4:4', 'r:4'],
        ],
      },
    ],
  },
  {
    id: 'mist-shelf',
    title: 'Mist Shelf',
    tonic: 'D',
    mode: 'minor',
    bpm: 104,
    fadeIn: 2.2,
    voices: {
      bass: { wave: 'triangle', vol: 0.28, sub: 0.18 },
      lead: { wave: 'square', vol: 0.056, rel: 0.13 },
      drum: { vol: 0.044 },
    },
    sections: [
      {
        id: 'intro', title: 'Intro', once: true,
        kit: 'build', bass: 'enter', arp: 'none',
        chords: 'Dm Dm Dm Dm Bb C Dm A',
        lead: [
          ['r:8', 'D4:8'],
          ['r:4', 'F4:4', 'A4:8'],
          ['G4:4', 'F4:4', 'E4:8'],
          ['r:16'],
          ['Bb4:8', 'A4:4', 'G4:4'],
          ['A4:8', 'C5:8'],
          ['D5:8', 'A4:8'],
          ['G4:4', 'E4:4', 'A4:8'],
        ],
      },
      {
        id: 'A', title: 'Verse',
        kit: 'verse', bass: 'pulse', arp: 'mid',
        chords: 'Dm Dm Bb Bb F F C C Dm Dm Bb Bb F F C C',
        lead: [
          ['D4:4', 'F4:4', 'A4:6', 'G4:2'],
          ['F4:4', 'E4:4', 'D4:8'],
          ['D4:4', 'F4:4', 'G4:4', 'A4:4'],
          ['Bb4:6', 'A4:2', 'G4:4', 'F4:4'],
          ['A4:4', 'C5:4', 'D5:6', 'C5:2'],
          ['Bb4:4', 'A4:4', 'G4:8'],
          ['G4:4', 'A4:4', 'Bb4:4', 'A4:4'],
          ['G4:4', 'F4:2', 'E4:2', 'D4:8'],
          ['D4:2', 'F4:2', 'A4:4', 'G4:2', 'F4:2', 'E4:4'],
          ['F4:4', 'D4:4', 'E4:2', 'F4:2', 'D4:4'],
          ['F4:4', 'G4:4', 'A4:4', 'C5:4'],
          ['Bb4:8', 'A4:4', 'G4:4'],
          ['A4:4', 'C5:2', 'D5:2', 'C5:4', 'A4:4'],
          ['Bb4:4', 'G4:4', 'A4:8'],
          ['F4:2', 'G4:2', 'A4:4', 'G4:2', 'F4:2', 'E4:4'],
          ['D4:4', 'A3:4', 'D4:8'],
        ],
      },
      {
        id: 'B', title: 'Chorus',
        kit: 'chorus', bass: 'walk', arp: 'busy',
        chords: 'Gm Gm Dm Dm A A Dm Dm Bb Bb F F C C A A',
        lead: [
          ['D5:4', 'Bb4:4', 'G4:4', 'Bb4:4'],
          ['A4:4', 'G4:4', 'F4:8'],
          ['A4:4', 'D5:4', 'F5:4', 'D5:4'],
          ['E5:4', 'D5:4', 'A4:8'],
          ['E5:4', 'C#5:4', 'A4:4', 'E5:4'],
          ['F5:4', 'E5:4', 'D5:8'],
          ['D5:2', 'F5:2', 'A5:4', 'G5:4', 'F5:4'],
          ['E5:4', 'D5:4', 'A4:8'],
          ['Bb4:4', 'D5:4', 'F5:4', 'D5:4'],
          ['C5:4', 'Bb4:4', 'A4:8'],
          ['A4:4', 'C5:4', 'F5:4', 'C5:4'],
          ['D5:4', 'C5:4', 'A4:8'],
          ['G4:4', 'C5:4', 'E5:4', 'C5:4'],
          ['D5:4', 'E5:4', 'F5:8'],
          ['E5:4', 'C#5:4', 'A4:4', 'E5:4'],
          ['D5:8', 'A4:4', 'D5:4'],
        ],
      },
      {
        id: 'C', title: 'End',
        kit: 'half', bass: 'hold', arp: 'sparse',
        chords: 'Gm A Dm Bb C A Dm A',
        lead: [
          ['G4:8', 'Bb4:4', 'D5:4'],
          ['C#5:8', 'A4:8'],
          ['D5:8', 'A4:4', 'F4:4'],
          ['Bb4:8', 'F4:8'],
          ['G4:4', 'A4:4', 'C5:8'],
          ['A4:4', 'E4:4', 'A4:8'],
          ['D4:8', 'F4:4', 'A4:4'],
          ['G4:4', 'E4:4', 'A4:4', 'r:4'],
        ],
      },
    ],
  },
  {
    id: 'still-pool',
    title: 'Still Pool',
    tonic: 'A',
    mode: 'harmonic',
    bpm: 88,
    fadeIn: 2.8,
    voices: {
      bass: { wave: 'sine', vol: 0.22, sub: 0.14, atk: 0.05, rel: 0.16 },
      pad: { wave: 'sine', vol: 0.09, atk: 0.16, rel: 0.2 },
      arp: { wave: 'triangle', vol: 0.03 },
      lead: { wave: 'triangle', vol: 0.072, atk: 0.03, rel: 0.18 },
      harm: { wave: 'sine', vol: 0.038 },
      echo: { vol: 0.02, rel: 0.22 },
      drum: { vol: 0.03 },
    },
    sections: [
      {
        id: 'intro', title: 'Intro', once: true,
        kit: 'soft', bass: 'hold', arp: 'none',
        chords: 'Am Am F F C G Am E',
        lead: [
          ['A4:16'],
          ['r:8', 'E4:8'],
          ['F4:12', 'A4:4'],
          ['G4:8', 'E4:8'],
          ['C5:12', 'G4:4'],
          ['B4:8', 'G4:8'],
          ['A4:16'],
          ['E4:8', 'r:8'],
        ],
      },
      {
        id: 'A', title: 'Verse',
        kit: 'soft', bass: 'hold', arp: 'sparse',
        chords: 'Am Am F F C C G G Am Am F F C C G G',
        lead: [
          ['A4:12', 'E4:4'],
          ['C5:8', 'B4:4', 'A4:4'],
          ['G4:12', 'E4:4'],
          ['A4:16'],
          ['E4:4', 'A4:4', 'C5:8'],
          ['B4:4', 'A4:4', 'G4:8'],
          ['F4:8', 'E4:4', 'D4:4'],
          ['E4:12', 'r:4'],
          ['A4:4', 'C5:4', 'E5:8'],
          ['D5:4', 'C5:4', 'B4:8'],
          ['C5:4', 'A4:4', 'F4:8'],
          ['G4:4', 'A4:4', 'C5:8'],
          ['E5:8', 'C5:8'],
          ['B4:4', 'A4:4', 'G4:8'],
          ['F4:4', 'E4:4', 'D4:4', 'E4:4'],
          ['A4:12', 'r:4'],
        ],
      },
      {
        id: 'B', title: 'Chorus',
        kit: 'verse', bass: 'pulse', arp: 'mid',
        chords: 'F F C C G G Am Am Dm Dm Am Am E E Am Am',
        lead: [
          ['A4:4', 'C5:4', 'F5:8'],
          ['E5:4', 'C5:4', 'A4:8'],
          ['G4:4', 'C5:4', 'E5:8'],
          ['D5:4', 'C5:4', 'G4:8'],
          ['B4:4', 'D5:4', 'G5:8'],
          ['E5:4', 'D5:4', 'B4:8'],
          ['C5:4', 'E5:4', 'A5:8'],
          ['G5:4', 'E5:4', 'C5:8'],
          ['F5:8', 'D5:4', 'A4:4'],
          ['E5:8', 'C5:8'],
          ['A4:4', 'C5:4', 'E5:8'],
          ['D5:4', 'C5:4', 'A4:8'],
          ['G#4:4', 'B4:4', 'E5:8'],
          ['D5:4', 'B4:4', 'G#4:8'],
          ['A4:8', 'E4:4', 'C5:4'],
          ['A4:12', 'r:4'],
        ],
      },
      {
        id: 'C', title: 'End',
        kit: 'soft', bass: 'hold', arp: 'none',
        chords: 'F G E Am Dm E Am E',
        lead: [
          ['F4:8', 'A4:8'],
          ['G4:8', 'B4:8'],
          ['E4:4', 'G#4:4', 'B4:8'],
          ['A4:12', 'r:4'],
          ['D4:8', 'F4:8'],
          ['E4:8', 'G#4:8'],
          ['A4:8', 'E4:4', 'A4:4'],
          ['E4:8', 'r:8'],
        ],
      },
    ],
  },
  {
    id: 'ember-run',
    title: 'Ember Run',
    tonic: 'E',
    mode: 'minor',
    bpm: 140,
    fadeIn: 0.8,
    voices: {
      bass: { wave: 'sawtooth', vol: 0.32, sub: 0.22, atk: 0.006, rel: 0.05 },
      lead: { wave: 'square', vol: 0.062, atk: 0.006, rel: 0.07 },
      arp: { vol: 0.042 },
      drum: { vol: 0.064 },
    },
    sections: [
      {
        id: 'intro', title: 'Intro', once: true,
        kit: 'build', bass: 'drive', arp: 'none', pad: 'none',
        chords: 'Em Em Em Em C C B B',
        lead: [
          ['r:16'],
          ['r:16'],
          ['r:8', 'E4:2', 'G4:2', 'B4:4'],
          ['r:4', 'E4:4', 'B3:4', 'r:4'],
          ['C4:2', 'E4:2', 'G4:4', 'E4:4', 'C4:4'],
          ['r:8', 'G4:4', 'C5:4'],
          ['B4:4', 'F#4:4', 'D#4:4', 'F#4:4'],
          ['B4:4', 'D#5:4', 'B4:4', 'r:4'],
        ],
      },
      {
        id: 'A', title: 'Verse',
        kit: 'verse', bass: 'drive', arp: 'mid',
        chords: 'Em Em C C G G D D Em Em C C G G B B',
        lead: [
          ['E4:2', 'G4:2', 'B4:4', 'G4:2', 'F#4:2', 'E4:4'],
          ['G4:4', 'B4:2', 'D5:2', 'B4:4', 'G4:4'],
          ['C5:2', 'E5:2', 'C5:4', 'G4:4', 'E4:4'],
          ['D5:4', 'C5:4', 'B4:4', 'A4:4'],
          ['B4:2', 'D5:2', 'G5:4', 'D5:4', 'B4:4'],
          ['A4:4', 'G4:4', 'D4:8'],
          ['A4:2', 'D5:2', 'F#5:4', 'D5:4', 'A4:4'],
          ['G4:4', 'F#4:4', 'E4:8'],
          ['E5:4', 'B4:4', 'G4:4', 'B4:4'],
          ['A4:2', 'G4:2', 'F#4:4', 'E4:8'],
          ['G4:4', 'C5:4', 'E5:4', 'C5:4'],
          ['D5:2', 'C5:2', 'B4:4', 'A4:8'],
          ['B4:4', 'D5:4', 'G5:4', 'D5:4'],
          ['E5:4', 'D5:4', 'B4:8'],
          ['B4:2', 'D#5:2', 'F#5:4', 'D#5:4', 'B4:4'],
          ['E5:8', 'B4:4', 'E4:4'],
        ],
      },
      {
        id: 'B', title: 'Chorus',
        kit: 'chorus', bass: 'drive', arp: 'busy',
        chords: 'Am Am Em Em B B Em Em C C G G D D B B',
        lead: [
          ['A4:2', 'C5:2', 'E5:4', 'C5:4', 'A4:4'],
          ['B4:4', 'A4:4', 'G4:8'],
          ['E5:2', 'G5:2', 'E5:4', 'B4:4', 'G4:4'],
          ['A4:4', 'G4:4', 'E4:8'],
          ['F#5:4', 'D#5:4', 'B4:4', 'F#5:4'],
          ['G5:4', 'F#5:4', 'E5:8'],
          ['E5:2', 'G5:2', 'B5:4', 'G5:4', 'E5:4'],
          ['F#5:4', 'E5:4', 'B4:8'],
          ['C5:4', 'E5:4', 'G5:4', 'E5:4'],
          ['D5:4', 'C5:4', 'G4:8'],
          ['B4:4', 'D5:4', 'G5:4', 'D5:4'],
          ['A4:4', 'G4:4', 'D5:8'],
          ['A4:4', 'D5:4', 'F#5:4', 'A5:4'],
          ['G5:4', 'F#5:4', 'E5:4', 'D5:4'],
          ['B4:4', 'D#5:4', 'F#5:4', 'B5:4'],
          ['E5:8', 'B4:4', 'r:4'],
        ],
      },
      {
        id: 'C', title: 'End',
        kit: 'half', bass: 'walk', arp: 'sparse',
        chords: 'Am B Em C G B Em B',
        lead: [
          ['A4:8', 'C5:4', 'E5:4'],
          ['D#5:8', 'B4:8'],
          ['E5:8', 'B4:4', 'G4:4'],
          ['C5:8', 'G4:8'],
          ['B4:4', 'D5:4', 'G5:8'],
          ['F#5:4', 'D#5:4', 'B4:8'],
          ['E5:8', 'G4:4', 'B4:4'],
          ['F#4:4', 'D#4:4', 'B3:4', 'r:4'],
        ],
      },
    ],
  },
];

function main(){
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const song of SONGS){
    const score = build(song);
    const out = path.join(OUT_DIR, song.id + '.json');
    fs.writeFileSync(out, JSON.stringify(score));
    renderWav(score, path.join(WAV_DIR, song.id + '.wav'));
    const counts = Object.fromEntries(Object.entries(score.tracks).map(([k, v]) => [k, v.length]));
    const ts = (60 / score.bpm) / score.div;
    const intro = (score.loopStart * ts).toFixed(1);
    const body = ((score.loopEnd - score.loopStart) * ts).toFixed(1);
    console.log(
      song.id,
      score.key,
      score.bpm + 'bpm',
      'intro ' + intro + 's',
      'ABC ' + body + 's',
      fs.statSync(out).size + 'b',
      formLine(score.form),
      counts
    );
  }
}

function formLine(form){
  return form.map((s) => s.id + (s.once ? '*' : '')).join('-');
}

main();
