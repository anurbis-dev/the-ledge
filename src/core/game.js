import {
  T, C, E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR,
  SLR, SLL, RNDA, RNDB, WATER, FALL,
  SLR2, SLR3, SLL2, SLL3, SLR4A, SLR4B, SLR4C, SLR4D,
  SLL4A, SLL4B, SLL4C, SLL4D, SLRCA, SLRCB, SLLCB, SLLCA, PLANK, GIVE
} from './constants.js';
import { runtime, setWorld, hooks, ensureMap, mapIx, inMap, mapMinC, mapMaxC, mapMinR, mapMaxR } from './runtime.js';
import { getActiveLayer, getLayers, isTileLayer, wrapIndex, ensureStamp, ensureDeco } from './layers.js';
import { COVER_AIR, ensureCover, coverRaw, coverVarRaw } from './rooms.js';
import {
  isHalfV, isBarV, ladderTop, isSlopeV, isWaterV, isFlowV, isWetV, slopeSurfaceY,
  slopeTop, slopeSpec, slopeFamily, slopeRiseRight, SLOPE_SEQ,
  tileAt, varAt, varR, isSolidV, isLadV, solidTile, ladderTile, solidAt, ladderAt, rectFree
} from './map.js';
import { mkPlayer, resetPlayer, stanceH, hangBox, standBox } from './player.js';
import { step } from './step.js';
import { LEVELS, loadLevel, addBlankLevel, removeLevel } from '../levels/index.js';
import { mkItems } from '../entities/items.js';
import { mkPlats } from '../entities/plats.js';
import { mkTorches, tryAction, dropTorch } from '../entities/torches.js';
import { mkDoors, tryDoor, tryExit } from '../entities/doors.js';
import { mkEnemies, attack } from '../entities/enemies.js';
import { mkPickable } from '../entities/pickable.js';
import { allocId } from '../entities/ids.js';
import { mkLifts, buildGates, inLift, liftSideOpen } from '../entities/lifts.js';
import { mkFliers } from '../entities/fliers.js';
import { mkSpiders } from '../entities/spiders.js';
import { mkDark, inDark, lightAt } from '../entities/dark.js';
import { mkChests, tryChest } from '../entities/chests.js';
import { GEAR, giveGear, wearGear, cycleHand } from '../entities/gear.js';
import { mkHarpoons } from '../entities/harpoons.js';
import { mkArrows } from '../entities/arrows.js';
import { mkTendrils, mkTendrilAt } from '../entities/tendrils.js';
import { mkLights, mkLightAt } from '../entities/lights.js';
import { mkSounds, mkSoundAt } from '../entities/sounds.js';
import { mkVolumes, mkVolumeAt } from '../entities/volumes.js';
import { mkBoulders, mkBoulderAt } from '../entities/boulders.js';
import { mkNpcs, mkNpcAt } from '../entities/npcs.js';
import { mutter, mutterHero, startTalk, endTalk, breakTalk } from '../speech/runtime.js';

export function mkWorld(li){
  if (li !== undefined || !runtime.LV) loadLevel(li === undefined ? runtime.LVI : li);
  var w = {
    p: mkPlayer(), items: mkItems(), plats: mkPlats(), torches: mkTorches(),
    doors: mkDoors(), enemies: mkEnemies(), pick: mkPickable(), keys: 0, msg: null,
    lifts: mkLifts(), fade: 0, gates: null, fliers: mkFliers(), drops: [], spiders: mkSpiders(),
    dark: mkDark(), darkNow: false, darkT: 0, darkDist: 999, chests: mkChests(), loot: [],
    harpoons: mkHarpoons(), arrows: mkArrows(), tendrils: mkTendrils(),
    lights: mkLights(), sounds: mkSounds(), volumes: mkVolumes(),
    boulders: mkBoulders(), npcs: mkNpcs(), burnt: {}, plankT: {}, giveT: {},
    bubbles: [], talk: null, flags: {},
    gone: {}, hp: 3, bag: { gem:0, shroom:0, coin:0, relic:0, tank:0, stone:0, idol:0 },
    parts: [],
    respawn: { x: runtime.LV.spawn.x, y: runtime.LV.spawn.y }, t: 0, hitStop: 0, shake: 0, fx: [], done: false,
    dead: false
  };
  buildGates(w);
  return w;
}

