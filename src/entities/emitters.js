import { runtime } from '../core/runtime.js';
import { allocId } from './ids.js';
import { emitSand, SAND_DEF } from '../render/sand-fx.js';
import { P } from '../render/palette.js';

/* placeable FX-эмиттеры (песок и др.). kind расширяемый; сейчас sand. */
export var EMIT_SHAPES = [
  { id: 'point', name: 'Point' },
  { id: 'square', name: 'Square' },
  { id: 'circle', name: 'Circle' },
  { id: 'line', name: 'Line' }
];

export var SAND_EMIT_DEF = {
  kind: 'sand',
  density: 8,
  speed: SAND_DEF.speed,
  speedRand: SAND_DEF.speedRand,
  color: P.crumL,
  life: SAND_DEF.life,
  lifeRand: SAND_DEF.lifeRand,
  gravity: SAND_DEF.gravity,
  size: SAND_DEF.size,
  spread: SAND_DEF.spread,
  drag: SAND_DEF.drag,
  lift: 0,
  shape: 'point',
  shapeSize: 16,
  shapeAngle: 0
};

function defOf(kind){
  if (kind === 'sand' || !kind) return SAND_EMIT_DEF;
  return SAND_EMIT_DEF;
}

function normShape(raw, d){
  var sh = (raw && raw.shape) || d.shape;
  if (sh !== 'point' && sh !== 'square' && sh !== 'circle' && sh !== 'line') sh = d.shape;
  return sh;
}

export function sampleEmitterPoint(e){
  var sh = e.shape || 'point';
  var sz = e.shapeSize != null ? +e.shapeSize : SAND_EMIT_DEF.shapeSize;
  if (!(sz > 0)) sz = 0;
  var ang = ((e.shapeAngle != null ? +e.shapeAngle : 0) * Math.PI) / 180;
  var u, t, rr, r;
  if (sh === 'square'){
    return {
      x: e.x + (Math.random() - 0.5) * sz,
      y: e.y + (Math.random() - 0.5) * sz
    };
  }
  if (sh === 'circle'){
    r = sz * 0.5;
    t = Math.random() * Math.PI * 2;
    rr = Math.sqrt(Math.random()) * r;
    return { x: e.x + Math.cos(t) * rr, y: e.y + Math.sin(t) * rr };
  }
  if (sh === 'line'){
    u = Math.random() - 0.5;
    return {
      x: e.x + Math.cos(ang) * u * sz,
      y: e.y + Math.sin(ang) * u * sz
    };
  }
  return { x: e.x, y: e.y };
}

function normEmitter(raw, i){
  var d = defOf(raw && raw.kind);
  if (Array.isArray(raw)){
    return {
      id: i, kind: 'sand',
      x: raw[0], y: raw[1],
      density: raw[2] != null ? raw[2] : d.density,
      speed: raw[3] != null ? raw[3] : d.speed,
      speedRand: raw[4] != null ? raw[4] : d.speedRand,
      color: raw[5] || d.color,
      life: raw[6] != null ? raw[6] : d.life,
      lifeRand: raw[7] != null ? raw[7] : d.lifeRand,
      gravity: raw[8] != null ? raw[8] : d.gravity,
      size: raw[9] != null ? raw[9] : d.size,
      spread: raw[10] != null ? raw[10] : d.spread,
      drag: raw[11] != null ? raw[11] : d.drag,
      lift: raw[12] != null ? raw[12] : d.lift,
      shape: d.shape, shapeSize: d.shapeSize, shapeAngle: d.shapeAngle,
      _acc: 0
    };
  }
  var kind = (raw && raw.kind) || 'sand';
  d = defOf(kind);
  return {
    id: raw.id != null ? raw.id : i,
    kind: kind,
    x: raw.x, y: raw.y,
    density: raw.density != null ? raw.density : d.density,
    speed: raw.speed != null ? raw.speed : d.speed,
    speedRand: raw.speedRand != null ? raw.speedRand : d.speedRand,
    color: raw.color || d.color,
    life: raw.life != null ? raw.life : d.life,
    lifeRand: raw.lifeRand != null ? raw.lifeRand : d.lifeRand,
    gravity: raw.gravity != null ? raw.gravity : d.gravity,
    size: raw.size != null ? raw.size : d.size,
    spread: raw.spread != null ? raw.spread : d.spread,
    drag: raw.drag != null ? raw.drag : d.drag,
    lift: raw.lift != null ? raw.lift : d.lift,
    shape: normShape(raw, d),
    shapeSize: raw.shapeSize != null ? raw.shapeSize : d.shapeSize,
    shapeAngle: raw.shapeAngle != null ? raw.shapeAngle : d.shapeAngle,
    _acc: 0
  };
}

export function mkEmitters(){
  var src = (runtime.LV && runtime.LV.emitters) || [];
  return src.map(normEmitter);
}

export function mkEmitterAt(S, x, y, kind){
  var d = defOf(kind || 'sand');
  var o = {
    id: allocId(S.emitters), kind: d.kind,
    x: x, y: y,
    density: d.density, speed: d.speed, speedRand: d.speedRand,
    color: d.color, life: d.life, lifeRand: d.lifeRand,
    gravity: d.gravity, size: d.size, spread: d.spread,
    drag: d.drag, lift: d.lift,
    shape: d.shape, shapeSize: d.shapeSize, shapeAngle: d.shapeAngle,
    _acc: 0
  };
  S.emitters.push(o);
  return o;
}

export function packEmitter(e){
  return {
    id: e.id, kind: e.kind || 'sand',
    x: e.x, y: e.y,
    density: e.density, speed: e.speed, speedRand: e.speedRand,
    color: e.color, life: e.life, lifeRand: e.lifeRand,
    gravity: e.gravity, size: e.size, spread: e.spread,
    drag: e.drag, lift: e.lift,
    shape: e.shape || 'point',
    shapeSize: e.shapeSize != null ? e.shapeSize : SAND_EMIT_DEF.shapeSize,
    shapeAngle: e.shapeAngle != null ? e.shapeAngle : SAND_EMIT_DEF.shapeAngle
  };
}

export function stepEmitters(S, dt){
  var list = S && S.emitters;
  if (!list || !list.length) return;
  var i, e, n, p, k;
  for (i = 0; i < list.length; i++){
    e = list[i];
    if (e.roomHide) continue;
    if ((e.kind || 'sand') !== 'sand') continue;
    e._acc = (e._acc || 0) + Math.max(0, e.density != null ? e.density : SAND_EMIT_DEF.density) * dt;
    n = e._acc | 0;
    if (n < 1) continue;
    e._acc -= n;
    if (n > 24) n = 24;
    for (k = 0; k < n; k++){
      p = sampleEmitterPoint(e);
      emitSand(p.x, p.y, {
        n: 1,
        speed: e.speed, speedRand: e.speedRand,
        color: e.color, life: e.life, lifeRand: e.lifeRand,
        gravity: e.gravity, size: e.size, spread: e.spread,
        drag: e.drag, lift: e.lift
      });
    }
  }
}
