// Пишет текущий черновик редактора в src/core/defaults.js через /__bake.
// Работает только пока крутится vite; file:// / dist молча пропускают.
import { levelsStoreSnapshot, localSavedAt, flushLevel } from './persist.js';
import { paramsSnapshot } from '../editor/params.js';
import { introSnapshot } from './intro.js';
import { settingsSnapshot } from '../ui/settings.js';
import { mixSnapshot, scoreSnapshot } from '../audio/music.js';
import { talkSnapshot } from '../audio/talk.js';
import { snapshotTiles, snapshotGfx } from './tileset.js';
import { snapshotSpriteAnchors } from './spriteset.js';
import { runtime } from './runtime.js';

var bakeT = null;
var inflight = false;
var again = false;
/** Явный Bake, кликнутый пока шёл другой POST — ждёт реальной записи. */
var waitFull = null;
var BAKE_MS = 700;

export function collectAuto(){
  var o = {
    levels: levelsStoreSnapshot(),
    tiles: snapshotTiles(),
    tileGfx: snapshotGfx(),
    sprites: snapshotSpriteAnchors(),
    savedAt: localSavedAt()
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

export function scheduleBake(){
  if (bakeT) clearTimeout(bakeT);
  bakeT = setTimeout(function(){
    bakeT = null;
    pushBake({ silent: true }).catch(function(){});
  }, BAKE_MS);
}

function runBake(opts){
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
  var needSilent = again;
  again = false;
  if (queued){
    // Full Bake покрывает silent again.
    return runBake(queued.opts).then(function(res){
      queued.resolve(res);
      inflight = false;
      if (again){ again = false; scheduleBake(); }
      return firstErr ? Promise.reject(firstErr) : (firstOpts.full ? res : firstRes);
    }, function(err){
      queued.reject(err);
      inflight = false;
      return Promise.reject(firstErr || err);
    });
  }
  inflight = false;
  if (needSilent) scheduleBake();
  if (firstErr) return Promise.reject(firstErr);
  return firstRes;
}

export function pushBake(opts){
  opts = opts || {};
  if (inflight){
    again = true;
    // Autosave во время чужого POST — только again, без фейкового OK.
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
  return pushBake(opts || { silent: true });
}
