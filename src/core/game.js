import {
  T, C, E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR,
  SLR, SLL, RNDA, RNDB, WATER, FALL,
  SLR2, SLR3, SLL2, SLL3, SLR4A, SLR4B, SLR4C, SLR4D,
  SLL4A, SLL4B, SLL4C, SLL4D, SLRCA, SLRCB, SLLCB, SLLCA
} from './constants.js';
import { runtime, setWorld, hooks } from './runtime.js';
import {
  isHalfV, isBarV, ladderTop, isSlopeV, isWaterV, isFlowV, isWetV, slopeSurfaceY,
  slopeTop, slopeSpec, slopeFamily, slopeRiseRight, SLOPE_SEQ,
  tileAt, isSolidV, isLadV, solidTile, ladderTile, solidAt, ladderAt, rectFree
} from './map.js';
import { mkPlayer, resetPlayer, stanceH, hangBox, standBox } from './player.js';
import { step } from './step.js';
import { LEVELS, loadLevel, addBlankLevel } from '../levels/index.js';
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
import { GEAR, giveGear, wearGear } from '../entities/gear.js';
import { mkHarpoons } from '../entities/harpoons.js';
import { mkTendrils, mkTendrilAt } from '../entities/tendrils.js';

export function mkWorld(li){
  if (li !== undefined || !runtime.LV) loadLevel(li === undefined ? runtime.LVI : li);
  var w = {
    p: mkPlayer(), items: mkItems(), plats: mkPlats(), torches: mkTorches(),
    doors: mkDoors(), enemies: mkEnemies(), pick: mkPickable(), keys: 0, msg: null,
    lifts: mkLifts(), fade: 0, gates: null, fliers: mkFliers(), drops: [], spiders: mkSpiders(),
    dark: mkDark(), darkNow: false, darkT: 0, darkDist: 999, chests: mkChests(), loot: [],
    harpoons: mkHarpoons(), tendrils: mkTendrils(),
    gone: {}, hp: 3, bag: { gem:0, shroom:0, coin:0, relic:0, tank:0 },
    respawn: { x: runtime.LV.spawn.x, y: runtime.LV.spawn.y }, t: 0, hitStop: 0, shake: 0, fx: [], done: false,
    dead: false
  };
  buildGates(w);
  return w;
}

function setTile(c, r, v){
  if (c < 0 || r < 0 || c >= runtime.MAP_W || r >= runtime.MAP_H) return false;
  runtime.base[r * runtime.MAP_W + c] = v;
  if (hooks.onSetTile) hooks.onSetTile(c, r);
  return true;
}

function mkItemAt(S, cx, cy, kind){
  S.items.push({ id:allocId(S.items), x:cx, y:cy, kind:kind, got:false, ph:Math.random()*6.28 });
}
function mkEnemyAt(S, x, y, kind){
  S.enemies.push({ id:allocId(S.enemies), x:x, y:y-14, w: kind===2?14:11, h: kind===2?18:14,
                   x0:x-64, x1:x+64, v:26, kind:kind, tough: kind===2?2:1,
                   dir:1, dead:false, hitT:0, ph:0, vy:0 });
}
function mkFlierAt(S, x, y, kind){
  S.fliers.push({ id:allocId(S.fliers), x:x, y:y, w: kind===2?16:13, h: kind===2?11:9,
                  x0:x-80, x1:x+80, v:28, kind:kind, dir:1, dead:false, hitT:0,
                  ph:0, cd:1.2, flap:0 });
}
function mkSpiderAt(S, x, y, kind){
  S.spiders.push({ id:allocId(S.spiders), hx:x, hy:y, x:x, y:y, kind:kind,
                   len:0, state:'wait', t:1, dir:1, dead:false, hitT:0, ph:0, vy:0 });
}
function mkTorchAt(S, x, y){
  S.torches.push({ id:allocId(S.torches), x:x, y:y, vx:0, vy:0, held:false, ground:true,
                   ph:0, ang:0, spin:0, wasAir:false, thrown:false, lit:true, hx:x, hy:y });
}
function mkChestAt(S, x, y, kind, locked){
  S.chests.push({ id:allocId(S.chests), x:x, y:y, kind:kind, locked:!!locked, opened:false, t:0 });
}

export const GAME = {
  T, C,
  get MAP_W(){ return runtime.MAP_W; }, get MAP_H(){ return runtime.MAP_H; }, get base(){ return runtime.base; },
  E, ROCK, CRUMB, LADW, LADF, LADR, LADL, HTOP, BAR,
  isHalfV, isBarV, ladderTop, stanceH,
  SLR, SLL, RNDA, RNDB, WATER, FALL,
  SLR2, SLR3, SLL2, SLL3, SLR4A, SLR4B, SLR4C, SLR4D,
  SLL4A, SLL4B, SLL4C, SLL4D, SLRCA, SLRCB, SLLCB, SLLCA,
  isSlopeV, isWaterV, isFlowV, isWetV, slopeSurfaceY, slopeTop,
  slopeSpec, slopeFamily, slopeRiseRight, SLOPE_SEQ,
  tileAt, isSolidV, isLadV,
  solidTile, ladderTile, solidAt, ladderAt,
  setTile,
  buildGates: function(S){ buildGates(S); },
  mkItemAt, mkEnemyAt, mkFlierAt, mkSpiderAt, mkTorchAt, mkChestAt, mkTendrilAt,
  rectFree, mkWorld, step, resetPlayer,
  LEVELS, loadLevel, newBlankLevel: addBlankLevel, levelIndex(){ return runtime.LVI; },
  levelSpec(){ return runtime.LV; },
  tryAction, dropTorch, attack, tryDoor, inLift,
  GEAR, giveGear, wearGear,
  tryExit, liftSideOpen, tryChest,
  inDark, lightAt,
  hangBox, standBox, setWorld,
  get W(){ return runtime.W; },
  set W(S){ setWorld(S); }
};

export default GAME;
