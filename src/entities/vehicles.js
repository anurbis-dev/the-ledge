import { runtime } from '../core/runtime.js';
import { C } from '../core/constants.js';
import { allocId } from './ids.js';
import { getAnimBox, legacyObjectKindFromSprite } from '../core/object-anchors.js';
import { applyHeroBox } from '../core/player.js';

export var VEHICLE_DEF = { dmg: 0, speedMul: 1 };

function pick(a, key, d){
  return a && a[key] != null ? a[key] : d;
}

/** row = [col, row, spriteId, objectKind, dmg?, speedMul?] (уровневый формат, как у boulders/enemies). */
function normVehicle(a, i){
  var T = 16, col = a[0], row = a[1], spriteId = a[2] || null, objectKind = a[3] || null;
  var ok = objectKind || legacyObjectKindFromSprite(spriteId) || 'vehicle';
  var box = getAnimBox(ok, 'idle');
  var cx = col * T + T / 2, floorY = (row + 1) * T;
  return {
    id: i,
    x: cx - box.w / 2, y: floorY - box.h, w: box.w, h: box.h,
    facing: 1, spriteId: spriteId, objectKind: objectKind,
    dmg: a[4] != null ? a[4] : VEHICLE_DEF.dmg,
    speedMul: a[5] != null ? a[5] : VEHICLE_DEF.speedMul,
    parked: true
  };
}

export function mkVehicles(){
  var LV = runtime.LV;
  return (LV.vehicles || []).map(normVehicle);
}

export function mkVehicleAt(S, cx, floorY, spriteId, objectKind){
  var ok = objectKind || legacyObjectKindFromSprite(spriteId) || 'vehicle';
  var box = getAnimBox(ok, 'idle');
  if (!S.vehicles) S.vehicles = [];
  var v = {
    id: allocId(S.vehicles),
    x: cx - box.w / 2, y: floorY - box.h, w: box.w, h: box.h,
    facing: 1, spriteId: spriteId || null, objectKind: objectKind || null,
    dmg: VEHICLE_DEF.dmg, speedMul: VEHICLE_DEF.speedMul,
    parked: true
  };
  S.vehicles.push(v);
  return v;
}

export function packVehicle(v){
  var T = 16;
  var row = [
    Math.floor((v.x + v.w / 2) / T),
    Math.floor((v.y + v.h) / T) - 1,
    v.spriteId || null,
    v.objectKind || null
  ];
  if (v.dmg !== VEHICLE_DEF.dmg || v.speedMul !== VEHICLE_DEF.speedMul){
    row.push(v.dmg != null ? v.dmg : VEHICLE_DEF.dmg);
    row.push(v.speedMul != null ? v.speedMul : VEHICLE_DEF.speedMul);
  }
  return row;
}

export function nearestParkedVehicle(S, p){
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2, best = null, bd = C.ACT_R * C.ACT_R;
  for (var i = 0; i < S.vehicles.length; i++){
    var v = S.vehicles[i];
    if (!v.parked || v.roomHide) continue;
    var dx = (v.x + v.w / 2) - cx, dy = (v.y + v.h / 2) - cy, d = dx * dx + dy * dy;
    if (d < bd){ bd = d; best = v; }
  }
  return best;
}

export function tryMount(S){
  var p = S.p;
  /* с факелом в руке не садимся — его мировая позиция завязана на анкоры activeObjectKind()
     и на неавторенном для транспорта скине "поедет"; сперва брось/метни факел тем же Act. */
  if (p.mount || p.state !== 'normal' || !p.onGround || p.torch >= 0) return false;
  var v = nearestParkedVehicle(S, p);
  if (!v) return false;
  p.mountSaved = runtime.mountSkin || { spriteId: runtime.LV.spawn.spriteId, objectKind: runtime.LV.spawn.objectKind };
  runtime.mountSkin = { spriteId: v.spriteId, objectKind: v.objectKind || legacyObjectKindFromSprite(v.spriteId) || 'vehicle' };
  p.mount = v;
  v.parked = false;
  /* рендер в маунте берёт facing у героя (render/hero.js:tryVehicleSprite), а не у v —
     без этого транспорт при посадке мгновенно перещёлкивался на то, куда смотрела
     героиня при подходе, вместо того, чтобы остаться в своей припаркованной ориентации. */
  p.facing = v.facing;
  applyHeroBox(p);
  p.mountAnimT = 0.25; p.mountAnimKind = 'mount'; p.mountAnimSkin = null;
  p.events.push('mount');
  return true;
}

export function tryDismount(S){
  var p = S.p, v = p.mount;
  if (!v) return false;
  /* unmount доигрывает 0.25с НА боксе и скине транспорта (runtime.mountSkin
     не трогаем, applyHeroBox не зовём) — иначе арт transporта рисуется поверх
     уже схлопнувшегося геройского хитбокса и выглядит смещённым. Возврат
     геройского скина/бокса и парковка v — только в finishDismount, по
     завершении анимации (см. core/step.js). */
  p.mountAnimSkin = { spriteId: v.spriteId, objectKind: v.objectKind || legacyObjectKindFromSprite(v.spriteId) || 'vehicle' };
  p.mountAnimVehicle = v;
  p.mount = null;
  p.mountAnimT = 0.25; p.mountAnimKind = 'unmount';
  p.events.push('dismount');
  return true;
}

/** Конец анимации unmount (core/step.js, когда mountAnimT дошёл до 0): транспорт —
    не отдельная физическая сущность (см. tryMount/tryDismount), пока герой за рулём
    его x/y/facing никто не двигает; при высадке v просто снова становится видимым
    и интерактивным на том же месте, где стоял всегда, не подтягиваясь к героине. */
export function finishDismount(p){
  var v = p.mountAnimVehicle;
  if (v) v.parked = true;
  runtime.mountSkin = p.mountSaved || null;
  p.mountSaved = null;
  applyHeroBox(p);
}
