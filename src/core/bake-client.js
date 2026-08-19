// Пишет текущий черновик редактора в src/core/defaults.js через /__bake.
// Работает только пока крутится vite; file:// / dist молча пропускают.
import { levelsStoreSnapshot, localSavedAt, flushLevel } from './persist.js';
import { paramsSnapshot } from '../editor/params.js';
import { introSnapshot } from './intro.js';
import { settingsSnapshot } from '../ui/settings.js';
import { mixSnapshot, scoreSnapshot } from '../audio/music.js';
import { talkSnapshot } from '../audio/talk.js';
import { snapshotTiles } from './tileset.js';
import { runtime } from './runtime.js';

var bakeT = null;
var inflight = false;
var again = false;
var BAKE_MS = 700;

export function collectAuto(){
  var o = {
    levels: levelsStoreSnapshot(),
    tiles: snapshotTiles(),
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

export function pushBake(opts){
  opts = opts || {};
  if (inflight){ again = true; return Promise.resolve({ ok: false, busy: true }); }
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
    inflight = false;
    if (again){ again = false; scheduleBake(); }
    if (res && res.ok) return res;
    throw new Error(res && res.error || 'unknown error');
  }).catch(function(err){
    clearTimeout(timer);
    inflight = false;
    if (again){ again = false; if (!opts.silent) scheduleBake(); }
    err.timedOut = timedOut;
    throw err;
  });
}

export function flushAndBake(opts){
  flushLevel(runtime.W);
  return pushBake(opts || { silent: true });
}
