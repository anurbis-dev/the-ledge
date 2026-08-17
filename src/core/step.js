import { T, C, ROCK } from './constants.js';
import { runtime, setWorld } from './runtime.js';
import { tileAt, rectFree, isWaterV, waterSurfaceY, ladderTile } from './map.js';
import {
  moveX, moveY, damage, updateBars, ease, updateClimb, updateHang, updateLadder,
  setStance, setH, slopeUnder, grounded, autoLadder, tryBars,
  tryLadder, tryGrab, tryClimbOut, tryCrawlEdge, ladderTopUnder, attach, tryDescend, tryMantle,
  markGap, canDescend, awayFromEdge
} from './player.js';
import { stepPlats, platUnder } from '../entities/plats.js';
import { stepLifts, inLift, liftConstrain } from '../entities/lifts.js';
import { stepCrumbs, crumbCheck } from '../entities/crumbs.js';
import { stepTorches, tryAction, resolvePickup } from '../entities/torches.js';
import { stepHarpoons } from '../entities/harpoons.js';
import { stepEnemies } from '../entities/enemies.js';
import { stepFliers, stepDrops } from '../entities/fliers.js';
import { stepSpiders } from '../entities/spiders.js';
import { stepTendrils, tickSnareAir } from '../entities/tendrils.js';
import { stepLoot } from '../entities/loot.js';
import { tryDoor, updateWarp, tryExit } from '../entities/doors.js';
import { pickups } from '../entities/items.js';
import { stepDark } from '../entities/dark.js';

