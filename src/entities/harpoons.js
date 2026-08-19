import { C } from '../core/constants.js';
import { rectFree } from '../core/map.js';
import { dropLootFor } from './loot.js';
import { allocId } from './ids.js';
import { wearGear } from './gear.js';
import { grantOne } from './craft.js';

/* стрела гарпуна: летит по прямой, без гравитации, застревает в стене/цели */
export function mkHarpoons(){ return []; }

export function stepHarpoons(S, dt){
  var p = S.p;
  for (var i = 0; i < S.harpoons.length; i++){
    var b = S.harpoons[i];
    if (b.stuck) continue;
    b.x += b.vx * dt;
    if (!rectFree(b.x - 2, b.y - 1, 4, 2)){ b.stuck = true; continue; }
    var hit = false;
    for (var ei = 0; ei < S.enemies.length && !hit; ei++){
      var en = S.enemies[ei];
      if (en.dead) continue;
      if (b.x > en.x - 2 && b.x < en.x + en.w + 2 && b.y > en.y - 2 && b.y < en.y + en.h + 2){
        if ((en.tough || 1) > 1 && !en.hurt){
          en.hurt = true; en.hitT = 0.25; en.x += (b.vx > 0 ? 10 : -10);
          S.hitStop = Math.max(S.hitStop, 0.04); p.events.push('clank');
        } else {
          en.dead = true; en.hitT = 0.6; en.vy = -90;
          S.hitStop = Math.max(S.hitStop, 0.06); S.shake = Math.max(S.shake, 3);
          dropLootFor(S, en, en.x + en.w/2, en.y + en.h/2, 'e');
          p.events.push('kill:' + en.id);
        }
        hit = true;
      }
    }
    for (var si = 0; si < S.spiders.length && !hit; si++){
      var spg = S.spiders[si];
      if (spg.dead) continue;
      if (b.x > spg.x - 8 && b.x < spg.x + 8 && b.y > spg.y - 10 && b.y < spg.y + 6){
        spg.dead = true; spg.hitT = 0.5;
        dropLootFor(S, spg, spg.x, spg.y, 'sp');
        p.events.push('kill:s' + spg.id);
        hit = true;
      }
    }
    for (var fi = 0; fi < S.fliers.length && !hit; fi++){
      var fl = S.fliers[fi];
      if (b.x > fl.x - 4 && b.x < fl.x + fl.w + 4 && b.y > fl.y - 2 && b.y < fl.y + fl.h + 2){
        var fcx = fl.x + fl.w/2, fcy = fl.y + fl.h/2;
        S.hitStop = Math.max(S.hitStop, 0.06);
        dropLootFor(S, fl, fcx, fcy, 'f');
        p.events.push('kill:f' + fl.id + ':' + Math.round(fcx) + ':' + Math.round(fcy));
        S.fliers.splice(fi, 1);
        hit = true;
      }
    }
    if (hit) b.stuck = true;
  }
}

export function fireHarpoon(S){
  var p = S.p, g = p.gear.harpoon;
  if (!g) return false;
  if (!(S.bag && S.bag.harpoonBolt > 0)) return false;    // нет болтов в инвентаре — не выстрелить
  S.bag.harpoonBolt--;
  S.harpoons.push({ id: allocId(S.harpoons), x: p.x + p.w/2 + p.facing*8, y: p.y + p.h/2,
                     vx: p.facing * C.HARPOON_V, stuck: false });
  wearGear(S, 'harpoon', 1);
  p.events.push('harpoon:shoot');
  return true;
}

function hookFree(x, y){ return rectFree(x - 1, y - 1, 2, 2); }

export function releaseGrapple(S, p, ev){
  if (!p.grapple) return;
  p.grapple = null;
  p.harpoonCd = C.HARPOON_CD;
  p.jumping = false;
  p.buf = 0;
  p.coyote = 0;
  p.onGround = false;
  p.apexY = p.y;
  if (p.state === 'grapple') p.state = 'normal';
  if (ev) p.events.push(ev);
}

/* крюк на суше: 45° вперёд или строго вверх, если держали ↑.
   застревает в твёрдом, тянет героиню, отстёгивается не долетая. */
export function fireGrapple(S, inp){
  var p = S.p, g = p.gear.harpoon;
  if (!g) return false;
  if (p.grapple || p.harpoonCd > 0) return false;
  if (p.stance > 0 || p.rollT > 0) return false;
  if (p.state !== 'normal' && p.state !== 'hang' && p.state !== 'ladder' && p.state !== 'bars')
    return false;
  var up = !!(inp && inp.upHeld);
  var ang = up ? -Math.PI / 2 : (p.facing > 0 ? -Math.PI / 4 : -3 * Math.PI / 4);
  var ox = p.x + p.w / 2 + p.facing * 6, oy = p.y + 8;
  if (p.state === 'hang' || p.state === 'ladder' || p.state === 'bars'){
    p.state = 'normal';
    p.hang = null; p.lad = null; p.bars = null;
  }
  p.grapple = {
    phase: 'fly', up: up,
    x: ox, y: oy, ox: ox, oy: oy,
    vx: Math.cos(ang) * C.HARPOON_V, vy: Math.sin(ang) * C.HARPOON_V,
    travel: 0
  };
  p.events.push('harpoon:shoot');
  return true;
}

/* полёт и сматывание — без движения игрока. phase==='pull' крутит step.js */
export function stepGrapple(S, dt){
  var p = S.p, g = p.grapple;
  if (!g) return;
  if (g.phase === 'pull') return;
  if (g.phase === 'retract'){
    var pcx = p.x + p.w / 2, pcy = p.y + 8;
    var dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy);
    if (d < 8){ releaseGrapple(S, p); return; }
    var rs = C.HARPOON_V * 1.7 * dt / d;
    g.x += dx * rs; g.y += dy * rs;
    return;
  }
  var span = Math.hypot(g.vx, g.vy) * dt;
  var steps = Math.max(1, Math.ceil(span / 2));
  var sx = g.vx * dt / steps, sy = g.vy * dt / steps, i;
  for (i = 0; i < steps; i++){
    var nx = g.x + sx, ny = g.y + sy;
    if (!hookFree(nx, ny)){
      g.phase = 'pull';
      p.onGround = false;
      p.jumping = false;
      p.events.push('harpoon:hook');
      return;
    }
    g.x = nx; g.y = ny;
    g.travel += Math.hypot(sx, sy);
    if (g.travel >= C.HARPOON_LEN){
      g.phase = 'retract';
      p.events.push('harpoon:miss');
      return;
    }
  }
}

export function tryHarpoonPickup(S){
  var p = S.p, g = p.gear.harpoon;
  if (!g) return false;
  var cx = p.x + p.w/2, cy = p.y + p.h/2;
  for (var i = 0; i < S.harpoons.length; i++){
    var b = S.harpoons[i];
    if (!b.stuck) continue;
    var dx = b.x - cx;
    if (Math.abs(dx) < C.ACT_R && Math.abs(b.y - cy) < 22 && dx * p.facing > -2){
      S.harpoons.splice(i, 1);
      grantOne(S, 'harpoonBolt');
      p.events.push('harpoon:pick');
      return true;
    }
  }
  return false;
}