function setTile(c, r, v){
  var L = getActiveLayer();
  if (L && L.locked) return false;
  if (L && !isTileLayer(L)) return false;
  if (L && L.wrap){
    ensureStamp(L);
    var wix = wrapIndex(L, c, r);
    if (L.stamp[wix] !== v) L.stampVar[wix] = 0;
    L.stamp[wix] = v;
    L._stampCan = null;
    if (hooks.onSetTile) hooks.onSetTile(c, r);
    return true;
  }
  if (!inMap(c, r) && !v) return false;
  ensureMap(c, r);
  if (!inMap(c, r)) return false;
  var buf = L && L.base ? L.base : runtime.base;
  var vr = L && L.vary ? L.vary : runtime.vary;
  var ix = mapIx(c, r);
  if (buf[ix] !== v) vr[ix] = 0;   // смена типа тайла сбрасывает ручной узор
  buf[ix] = v;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}
function setVar(c, r, v){
  var L = getActiveLayer();
  if (L && L.locked) return false;
  if (L && !isTileLayer(L)) return false;
  if (L && L.wrap){
    ensureStamp(L);
    L.stampVar[wrapIndex(L, c, r)] = v;
    L._stampCan = null;
    if (hooks.onSetTile) hooks.onSetTile(c, r);
    return true;
  }
  if (!inMap(c, r)) return false;
  var vr = L && L.vary ? L.vary : runtime.vary;
  vr[mapIx(c, r)] = v;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}

function setDeco(c, r, v){
  var L = getActiveLayer();
  if (L && L.locked) return false;
  if (L && !isTileLayer(L)) return false;
  if (L && L.wrap){
    ensureStamp(L);
    if (!L.stampDeco) L.stampDeco = new Uint8Array(L.stamp.length);
    L.stampDeco[wrapIndex(L, c, r)] = v;
    L._stampCan = null;
    if (hooks.onSetTile) hooks.onSetTile(c, r);
    return true;
  }
  if (!inMap(c, r) && !v) return false;
  ensureMap(c, r);
  if (!inMap(c, r)) return false;
  ensureDeco(L);
  var buf = L && L.deco ? L.deco : null;
  if (!buf) return false;
  buf[mapIx(c, r)] = v;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}
function decoAt(c, r){
  var L = getActiveLayer();
  if (!L) return 0;
  if (L.wrap && L.stampDeco) return L.stampDeco[wrapIndex(L, c, r)] || 0;
  if (!L.deco || !inMap(c, r)) return 0;
  return L.deco[mapIx(c, r)] || 0;
}

function setCover(c, r, v){
  var L = getActiveLayer();
  if (L && L.locked) return false;
  if (!L || !isTileLayer(L) || L.wrap || !L.collide) return false;
  if (!inMap(c, r) && !v) return false;
  ensureMap(c, r);
  if (!inMap(c, r)) return false;
  ensureCover(L);
  var ix = mapIx(c, r);
  if (L.cover[ix] !== v) L.coverVary[ix] = 0;
  L.cover[ix] = v;
  if (!v) L.coverVary[ix] = 0;
  L._roomsDirty = true;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}
function setCoverVar(c, r, v){
  var L = getActiveLayer();
  if (L && L.locked) return false;
  if (!L || !isTileLayer(L) || L.wrap || !L.collide) return false;
  if (!inMap(c, r)) return false;
  ensureCover(L);
  L.coverVary[mapIx(c, r)] = v;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}

