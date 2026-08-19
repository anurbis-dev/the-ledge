import GAME from '../core/game.js';
import { C } from '../core/constants.js';
import { cam, view, VW, VH, viewW, viewH } from './ctx.js';

export function clampCam(x, y){
  if (view.edit) return { x: x, y: y };
  var T = GAME.T;
  var vw = viewW(), vh = viewH();
  var x0 = GAME.mapMinC() * T, y0 = GAME.mapMinR() * T;
  var tw = GAME.MAP_W * T, th = GAME.MAP_H * T;
  return {
    x: tw <= vw ? x0 + (tw - vw) / 2 : Math.max(x0, Math.min(x0 + tw - vw, x)),
    y: th <= vh ? y0 + (th - vh) / 2 : Math.max(y0, Math.min(y0 + th - vh, y))
  };
}

function easeToward(cur, tgt, k, snap){
  var d = tgt - cur;
  if (Math.abs(d) <= snap) return tgt;
  return cur + d * k;
}

export function resetCam(p){
  cam.x = p.x - VW / 2;
  cam.y = p.y - VH / 2;
  cam.ax = p.x + p.w / 2;
  cam.ay = p.y + p.h / 2;
  cam.lead = 0;
  cam.look = 0;
}

export function followCam(dt, p, flags){
  flags = flags || {};
  var S = GAME.W;
  var pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  var dzx = C.CAM_DZ_X, dzy = C.CAM_DZ_Y;
  if (pcx - cam.ax > dzx) cam.ax = pcx - dzx;
  else if (pcx - cam.ax < -dzx) cam.ax = pcx + dzx;
  if (pcy - cam.ay > dzy) cam.ay = pcy - dzy;
  else if (pcy - cam.ay < -dzy) cam.ay = pcy + dzy;

  var snap = C.CAM_SNAP;
  if (snap < 0) snap = 0;
  var idleLead = Math.abs(p.vx) > C.CAM_LEAD_V ? 1 : C.CAM_LEAD_IDLE;
  var tgtLead = p.facing * C.CAM_LEAD * idleLead;
  cam.lead = easeToward(cam.lead, tgtLead, Math.min(1, dt * C.CAM_LEAD_K), snap);

  var canLook = !flags.lookLock && p.onGround && Math.abs(p.vx) < C.CAM_LOOK_V && p.state === 'normal';
  var wantLook = canLook ? (flags.downHeld ? C.CAM_LOOK_DN : flags.upHeld ? C.CAM_LOOK_UP : 0) : 0;
  cam.look = easeToward(cam.look, wantLook, Math.min(1, dt * C.CAM_LOOK_K), snap);

  var want = clampCam(cam.ax - VW / 2 + cam.lead, cam.ay - VH / 2 + cam.look);
  if (S.fade >= 0.95 || view.warpJump){
    cam.x = want.x; cam.y = want.y;
    view.warpJump = false;
    return;
  }
  var kk = 1 - Math.exp(-C.CAM_FOLLOW * dt);
  cam.x = easeToward(cam.x, want.x, kk, snap);
  cam.y = easeToward(cam.y, want.y, kk, snap);
}

export function pushCamRender(shake){
  var shx = 0, shy = 0;
  if (shake > 0.05){
    shx = (Math.random() - 0.5) * shake * 2;
    shy = (Math.random() - 0.5) * shake * 2;
  }
  var prev = { x: cam.x, y: cam.y };
  cam.x = Math.round(cam.x + shx);
  cam.y = Math.round(cam.y + shy);
  return prev;
}

export function popCamRender(prev){
  cam.x = prev.x;
  cam.y = prev.y;
}
