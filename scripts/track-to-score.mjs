#!/usr/bin/env node
/**
 * MP3 → компактная chip-партитура (не клон, характер).
 *   node scripts/track-to-score.mjs [in.mp3] [out.json]
 * Декодер: mpg123-decoder из tmp/tools или node_modules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SR = 22050;
const NFFT = 2048;
const HOP = 512;
const DIV = 4; // тиков на долю (16-е)

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const IN = args[0] || path.join(ROOT, 'tmp', 'lantern-key.src.mp3');
const OUT = args[1] || path.join(ROOT, 'src', 'audio', 'scores', 'lantern-key.json');
const WAV = path.join(ROOT, 'tmp', 'lantern-key.chip.wav');

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function midiToHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function hzToMidi(f){ return 69 + 12 * Math.log2(f / 440); }

async function loadDecoder(){
  const cands = [
    path.join(ROOT, 'tmp', 'tools', 'node_modules', 'mpg123-decoder', 'index.js'),
    path.join(ROOT, 'node_modules', 'mpg123-decoder', 'index.js'),
  ];
  for (const p of cands){
    if (fs.existsSync(p)) return import(pathToFileURL(p).href);
  }
  throw new Error('нужен mpg123-decoder: npm i --prefix tmp/tools mpg123-decoder');
}

async function decodeMp3(file){
  const { MPEGDecoder } = await loadDecoder();
  const dec = new MPEGDecoder();
  await dec.ready;
  const raw = fs.readFileSync(file);
  const { channelData, sampleRate, samplesDecoded } = dec.decode(raw);
  dec.free();
  const n = samplesDecoded;
  const ch0 = channelData[0];
  const ch1 = channelData[1] || channelData[0];
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
  return { samples: resample(mono, sampleRate, SR), sr: SR, srcRate: sampleRate, nSrc: n };
}

function resample(src, srcRate, dstRate){
  if (srcRate === dstRate) return src;
  const ratio = srcRate / dstRate;
  const n = Math.floor(src.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++){
    const x = i * ratio;
    const j = x | 0;
    const f = x - j;
    out[i] = src[j] * (1 - f) + (src[j + 1] || 0) * f;
  }
  return out;
}

function biquadLP(src, sr, freq, q){
  const w0 = 2 * Math.PI * freq / sr;
  const a = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = (1 - cos) / 2, b1 = 1 - cos, b2 = (1 - cos) / 2;
  const a0 = 1 + a, a1 = -2 * cos, a2 = 1 - a;
  return biquad(src, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function biquadHP(src, sr, freq, q){
  const w0 = 2 * Math.PI * freq / sr;
  const a = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const b0 = (1 + cos) / 2, b1 = -(1 + cos), b2 = (1 + cos) / 2;
  const a0 = 1 + a, a1 = -2 * cos, a2 = 1 - a;
  return biquad(src, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}
function biquad(src, b0, b1, b2, a1, a2){
  const out = new Float32Array(src.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < src.length; i++){
    const x = src[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return out;
}

function makeFFT(n){
  const bits = Math.log2(n) | 0;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++){
    let x = i, y = 0;
    for (let b = 0; b < bits; b++){ y = (y << 1) | (x & 1); x >>= 1; }
    rev[i] = y;
  }
  const wr = [], wi = [];
  for (let s = 1; s <= bits; s++){
    const m = 1 << s, m2 = m >> 1;
    const cr = new Float64Array(m2), ci = new Float64Array(m2);
    for (let k = 0; k < m2; k++){
      const ang = -2 * Math.PI * k / m;
      cr[k] = Math.cos(ang); ci[k] = Math.sin(ang);
    }
    wr.push(cr); wi.push(ci);
  }
  return function fft(re, im){
    for (let i = 0; i < n; i++){
      const j = rev[i];
      if (j > i){
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let s = 1; s <= bits; s++){
      const m = 1 << s, m2 = m >> 1;
      const cr = wr[s - 1], ci = wi[s - 1];
      for (let k = 0; k < n; k += m){
        for (let j = 0; j < m2; j++){
          const i0 = k + j, i1 = i0 + m2;
          const tr = cr[j] * re[i1] - ci[j] * im[i1];
          const ti = cr[j] * im[i1] + ci[j] * re[i1];
          re[i1] = re[i0] - tr; im[i1] = im[i0] - ti;
          re[i0] += tr; im[i0] += ti;
        }
      }
    }
  };
}

function hann(n){
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  return w;
}

function hpsPitch(mag, sr, n, fmin, fmax){
  const bin = sr / n;
  const harm = 3;
  const i0 = Math.max(2, Math.floor(fmin / bin));
  const i1 = Math.min((n >> 1) / harm - 1, Math.floor(fmax / bin)) | 0;
  if (i1 <= i0) return null;
  let bestI = i0, bestV = -1;
  for (let i = i0; i <= i1; i++){
    let p = mag[i] * mag[i * 2] * (mag[i * 3] || 1e-12);
    if (p > bestV){ bestV = p; bestI = i; }
  }
  const a = mag[bestI - 1] || 0, b = mag[bestI] || 0, c = mag[bestI + 1] || 0;
  const den = a - 2 * b + c;
  const shift = den !== 0 ? 0.5 * (a - c) / den : 0;
  const f = (bestI + Math.max(-0.5, Math.min(0.5, shift))) * bin;
  let med = 0;
  for (let i = i0; i <= i1; i++) med += mag[i];
  med /= (i1 - i0 + 1);
  const conf = b / (med + 1e-9);
  return { f, conf, peak: b };
}

function rms(buf, o, n){
  let s = 0;
  for (let i = 0; i < n; i++){ const v = buf[o + i] || 0; s += v * v; }
  return Math.sqrt(s / n);
}

function detectBpm(flux, hop, sr){
  const envHop = 2;
  const env = [];
  for (let i = 0; i < flux.length; i += envHop){
    let m = 0;
    for (let j = 0; j < envHop && i + j < flux.length; j++) m = Math.max(m, flux[i + j]);
    env.push(m);
  }
  const envSr = sr / (hop * envHop);
  const minB = 84, maxB = 148;
  const t0 = Math.floor(60 / maxB * envSr);
  const t1 = Math.floor(60 / minB * envSr);
  let bestT = t0, best = -1;
  for (let t = t0; t <= t1; t++){
    let acc = 0, c = 0;
    for (let i = 0; i + t < env.length; i++){
      acc += env[i] * env[i + t];
      c++;
    }
    const v = acc / (c || 1);
    if (v > best){ best = v; bestT = t; }
  }
  let bpm = 60 * envSr / bestT;
  if (bpm < 92) bpm *= 2;
  if (bpm > 150) bpm /= 2;
  return Math.round(bpm);
}

function findKey(notes){
  const hist = new Float64Array(12);
  for (const n of notes){
    if (n.midi < 0) continue;
    hist[((Math.round(n.midi) % 12) + 12) % 12] += n.end - n.start;
  }
  let best = { k: 0, mode: 'minor', s: -1e9 };
  for (let k = 0; k < 12; k++){
    for (const [mode, prof] of [['major', MAJOR], ['minor', MINOR]]){
      let s = 0;
      for (let i = 0; i < 12; i++) s += hist[i] * prof[(i - k + 12) % 12];
      if (s > best.s) best = { k, mode, s };
    }
  }
  return best;
}

function scaleOf(key){
  const steps = key.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  const set = new Set(steps.map((d) => (d + key.k) % 12));
  return set;
}

function snapMidi(m, scale){
  const r = Math.round(m);
  if (scale.has(((r % 12) + 12) % 12)) return r;
  for (const d of [1, -1, 2, -2]){
    if (scale.has((((r + d) % 12) + 12) % 12)) return r + d;
  }
  return r;
}

function clampOctave(m, lo, hi){
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

function trackNotes(midis, confs, energies, minFrames){
  const notes = [];
  let cur = null;
  for (let i = 0; i < midis.length; i++){
    const m = midis[i];
    const ok = m >= 0 && confs[i] >= 1.6 && energies[i] > 0;
    if (!ok){
      if (cur && cur.end - cur.start >= minFrames) notes.push(cur);
      cur = null;
      continue;
    }
    if (!cur){
      cur = { start: i, end: i + 1, midi: m, vel: energies[i] };
    } else if (Math.abs(m - cur.midi) <= 0.7){
      cur.end = i + 1;
      cur.midi = cur.midi * 0.75 + m * 0.25;
      if (energies[i] > cur.vel) cur.vel = energies[i];
    } else {
      if (cur.end - cur.start >= minFrames) notes.push(cur);
      cur = { start: i, end: i + 1, midi: m, vel: energies[i] };
    }
  }
  if (cur && cur.end - cur.start >= minFrames) notes.push(cur);
  return notes;
}

function median3(arr){
  const out = arr.slice();
  for (let i = 1; i < arr.length - 1; i++){
    const a = arr[i - 1], b = arr[i], c = arr[i + 1];
    if (a < 0 || b < 0 || c < 0) continue;
    out[i] = [a, b, c].sort((x, y) => x - y)[1];
  }
  return out;
}

function toTicks(notes, hop, sr, bpm, scale, lo, hi){
  const beat = 60 / bpm;
  const tickSec = beat / DIV;
  const out = [];
  let maxVel = 1e-9;
  for (const n of notes) maxVel = Math.max(maxVel, n.vel);
  for (const n of notes){
    const t0 = n.start * hop / sr;
    const t1 = n.end * hop / sr;
    let tick = Math.round(t0 / tickSec);
    let dur = Math.max(1, Math.round((t1 - t0) / tickSec));
    let midi = clampOctave(snapMidi(n.midi, scale), lo, hi);
    const vel = Math.max(5, Math.min(15, Math.round(5 + 10 * (n.vel / maxVel))));
    out.push([tick, midi, dur, vel]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const ev of out){
    const prev = merged[merged.length - 1];
    if (prev && prev[0] === ev[0] && prev[1] === ev[1]){
      prev[2] = Math.max(prev[2], ev[2]);
      prev[3] = Math.max(prev[3], ev[3]);
    } else merged.push(ev);
  }
  return merged;
}

function cropLoop(tracks, startTick, endTick){
  const out = {};
  for (const name of Object.keys(tracks)){
    out[name] = [];
    for (const ev of tracks[name]){
      const t = ev[0], d = ev[2];
      if (t + d <= startTick || t >= endTick) continue;
      const nt = t - startTick;
      const nd = Math.min(d, endTick - t);
      if (nt < 0){
        const cut = -nt;
        if (nd - cut < 1) continue;
        out[name].push([0, ev[1], nd - cut, ev[3]]);
      } else {
        out[name].push([nt, ev[1], Math.max(1, nd - Math.max(0, t + d - endTick)), ev[3]]);
      }
    }
  }
  return out;
}

function chromaAtBeats(lead, arp, bass, bpm, nBeats){
  const beatTick = DIV;
  const ch = [];
  const all = lead.concat(arp, bass);
  for (let b = 0; b < nBeats; b++){
    const v = new Float64Array(12);
    const t0 = b * beatTick, t1 = t0 + beatTick;
    for (const ev of all){
      if (ev[0] + ev[2] <= t0 || ev[0] >= t1) continue;
      v[((ev[1] % 12) + 12) % 12] += ev[3];
    }
    ch.push(v);
  }
  return ch;
}

function cosSim(a, b){
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++){ d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) + 1e-9);
}

function beatEnergy(ch, i){
  const v = ch[i];
  let e = 0;
  for (let k = 0; k < 12; k++) e += v[k];
  return e;
}

function pickLoop(tracks, bpm, totalTicks){
  const nBeats = Math.floor(totalTicks / DIV);
  const ch = chromaAtBeats(tracks.lead, tracks.arp, tracks.bass, bpm, nBeats);
  const skipBeats = Math.max(16, Math.round(16 * bpm / 60));
  const endCap = Math.min(nBeats - 4, Math.round(180 * bpm / 60));
  let best = { s: -1, start: skipBeats, beats: 64 };
  for (const bars of [16, 32]){
    const len = bars * 4;
    if (skipBeats + len >= endCap) continue;
    for (let s = skipBeats; s + len < endCap; s += 4){
      const half = len >> 1;
      let sim = 0;
      for (let i = 0; i < half; i++) sim += cosSim(ch[s + i], ch[s + i + half]);
      sim /= half;
      let e = 0, e2 = 0;
      const parts = 4;
      const partE = new Float64Array(parts);
      for (let i = 0; i < len; i++){
        const ev = beatEnergy(ch, s + i);
        e += ev;
        partE[(i * parts / len) | 0] += ev;
      }
      e /= len;
      for (let p = 0; p < parts; p++) e2 += partE[p] * partE[p];
      const even = (e * e * parts) / (e2 / parts + 1e-9);
      const longBonus = bars === 32 ? 0.25 : 0.15;
      const score = sim * 1.4 + Math.min(1.2, e / 18) + Math.min(0.5, even / 8) + longBonus;
      if (score > best.s) best = { s: score, start: s, beats: len, bars };
    }
  }
  return { startTick: best.start * DIV, endTick: (best.start + best.beats) * DIV, bars: best.beats / 4, score: best.s };
}

function mergeSame(evs){
  const out = [];
  for (const ev of evs){
    const p = out[out.length - 1];
    if (p && p[1] === ev[1] && p[0] + p[2] >= ev[0]){
      p[2] = Math.max(p[2], ev[0] + ev[2] - p[0]);
      p[3] = Math.max(p[3], ev[3]);
    } else out.push(ev.slice());
  }
  return out;
}

function onePerTick(evs, preferHigh){
  const m = new Map();
  for (const ev of evs){
    const cur = m.get(ev[0]);
    if (!cur) m.set(ev[0], ev.slice());
    else if (preferHigh ? ev[1] > cur[1] : ev[3] > cur[3]) m.set(ev[0], ev.slice());
  }
  return [...m.values()].sort((a, b) => a[0] - b[0]);
}

function sparsify(evs, grid){
  const m = new Map();
  for (const ev of evs){
    const slot = Math.floor(ev[0] / grid) * grid;
    const cur = m.get(slot);
    if (!cur || ev[1] > cur[1] || (ev[1] === cur[1] && ev[3] > cur[3])){
      m.set(slot, [slot, ev[1], grid, ev[3]]);
    }
  }
  return mergeSame([...m.values()].sort((a, b) => a[0] - b[0]));
}

function pulseDrums(loopEnd, bass, detected){
  const have = new Set(detected.filter((e) => e[1] === 0).map((e) => e[0]));
  const out = detected.slice();
  const bassOn = new Set();
  for (const ev of bass){
    for (let t = ev[0]; t < ev[0] + ev[2]; t++) bassOn.add(t);
  }
  for (let t = 0; t < loopEnd; t += 4){
    if (!bassOn.has(t) && !bassOn.has(t + 1)) continue;
    if (have.has(t) || have.has(t - 1) || have.has(t + 1)) continue;
    const vel = t % 8 === 0 ? 10 : 7;
    out.push([t, 0, 2, vel]);
    have.add(t);
  }
  for (let t = 2; t < loopEnd; t += 4){
    if (out.some((e) => e[0] === t && e[1] === 1)) continue;
    out.push([t, 1, 1, 6]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out;
}

function writeWav(file, samples, sr){
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++){
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

function renderChip(score){
  const tickSec = (60 / score.bpm) / score.div;
  const dur = (score.loopEnd - score.loopStart) * tickSec;
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  const voices = score.voices;
  function addOsc(tick, midi, dTicks, vel, wave, vol){
    const t0 = Math.floor(tick * tickSec * SR);
    const len = Math.floor(dTicks * tickSec * SR);
    const f = midiToHz(midi);
    const atk = Math.max(1, Math.floor(SR * (voices[wave === 'triangle' ? 'bass' : 'lead'].atk || 0.01)));
    const rel = Math.max(1, Math.floor(SR * 0.06));
    const amp = vol * (vel / 15);
    for (let i = 0; i < len && t0 + i < n; i++){
      const ph = (i / SR) * f;
      let s = wave === 'triangle' ? 2 * Math.abs(2 * (ph % 1) - 1) - 1 : (ph % 1 < 0.5 ? 1 : -1);
      let e = 1;
      if (i < atk) e = i / atk;
      else if (i > len - rel) e = Math.max(0, (len - i) / rel);
      out[t0 + i] += s * amp * e;
    }
  }
  function addNoise(tick, kind, dTicks, vel){
    const t0 = Math.floor(tick * tickSec * SR);
    const len = Math.floor(dTicks * tickSec * SR);
    const amp = (score.voices.drum.vol || 0.1) * (vel / 15);
    let lp = 0;
    for (let i = 0; i < len && t0 + i < n; i++){
      const raw = Math.random() * 2 - 1;
      lp = lp * 0.85 + raw * 0.15;
      const s = kind === 1 ? raw - lp : lp;
      const e = Math.exp(-i / (kind === 1 ? SR * 0.03 : SR * 0.07));
      out[t0 + i] += s * amp * e * (kind === 0 ? 1.4 : 0.7);
    }
    if (kind === 0){
      const f = 90;
      for (let i = 0; i < len && t0 + i < n; i++){
        const e = Math.exp(-i / (SR * 0.06));
        out[t0 + i] += Math.sin(2 * Math.PI * f * i / SR) * amp * 0.7 * e;
      }
    }
    if (kind === 2){
      const f = 1568;
      for (let i = 0; i < Math.floor(SR * 0.22) && t0 + i < n; i++){
        const e = Math.exp(-i / (SR * 0.12));
        out[t0 + i] += Math.sin(2 * Math.PI * f * i / SR) * amp * 0.5 * e;
      }
    }
  }
  for (const ev of score.tracks.bass) addOsc(ev[0], ev[1], ev[2], ev[3], 'triangle', voices.bass.vol);
  for (const ev of score.tracks.arp) addOsc(ev[0], ev[1], ev[2], ev[3], 'square', voices.arp.vol);
  for (const ev of score.tracks.lead) addOsc(ev[0], ev[1], ev[2], ev[3], 'square', voices.lead.vol);
  for (const ev of score.tracks.drum) addNoise(ev[0], ev[1], ev[2], ev[3]);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.85 / peak;
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

async function main(){
  if (!fs.existsSync(IN)) throw new Error('нет файла: ' + IN);
  console.log('decode', IN);
  const { samples, srcRate, nSrc } = await decodeMp3(IN);
  console.log('src', nSrc, 'at', srcRate, '→', samples.length, 'at', SR, (samples.length / SR).toFixed(2) + 's');

  const bassB = biquadLP(samples, SR, 220, 0.7);
  const midB = biquadHP(biquadLP(samples, SR, 900, 0.7), SR, 180, 0.7);
  const highB = biquadHP(biquadLP(samples, SR, 2800, 0.8), SR, 650, 0.8);
  const airB = biquadHP(samples, SR, 6000, 0.7);

  const fft = makeFFT(NFFT);
  const win = hann(NFFT);
  const frames = Math.max(0, Math.floor((samples.length - NFFT) / HOP));
  const re = new Float64Array(NFFT);
  const im = new Float64Array(NFFT);
  const mag = new Float64Array(NFFT);

  const bassM = new Float32Array(frames);
  const midM = new Float32Array(frames);
  const highM = new Float32Array(frames);
  const bassC = new Float32Array(frames);
  const midC = new Float32Array(frames);
  const highC = new Float32Array(frames);
  const bassE = new Float32Array(frames);
  const midE = new Float32Array(frames);
  const highE = new Float32Array(frames);
  const flux = new Float32Array(frames);
  const airE = new Float32Array(frames);
  const lowE = new Float32Array(frames);
  let prevMag = null;

  for (let fi = 0; fi < frames; fi++){
    const o = fi * HOP;
    bassE[fi] = rms(bassB, o, NFFT);
    midE[fi] = rms(midB, o, NFFT);
    highE[fi] = rms(highB, o, NFFT);
    airE[fi] = rms(airB, o, NFFT);
    lowE[fi] = rms(samples, o, NFFT);

    for (let i = 0; i < NFFT; i++){
      re[i] = samples[o + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    let fl = 0;
    for (let i = 0; i < NFFT / 2; i++){
      mag[i] = Math.hypot(re[i], im[i]);
      if (prevMag) fl += Math.max(0, mag[i] - prevMag[i]);
    }
    flux[fi] = fl;
    if (!prevMag) prevMag = new Float64Array(NFFT / 2);
    prevMag.set(mag.subarray(0, NFFT / 2));

    const pb = bassE[fi] > 0.004 ? hpsPitch(mag, SR, NFFT, 55, 200) : null;
    const pm = midE[fi] > 0.003 ? hpsPitch(mag, SR, NFFT, 180, 720) : null;
    const ph = highE[fi] > 0.0025 ? hpsPitch(mag, SR, NFFT, 620, 2100) : null;
    if (pb){ bassM[fi] = hzToMidi(pb.f); bassC[fi] = pb.conf; } else bassM[fi] = -1;
    if (pm){ midM[fi] = hzToMidi(pm.f); midC[fi] = pm.conf; } else midM[fi] = -1;
    if (ph){ highM[fi] = hzToMidi(ph.f); highC[fi] = ph.conf; } else highM[fi] = -1;
  }

  const bpm = detectBpm(flux, HOP, SR);
  console.log('bpm', bpm);

  const bassNotes = trackNotes(median3(Array.from(bassM)), bassC, bassE, 3);
  const arpNotes = trackNotes(median3(Array.from(midM)), midC, midE, 2);
  const leadNotes = trackNotes(median3(Array.from(highM)), highC, highE, 3);
  const key = findKey(leadNotes.concat(arpNotes, bassNotes));
  const scale = scaleOf(key);
  const keyName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][key.k] + ' ' + key.mode;
  console.log('key', keyName, 'notes', { bass: bassNotes.length, arp: arpNotes.length, lead: leadNotes.length });

  const tracks = {
    bass: toTicks(bassNotes, HOP, SR, bpm, scale, 28, 50),
    arp: toTicks(arpNotes, HOP, SR, bpm, scale, 48, 76),
    lead: toTicks(leadNotes, HOP, SR, bpm, scale, 60, 88),
    drum: [],
  };

  const tickSec = (60 / bpm) / DIV;
  const fluxMean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
  const lastDrum = { 0: -99, 1: -99, 2: -99 };
  for (let fi = 1; fi < frames; fi++){
    const onset = flux[fi] > fluxMean * 1.8 && flux[fi] > flux[fi - 1] * 1.15;
    if (!onset) continue;
    const tick = Math.round((fi * HOP / SR) / tickSec);
    let kind = -1;
    if (lowE[fi] > lowE[fi - 1] * 1.25 && bassE[fi] > 0.02 && tick - lastDrum[0] >= 2) kind = 0;
    else if (airE[fi] > 0.012 && airE[fi] > airE[fi - 1] * 1.3 && tick - lastDrum[1] >= 1) kind = 1;
    if (kind < 0) continue;
    const vel = Math.max(5, Math.min(15, Math.round(6 + 9 * Math.min(1, flux[fi] / (fluxMean * 4)))));
    tracks.drum.push([tick, kind, kind === 0 ? 2 : 1, vel]);
    lastDrum[kind] = tick;
  }

  const totalTicks = Math.ceil((samples.length / SR) / tickSec);
  const loop = pickLoop(tracks, bpm, totalTicks);
  console.log('loop', loop);
  const cropped = cropLoop(tracks, loop.startTick, loop.endTick);
  cropped.bass = mergeSame(onePerTick(cropped.bass, false));
  cropped.arp = mergeSame(onePerTick(cropped.arp, false));
  cropped.lead = sparsify(onePerTick(cropped.lead, true), 2);
  cropped.drum = pulseDrums(loop.endTick - loop.startTick, cropped.bass, cropped.drum);

  const score = {
    name: 'lantern-key',
    src: path.basename(IN),
    bpm,
    div: DIV,
    key: keyName,
    loopStart: 0,
    loopEnd: loop.endTick - loop.startTick,
    master: 0.1,
    voices: {
      bass: { wave: 'triangle', vol: 0.2, atk: 0.012, rel: 0.07 },
      arp: { wave: 'square', vol: 0.07, atk: 0.004, rel: 0.04 },
      lead: { wave: 'square', vol: 0.12, atk: 0.008, rel: 0.09 },
      drum: { wave: 'noise', vol: 0.09 },
    },
    tracks: cropped,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(score));
  const chip = renderChip(score);
  fs.mkdirSync(path.dirname(WAV), { recursive: true });
  writeWav(WAV, chip, SR);
  const bytes = fs.statSync(OUT).size;
  console.log('wrote', OUT, bytes, 'bytes', 'loop', (score.loopEnd * tickSec).toFixed(1) + 's');
  console.log('preview wav', WAV);
  console.log('counts', {
    bass: cropped.bass.length,
    arp: cropped.arp.length,
    lead: cropped.lead.length,
    drum: cropped.drum.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