function mkItemAt(S, cx, cy, kind){
  S.items.push({ id:allocId(S.items), x:cx, y:cy, kind:kind, got:false, ph:Math.random()*6.28 });
}
function mkEnemyAt(S, x, y, kind, loot, random){
  S.enemies.push({ id:allocId(S.enemies), x:x, y:y-14, w: kind===2?14:11, h: kind===2?18:14,
                   x0:x-64, x1:x+64, v:26, kind:kind, tough: kind===2?2:1,
                   dir:1, dead:false, hitT:0, ph:0, vy:0,
                   loot: (loot && loot.length) ? loot.map(function(e){ return { kind:e.kind, qty:e.qty }; }) : [],
                   random: !!random });
}
function mkFlierAt(S, x, y, kind, loot, random){
  S.fliers.push({ id:allocId(S.fliers), x:x, y:y, w: kind===2?16:13, h: kind===2?11:9,
                  x0:x-80, x1:x+80, v:28, kind:kind, dir:1,
                  ph:0, cd:1.2, flap:0,
                  loot: (loot && loot.length) ? loot.map(function(e){ return { kind:e.kind, qty:e.qty }; }) : [],
                  random: !!random });
}
function mkSpiderAt(S, x, y, kind){
  S.spiders.push({ id:allocId(S.spiders), hx:x, hy:y, x:x, y:y, kind:kind,
                   len:0, state:'wait', t:1, dir:1, dead:false, hitT:0, ph:0, vy:0 });
}
function mkTorchAt(S, x, y){
  S.torches.push({ id:allocId(S.torches), x:x, y:y, vx:0, vy:0, held:false, ground:true,
                   ph:0, ang:0, spin:0, wasAir:false, thrown:false, lit:true, hx:x, hy:y });
}
function mkChestAt(S, x, y, loot, locked, random){
  var l = (loot && loot.length)
    ? loot.map(function(e){ return { kind: e.kind, qty: e.qty }; })
    : [{ kind: 'coin', qty: 5 }];
  S.chests.push({ id:allocId(S.chests), x:x, y:y, loot:l, locked:!!locked, opened:false, t:0, random: !!random });
}

export const GAME = {
  T, C,
  get MAP_W(){ return runtime.MAP_W; }, get MAP_H(){ return runtime.MAP_H; }, get base(){ return runtime.base; },
  mapMinC, mapMaxC, mapMinR, mapMaxR, mapIx, inMap,
  E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR, PLANK, GIVE,
  isHalfV, isBarV, ladderTop, stanceH,
  SLR, SLL, RNDA, RNDB, WATER, FALL,
  SLR2, SLR3, SLL2, SLL3, SLR4A, SLR4B, SLR4C, SLR4D,
  SLL4A, SLL4B, SLL4C, SLL4D, SLRCA, SLRCB, SLLCB, SLLCA,
  isSlopeV, isWaterV, isFlowV, isWetV, slopeSurfaceY, slopeTop,
  slopeSpec, slopeFamily, slopeRiseRight, SLOPE_SEQ,
  tileAt, isSolidV, isLadV,
  solidTile, ladderTile, solidAt, ladderAt,
  setTile, varAt, setVar, varR,
  setDeco, decoAt,
  COVER_AIR, setCover, setCoverVar, coverRaw, coverVarRaw,
  buildGates: function(S){ buildGates(S); },
  mkItemAt, mkEnemyAt, mkFlierAt, mkSpiderAt, mkTorchAt, mkChestAt, mkTendrilAt,
  mkLightAt, mkSoundAt, mkVolumeAt, mkBoulderAt, mkNpcAt, getLayers, getActiveLayer,
  rectFree, mkWorld, step, resetPlayer,
  LEVELS, loadLevel, newBlankLevel: addBlankLevel, removeLevel, levelIndex(){ return runtime.LVI; },
  levelSpec(){ return runtime.LV; },
  tryAction, dropTorch, attack, tryDoor, inLift,
  GEAR, giveGear, wearGear, cycleHand,
  tryExit, liftSideOpen, tryChest,
  mutter, mutterHero, startTalk, endTalk, breakTalk,
  inDark, lightAt,
  hangBox, standBox, setWorld,
  get W(){ return runtime.W; },
  set W(S){ setWorld(S); }
};

export default GAME;
