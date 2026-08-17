import { runtime } from '../core/runtime.js';
import { allocId } from './ids.js';

export var VOLUME_MASKS = [
  { id: 'circle', name: 'Circle' },
  { id: 'gradV', name: 'Grad vertical' },
  { id: 'gradH', name: 'Grad horizontal' },
  { id: 'gradVinv', name: 'Grad vertical inv' },
  { id: 'gradHinv', name: 'Grad horizontal inv' },
  { id: 'gradVmid', name: 'From center V' },
  { id: 'gradHmid', name: 'From center H' }
];

function normVol(raw, i){
  return {
    id: raw.id != null ? raw.id : i,
    x: raw.x, y: raw.y,
    w: raw.w || 64, h: raw.h || 64,
    rot: raw.rot || 0,
    mode: raw.mode || 'color',
    mask: raw.mask || 'circle',
    hue: raw.hue || 0,
    sat: raw.sat != null ? raw.sat : 1,
    bright: raw.bright || 0,
    contrast: raw.contrast != null ? raw.contrast : 1,
    tint: raw.tint || '#88a0ff',
    tintAmt: raw.tintAmt || 0
  };
}

export function mkVolumes(){
  var src = (runtime.LV && runtime.LV.volumes) || [];
  return src.map(normVol);
}

export function mkVolumeAt(S, x, y){
  var o = {
    id: allocId(S.volumes), x: x - 32, y: y - 32,
    w: 64, h: 64, rot: 0,
    mode: 'color', mask: 'circle',
    hue: 0, sat: 1, bright: 0, contrast: 1,
    tint: '#88a0ff', tintAmt: 0.15
  };
  S.volumes.push(o);
  return o;
}

export function volCenter(v){
  return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
}

export function volLocal(v, wx, wy){
  var c = volCenter(v);
  var dx = wx - c.x, dy = wy - c.y;
  var a = -(v.rot || 0);
  var cs = Math.cos(a), sn = Math.sin(a);
  return { x: dx * cs - dy * sn, y: dx * sn + dy * cs };
}

export function volWorld(v, lx, ly){
  var c = volCenter(v);
  var a = v.rot || 0;
  var cs = Math.cos(a), sn = Math.sin(a);
  return { x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs };
}

export function pointInVolume(v, wx, wy){
  var p = volLocal(v, wx, wy);
  return Math.abs(p.x) <= v.w / 2 + 4 && Math.abs(p.y) <= v.h / 2 + 4;
}

export function maskAt(mask, u, v){
  if (u < 0 || v < 0 || u > 1 || v > 1) return 0;
  if (mask === 'circle'){
    var dx = u - 0.5, dy = v - 0.5;
    return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
  }
  if (mask === 'gradV') return 1 - v;
  if (mask === 'gradH') return 1 - u;
  if (mask === 'gradVinv') return v;
  if (mask === 'gradHinv') return u;
  if (mask === 'gradVmid') return 1 - Math.abs(v - 0.5) * 2;
  if (mask === 'gradHmid') return 1 - Math.abs(u - 0.5) * 2;
  return 1;
}