/* --- основной шаг --- */
export function step(S, dt, inp){
  setWorld(S);
  S.p.events.length = 0;
  if (S.hitStop > 0){ S.hitStop -= dt; if (S.hitStop > 0) return; }
  S.t += dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 18);
  stepPlats(S, dt);
  stepLifts(S, dt);
  stepCrumbs(S, dt);
  stepTorches(S, dt);
  stepHarpoons(S, dt);
  stepEnemies(S, dt);
  stepFliers(S, dt);
  stepSpiders(S, dt);
  stepTendrils(S, dt, inp);
  stepDrops(S, dt);
  stepLoot(S, dt);
  if (S.p.hurtCd > 0) S.p.hurtCd -= dt;
  if (S.p.shieldCd > 0) S.p.shieldCd -= dt;
  if (S.p.bashT > 0) S.p.bashT -= dt;
  if (S.p.atkT > 0) S.p.atkT -= dt;
  if (S.p.atkCd > 0) S.p.atkCd -= dt;
  if (S.p.pickT > 0) S.p.pickT -= dt;
  if (S.p.throwT > 0) S.p.throwT -= dt;
  resolvePickup(S);
  var pk = S.pick;
  if (!pk.key.taken && Math.abs(pk.key.x - (S.p.x + S.p.w/2)) < 12 &&
      Math.abs(pk.key.y - (S.p.y + S.p.h/2)) < 14){
    pk.key.taken = true; S.keys++; S.p.events.push('getkey');
  }
  for (var li = 0; li < S.lifts.length; li++){
    var LL = S.lifts[li], PP = S.p;
    if (inLift(PP, LL) && LL.st === 'dwell'){
      if (inp.upPressed) LL.want = 1;
      else if (inp.downPressed) LL.want = -1;
    } else if (LL.st === 'dwell' && PP.onGround &&
               PP.x + PP.w > LL.x - 44 && PP.x < LL.x + LL.w + 44){
      // стоим на этаже у шахты — вызов кабины к себе
      for (var fi = 0; fi < LL.floors.length; fi++){
        if (Math.abs((PP.y + PP.h) - LL.floors[fi]) < 6 && LL.idx !== fi &&
            (inp.upPressed || inp.downPressed)){
          LL.idx = fi; LL.st = 'move'; LL.want = 0;
          PP.events.push('liftcall');
          break;
        }
      }
    }
  }
  if (inp.upPressed && (tryExit(S) || tryDoor(S))) { /* вверх: пещера или дверь */ }
  else if (inp.actPressed) tryAction(S);

  var p = S.p;
  if (p.grabCd > 0) p.grabCd = Math.max(0, p.grabCd - dt);
  if (p.ladCd > 0) p.ladCd = Math.max(0, p.ladCd - dt);
  if (p.rollCd > 0) p.rollCd = Math.max(0, p.rollCd - dt);
  if (p.landT > 0) p.landT = Math.max(0, p.landT - dt);
  if (p.lock > 0 && p.lock < 9) p.lock = Math.max(0, p.lock - dt);
  if (p.stanceT > 0) p.stanceT = Math.max(0, p.stanceT - dt);

  if (p.ride && p.onGround && p.state === 'normal'){
    if (p.ride.dx) moveX(S, p, p.ride.dx);
    if (p.ride.dy){
      p.y += p.ride.dy;
      if (!rectFree(p.x, p.y, p.w, p.h)){
        p.y -= p.ride.dy;
        if (p.ride.dy < 0) damage(S, 1, 0.3);        // зажало лифтом о потолок
      }
    }
  }

  if (p.state === 'stun'){
    p.stunT -= dt;
    p.vx = 0; p.vy += C.GRAV * dt; moveY(S, p, p.vy * dt);
    if (p.stunT <= 0){ p.state = 'normal'; p.apexY = p.y; }
    crumbCheck(S, p); pickups(S, p); return;
  }
  if (p.state === 'snare'){
    tickSnareAir(S, p, dt);
    pickups(S, p); return;
  }
  if (p.state === 'warp'){ updateWarp(S, p, dt); return; }
  if (p.state === 'bars'){ updateBars(S, p, dt, inp); pickups(S, p); return; }
  if (p.state === 'snap'){
    var sn = p.snap; sn.p += dt / sn.dur;
    if (sn.p >= 1){
      p.x = sn.tx; p.y = sn.ty; p.snap = null; p.state = 'normal';
      p.onGround = true; p.apexY = p.y; p.coyote = C.COYOTE; p.vx = 0; p.vy = 0;
    } else {
      var se = ease(sn.p);
      p.x = sn.fx + (sn.tx - sn.fx)*se; p.y = sn.fy + (sn.ty - sn.fy)*se;
    }
    pickups(S, p); return;
  }
  if (p.state === 'climb'){ updateClimb(S, p, dt); crumbCheck(S, p); pickups(S, p); return; }
  if (p.state === 'hang'){ updateHang(S, p, dt, inp); crumbCheck(S, p); pickups(S, p); return; }
  if (p.state === 'ladder'){ updateLadder(S, p, dt, inp); pickups(S, p); return; }

  /* --- normal / roll --- */
  var rolling = p.rollT > 0;
  p.walking = false;

  // ↓ переключает стойку: стоя -> присед -> лёжа; ↑ или прыжок поднимают
  var inCab = false;
  for (var lc2 = 0; lc2 < S.lifts.length; lc2++) if (inLift(p, S.lifts[lc2])) inCab = true;
  if (inCab && p.stance > 0) setStance(S, p, 0);
  var onLadTop = ladderTopUnder(p, p.y + p.h + 1) !== null;
  var stanceBefore = p.stance;
  var onEdge = p.onGround && !inCab && !onLadTop && !p.inWater && canDescend(p, inp.x);
  if (!rolling && p.onGround && !inCab && !onLadTop && !p.inWater){    // на верхушке лестницы ↓ — это спуск
    if (inp.downPressed && p.stance < 2 && Math.abs(p.vx) <= 58) setStance(S, p, p.stance + 1);
    else if (!onEdge && inp.downHeld && p.stance === 0 && Math.abs(p.vx) <= 58) setStance(S, p, 1);
    if ((inp.upPressed || inp.upHeld || inp.jumpPressed) && p.stance > 0){
      if (setStance(S, p, p.stance - 1)) { p.buf = 0; }   // удержание ↑ поднимает до стойки
    }
    // авто-подъём только после щели, не в открытом месте перед ней
    if (p.gapCrawl && p.stance > 0 && !inp.downHeld && !inp.downPressed){
      if (!setStance(S, p, 0) && p.stance === 2) setStance(S, p, 1);
    }
  }
  if (p.stance !== stanceBefore){ p.stanceFrom = stanceBefore; p.stanceT = C.STANCE_T; }  // плавный переход позы
  // смотрим вверх стоя на месте — голова запрокидывается, камера чуть приподнимается (см. loop.js)
  var wantLookUp = (!rolling && p.onGround && !inCab && p.state === 'normal' && p.stance === 0 &&
                     inp.upHeld && !inp.downHeld && Math.abs(p.vx) < 10) ? 1 : 0;
  p.lookUp += (wantLookUp - p.lookUp) * Math.min(1, dt * 6);
  if (p.lookUp < 0.01) p.lookUp = 0;
  // под низким потолком встать нельзя — держим стойку
  if (p.stance > 0 && p.onGround && !inp.downHeld && !inp.downPressed){
    if (p.stance === 2 && rectFree(p.x, p.y + p.h - C.CRH, p.w, C.CRH) && inp.upHeld) setStance(S, p, 1);
  }
  if (p.stance > 0 && !p.onGround && rectFree(p.x, p.y + p.h - C.H, p.w, C.H)) setStance(S, p, 0);
  // страховка: габариты рассинхронились со стойкой (например, после переката под потолком).
  // проверяем не только над головой, но и с запасом по бокам — иначе можно «встать» внутри щели
  if (!rolling && p.h !== C.H){
    var fitStand = rectFree(p.x, p.y + p.h - C.H, p.w, C.H);
    var fitCrouch = rectFree(p.x, p.y + p.h - C.CRH, p.w, C.CRH);
    if (fitStand && p.stance === 0) setH(p, C.H);
    else if (!fitStand && fitCrouch && p.stance <= 1){ setH(p, C.CRH); p.stance = 1; }
    else if (!fitStand && !fitCrouch && p.h > C.PRH){ setH(p, C.PRH); p.stance = 2; }
  }
  markGap(p);

  if (rolling && p.inWater){ p.rollT = 0; setStance(S, p, 0); rolling = false; }
  if (rolling){
    p.rollT -= dt;
    if (inp.x !== 0){ p.facing = inp.x > 0 ? 1 : -1; }
    p.vx = p.facing * C.ROLL_V * Math.max(0.55, p.rollT / C.ROLL_T + 0.25);
    p.rollAng += (p.vx * dt) / 7;
    var pushed = !rectFree(p.x + p.facing*3, p.y, p.w, p.h);
    if (p.rollT <= 0 && (inp.downHeld || inp.downPressed) && !pushed && Math.abs(p.vx) > 30){
      p.rollT = C.ROLL_T * 0.6;                    // продолжаем катиться, пока держат ↓
    }
    if (p.rollT <= 0){
      if (setStance(S, p, 0)) p.rollCd = C.ROLL_CD;
      else if (setStance(S, p, 1)) p.rollCd = C.ROLL_CD;
      else p.rollT = 0.1;
    }
  } else {
    var ax = p.lock > 0 ? 0 : inp.x;
    if (p.lock > 0){
      // после отпрыга ввод в стену игнорируется, трение не тормозит полёт
    } else if (ax !== 0){
      var slow = p.stance > 0;
      p.walking = slow;
      p.vx += ax * C.ACC * dt;
      var lim = p.inWater ? (p.dashT > 0 ? C.DASH_V : C.SWIM_V) * (p.flippers ? C.FLIP_MUL : 1) :
                (p.wading ? C.WALK_V + 10 :
                (p.stance === 2 ? C.PRONE_V : (p.stance === 1 ? C.CROUCH_V : C.RUN)));
      lim *= Math.max(0.45, Math.abs(ax));
      if (p.vx > lim) p.vx = lim;
      if (p.vx < -lim) p.vx = -lim;
      p.facing = ax > 0 ? 1 : -1;
      if (p.stance > 0 && p.onGround){
        var edge = tryCrawlEdge(S, p, p.facing);
        if (edge === 2){ crumbCheck(S, p); pickups(S, p); return; }  // в вис
        if (edge === -1) p.vx = 0;                                   // упёрлись
      }
      if (!rectFree(p.x + p.facing*2, p.y, p.w, p.h) && slopeUnder(p) === null){
        var wasVx = p.vx;
        p.vx = 0;                                 // упор в стену — не толкаемся (на склоне не мешаем)
        if (p.onGround && stanceBefore === 0 && p.stance === 0 && tryMantle(S, p, p.facing, wasVx)){
          crumbCheck(S, p); pickups(S, p);
          return;
        }
      }

    } else {
      var f = C.FRIC * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - (p.vx > 0 ? f : -f);
    }
  }

  if (inp.jumpPressed) p.buf = C.BUF;
  p.buf -= dt; p.coyote -= dt;

  var inCabin = false;
  for (var lj = 0; lj < S.lifts.length; lj++) if (inLift(p, S.lifts[lj])) inCabin = true;
  if (inCabin) p.buf = 0;                        // в кабине не прыгаем
  if (p.buf > 0 && p.coyote > 0 && !rolling && p.stance === 0){
    p.vy = C.JUMP; p.buf = 0; p.coyote = 0; p.onGround = false; p.jumping = true;
    p.grabCd = Math.max(p.grabCd, 0.25); p.ladCd = 0.3;
    p.apexY = p.y; p.events.push('jump');
  } else if (p.buf > 0 && p.sliding !== 0 && !p.onGround){    // прыжок от стены
    var same = (p.lastWall === p.sliding);
    p.vx = -p.sliding * (same ? C.WJ_SAME_X : C.WJ_X);
    p.vy = same ? C.WJ_SAME_Y : C.WJ_Y;                        // от той же стены — заметно слабее
    p.facing = -p.sliding;
    p.lastWall = p.sliding;
    p.lock = 9; p.buf = 0; p.jumping = true; p.sliding = 0; p.apexY = p.y;
    p.events.push(same ? 'walljumpweak' : 'walljump');
  }
  if (p.jumping && !inp.jumpHeld && p.vy < 0){ p.vy *= C.CUT; p.jumping = false; }

  if (p.onGround && !rolling && !p.inWater && p.rollCd <= 0 && p.stance <= 1 &&
      (inp.downHeld || inp.downPressed) && Math.abs(p.vx) > 58){
    if (inp.x !== 0) p.facing = inp.x > 0 ? 1 : -1;
    else if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;
    p.rollT = C.ROLL_T; setH(p, C.RH); p.events.push('roll');
    rolling = true;
  }

  var cxw = p.x + p.w/2;
  var wetCenter = isWaterV(tileAt(Math.floor(cxw/T), Math.floor((p.y + p.h/2)/T)));
  var surf0 = wetCenter ? waterSurfaceY(cxw, p.y + p.h/2) : null;
  // вброд: стоим на дне и голова над водой — обычная физика, можно прыгать
  var standsOnBottom = false;
  for (var wb = 0; wb <= 8 && !standsOnBottom; wb++)
    if (!rectFree(p.x + 1, p.y + p.h + wb, p.w - 2, 1)) standsOnBottom = true;
  var wading = wetCenter && standsOnBottom && surf0 !== null && surf0 > p.y + 4;
  var inWater = wetCenter && !wading;
  p.wading = wading;
  p.inWater = inWater;
  if (inWater && p.swimLaunch > 0 && p.vy < 0){          // выпрыгнули — летим свободно только вверх
    p.swimLaunch -= dt;
    p.vy += C.GRAV * dt;
    p.atSurface = false;
  } else if (inWater){
    var surf = surf0;
    p.swimSurf = surf;
    var restY = surf !== null ? surf - 4 : p.y;
    var dip = surf !== null ? p.y - restY : 0;         // >0 ниже линии покоя
    if (p.swimLaunch > 0){                             // дуга обратно — короткий нырок, не стоп
      p.swimLaunch = 0;
      if (p.vy > 86) p.vy = 86;
      else if (p.vy < 40) p.vy = 40;
    }
    if (!p.wasWet){
      p.wasWet = true; p.events.push('splash');
      if (p.vy > 86) p.vy = 86;                       // вход — нырок на ~тайл
    }
    if (p.vy > 90) p.vy = 90;
    if (p.vy > 0 && dip > 8) p.vy *= 0.90;            // вязкость — уже под водой
    var atSurf = surf !== null && (p.y + 4) <= surf + 10;
    p.atSurface = atSurf;
    if (inp.downHeld || inp.downPressed){
      p.vy = C.SWIM_DN;                                    // ныряем
    } else if (inp.jumpPressed){
      if (!atSurf && p.stam > 0.25){                       // рывок под водой, пока есть силы
        p.dashT = 0.42; p.stam -= 0.7;
        p.events.push('dash');
      }
      p.vy = atSurf ? C.SWIM_JUMP : -140;                  // с поверхности — прыжок, из глубины — гребок
      p.jumping = atSurf; p.apexY = p.y;
      if (atSurf) p.swimLaunch = 0.45;                     // на время прыжка вода не держит
      p.events.push(atSurf ? 'jump' : 'stroke');
    } else if (surf !== null && dip > 12){
      p.vy += (C.SWIM_UP - p.vy) * Math.min(1, dt * 3.6);  // всплываем после нырка
      if (p.vy < -28) p.vy = -28;                          // не врезаться головой в поверхность
    } else if (surf !== null && dip > 0){
      if (p.vy > 8) p.vy += (-6 - p.vy) * Math.min(1, dt * 1.0);      // ещё ныряем — почти не держит
      else if (dip < 8){                                           // близко к поверхности — дотягиваем
        var kUp = Math.min(1, dt * 8);
        p.y += (restY - p.y) * kUp;
        p.vy *= 1 - kUp;
        if (Math.abs(p.y - restY) < 1){ p.y = restY; p.vy = 0; }
      } else p.vy += (C.SWIM_UP - p.vy) * Math.min(1, dt * 3.6);
    } else if (p.vy > 10){
      // ещё идём вниз сквозь поверхность
    } else {
      p.vy += (restY - p.y) * 14 * dt;
      p.vy *= 0.82;
      if (Math.abs(p.y - restY) < 1.2 && Math.abs(p.vy) < 10){
        p.vy = 0; p.y = restY;
      }
    }
    if (surf !== null && p.swimLaunch <= 0 && p.vy < -22 && dip < 16)
      p.vy = -22;                                        // гребок у поверхности не бьёт головой
    var airMax = p.scuba ? C.SCUBA_AIR : C.AIR_MAX;
    if (atSurf) {
      if (p.air < airMax){ p.air = airMax; p.events.push('gasp'); }
    } else {
      p.air -= dt;
      if (p.air <= 0){
        if (p.scuba && S.bag.tank > 0){
          S.bag.tank--; p.air = airMax; p.events.push('tank');
        } else {
          p.air = 1.4;
          damage(S, 1, 0.2);
          p.events.push('drown');
        }
      } else if (p.air < 4 && Math.floor(p.air*2) !== Math.floor((p.air+dt)*2)) p.events.push('lowair');
    }
    if (p.dashT > 0){ p.dashT -= dt; }
    else p.stam = Math.min(C.STAM_MAX, p.stam + dt * 0.6);
    p.bubT = (p.bubT || 0) + dt;
    if (p.bubT > (Math.abs(p.vx) > 10 ? 0.14 : 0.4)){ p.bubT = 0; p.events.push('bubble'); }
    p.bubTop = surf !== null ? surf : p.y;             // выше поверхности пузыри не всплывают
    // корпус и голова смотрят туда, куда плывём
    var tgtAng = Math.atan2(p.vy, Math.max(24, Math.abs(p.vx)));
    if (tgtAng > 1.3) tgtAng = 1.3; if (tgtAng < -1.15) tgtAng = -1.15;
    if (Math.abs(p.vx) < 6 && Math.abs(p.vy) < 6) tgtAng = 0;
    if (dip < 10) tgtAng = 0;                              // у поверхности не тычемся головой
    p.swimAng += (tgtAng - p.swimAng) * Math.min(1, dt * 7);
    p.apexY = p.y;                                         // в воде падение с суши не копим
    p.buf = 0;
  } else {
    if (p.swimLaunch > 0) p.swimLaunch = Math.max(0, p.swimLaunch - dt);
    if (p.wasWet && !p.wading){
      p.wasWet = false; p.apexY = p.y; p.events.push('splash');
    }
    p.atSurface = false;
    p.swimAng += (0 - p.swimAng) * Math.min(1, dt * 6);
    p.vy += C.GRAV * dt;
    if (p.vy > C.MAXFALL) p.vy = C.MAXFALL;
  }

  /* слайд по стене */
  p.sliding = 0;
  if (!p.onGround && p.vy > 0 && !rolling && (p.lock <= 0 || p.lock >= 9)){
    var sd = 0;                                    // стена рядом — этого достаточно
    if (!rectFree(p.x + 2, p.y, p.w, p.h)) sd = 1;
    else if (!rectFree(p.x - 2, p.y, p.w, p.h)) sd = -1;
    if (sd !== 0 && rectFree(p.x, p.y, p.w, p.h)){
      p.sliding = sd; p.facing = sd; p.lock = 0;
      p.apexY = Math.max(p.apexY, p.y - C.SAFE + 6);   // медленный спуск по стене не травмирует
      if (p.vy > C.SLIDE_V) p.vy = C.SLIDE_V;
      p.apexY = Math.min(p.apexY, p.y - 1);
      if (Math.random() < 0.3) p.events.push('spark');
    }
  }

  var wasAir = !p.onGround, prevBottom = p.y + p.h, preX = p.x, preY = p.y;
  if (!wasAir){                                  // встаём на склон ДО шага, иначе упрёмся в ступень
    var slPre = slopeUnder(p);
    if (slPre !== null) p.y = slPre - p.h;
  }
  p.onGround = false;
  moveX(S, p, p.vx * dt);
  moveY(S, p, p.vy * dt);
  if (!p.onGround && grounded(S, p) && p.vy >= 0){ p.onGround = true; p.vy = 0; }

  if (!p.onGround){
    if (p.y < p.apexY) p.apexY = p.y;
    autoLadder(S, p, prevBottom);
    if (!inWater && !rolling && p.state === 'normal') tryBars(S, p);
    if (!inWater && !rolling && p.state === 'normal') tryLadder(S, p, inp);
    if (!inWater && p.state === 'normal') tryGrab(S, p);
    else if (inWater && p.atSurface && p.state === 'normal' && Math.abs(inp.x) > 0.35
             && !inp.downHeld && !inp.downPressed)
      tryClimbOut(S, p, inp.x > 0 ? 1 : -1);
  } else {
    var slY = slopeUnder(p);
    if (slY !== null && !p.ride){
      p.y = slY - p.h;                   // держимся ровно на поверхности склона
    } else if (!p.ride){
      var pq = platUnder(S, p, p.y + p.h + 1);
      if (pq && rectFree(p.x, pq.y - p.h, p.w, p.h)){ p.ride = pq; p.y = pq.y - p.h; }
      else p.y = Math.floor((p.y + p.h) / T) * T - p.h;
    } else if (p.ride && rectFree(p.x, p.ride.y - p.h, p.w, p.h)){
      p.y = p.ride.y - p.h;              // держимся ровно на поверхности платформы/кабины
    }
    p.vy = 0; p.coyote = C.COYOTE; p.jumping = false; p.lastWall = 0; p.lock = 0;
    if (wasAir){
      var wetFeet = isWaterV(tileAt(Math.floor(cxw/T), Math.floor((p.y + p.h - 1)/T)));
      var fall = (p.inWater || p.wading || wetCenter || wetFeet) ? 0 : (p.y - p.apexY);
      p.fell = fall;
      if (fall > C.SAFE){
        if (inp.x !== 0 && !rolling && p.rollCd <= 0){
          p.rollT = C.ROLL_T; setH(p, C.RH); p.facing = inp.x > 0 ? 1 : -1;
          p.vx = inp.x * C.ROLL_V; S.shake = Math.max(S.shake, 2);
          p.events.push('rollland');
          if (fall > C.HURT * 1.6) damage(S, 1, 0.35);
        } else {
          S.hitStop = Math.max(S.hitStop, C.HITSTOP);
          if (fall > C.HURT) damage(S, 2, 0.62); else damage(S, 1, 0.4);
          p.events.push('hardland');
        }
      } else if (fall > 18){ p.landT = 0.1; p.events.push('land'); }
      p.apexY = p.y;
    }
    if (p.state === 'normal' && !rolling){
      // стоим на верхней перекладине и жмём вниз — уходим на лестницу
      var lt = ladderTopUnder(p, p.y + p.h + 1);
      if (lt !== null && (inp.downPressed || inp.downHeld) && p.stance === 0){
        var lc = Math.floor((p.x + p.w/2) / T);
        var lr = Math.floor((lt + 2) / T);
        if (ladderTile(lc, lr)){
          p.y = lt - Math.round(p.h/2);      // центр — на первой перекладине
          p.x = lc*T + T/2 - p.w/2;          // и ровно по колонке лестницы
          attach(p, tileAt(lc, lr), lc, 0, 0);
          p.lad.tc = lc; p.lad.tr = lr;
          return;
        }
      }
      if (!tryLadder(S, p, inp)){
        onEdge = canDescend(p, inp.x);
        if (onEdge && p.grabCd <= 0){
          var inland = awayFromEdge(p, inp.x);           // ход от края — лаз лёжа, не вис
          if (inp.downHeld && !inland) p.edgeHoldT += dt; else p.edgeHoldT = 0;
          var tapHang = inp.downPressed && stanceBefore === 2 && !inland;
          var holdHang = inp.downHeld && !inland && p.edgeHoldT >= C.EDGE_HOLD;
          if (tapHang || holdHang){
            if (tryDescend(S, p, inp.x)) p.edgeHoldT = 0;
          }
        } else {
          p.edgeHoldT = 0;
        }
      }
    }
  }

  liftConstrain(S);
  stepDark(S, dt, preX, preY);
  markGap(p);
  crumbCheck(S, p);
  pickups(S, p);

  if (p.onGround && p.state === 'normal' && Math.abs(p.vx) < 6 && p.rollT <= 0){
    var rr = Math.floor((p.y + p.h + 2) / T), cc = Math.floor((p.x + p.w/2) / T);
    if (tileAt(cc, rr) === ROCK) { S.respawn.x = Math.round(p.x); S.respawn.y = Math.round(p.y); }
  }
  if (p.y > runtime.MAP_H * T + 40) damage(S, 1, 0.3);
}
