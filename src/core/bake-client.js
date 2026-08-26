// Пишет текущий черновик редактора в src/core/defaults.js через /__bake.
// Работает только пока крутится vite; file:// / dist молча пропускают.
import { levelsStoreSnapshot, localSavedAt, flushLevel } from './persist.js';
import { paramsSnapshot } from '../editor/params.js';
import { introSnapshot } from './intro.js';
import { settingsSnapshot } from '../ui/settings.js';
import { mixSnapshot, scoreSnapshot } from '../audio/music.js';
import { talkSnapshot } from '../audio/talk.js';
import { snapshotTiles, snapshotGfx } from './tileset.js';
import { snapshotSprites, snapshotSpriteDefs } from './spriteset.js';
import { runtime } from './runtime.js';

var inflight = false;
var again = false;
/** Явный Bake, кликнутый пока шёл другой POST — ждёт реальной записи. */
var waitFull = null;

export function collectAuto(){
  var o = {
    levels: levelsStoreSnapshot(),
    tiles: snapshotTiles(),
    tileGfx: snapshotGfx(),
    // Полный saved (frames+якоря); серверный spriteAnchors упакует для BAKED.
    sprites: snapshotSprites(),
    spriteDefs: snapshotSpriteDefs(),
    savedAt: localSavedAt() || Date.now()
  };
  var params = paramsSnapshot();
  if (params) o.params = params;
  var intro = introSnapshot();
  if (intro) o.intro = intro;
  return o;
}

export function collectFull(){
  var o = collectAuto();
  o.settings = settingsSnapshot();
  o.score = scoreSnapshot();
  o.mix = mixSnapshot();
  o.talk = talkSnapshot();
  return o;
}

/** Авто-бейк отключён: на диск только кнопка Bake. */
export function scheduleBake(){}

function bakeOriginError(){
  try {
    if (location.protocol === 'file:'){
      return 'Open http://localhost:5174/ (Bake does not work from file:// dist).';
    }
    if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'){
      return 'Bake only works on the Vite tab (http://localhost:5174/).';
    }
  } catch (_){}
  return null;
}

function runBake(opts){
  var originErr = bakeOriginError();
  if (originErr){
    var early = new Error(originErr);
    early.bakeOrigin = true;
    return Promise.reject(early);
  }
  var dump = opts.full ? collectFull() : collectAuto();
  if (!dump.savedAt) dump.savedAt = Date.now();
  var body;
  try { body = JSON.stringify(dump); } catch (err){
    return Promise.reject(err);
  }
  inflight = true;
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timedOut = false;
  var ms = opts.timeout != null ? opts.timeout : (opts.silent ? 8000 : 4000);
  var timer = setTimeout(function(){ timedOut = true; if (ctrl) ctrl.abort(); }, ms);
  return fetch('/__bake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
    signal: ctrl ? ctrl.signal : undefined
  }).then(function(r){
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(res){
    // inflight держим до finishQueue — иначе в щель влезет чужой pushBake.
    if (res && res.ok) return res;
    inflight = false;
    throw new Error(res && res.error || 'unknown error');
  }).catch(function(err){
    clearTimeout(timer);
    inflight = false;
    err.timedOut = timedOut;
    if (!err.bakeOrigin && err && /Failed to fetch|NetworkError|Load failed/i.test(String(err.message || err))){
      err.message = 'Failed to fetch — use the Vite tab http://localhost:5174/ (not file://). Port busy ≠ this tab is on Vite.';
    }
    throw err;
  });
}

function takeQueuedFull(){
  var q = waitFull;
  waitFull = null;
  return q;
}

function finishQueue(firstOpts, firstRes, firstErr){
  var queued = takeQueuedFull();
  again = false;
  if (queued){
    return runBake(queued.opts).then(function(res){
      queued.resolve(res);
      inflight = false;
      return firstErr ? Promise.reject(firstErr) : (firstOpts.full ? res : firstRes);
    }, function(err){
      queued.reject(err);
      inflight = false;
      return Promise.reject(firstErr || err);
    });
  }
  inflight = false;
  if (firstErr) return Promise.reject(firstErr);
  return firstRes;
}

export function pushBake(opts){
  opts = opts || {};
  if (inflight){
    again = true;
    if (opts.silent) return Promise.resolve({ ok: false, busy: true });
    if (waitFull) return waitFull.promise;
    var resolve, reject;
    var promise = new Promise(function(res, rej){ resolve = res; reject = rej; });
    waitFull = { opts: opts, resolve: resolve, reject: reject, promise: promise };
    return promise;
  }
  return runBake(opts).then(
    function(res){ return finishQueue(opts, res, null); },
    function(err){ return finishQueue(opts, null, err); }
  );
}

export function flushAndBake(opts){
  flushLevel(runtime.W);
  return pushBake(opts || { full: true });
}
