import { runtime } from '../core/runtime.js';
import { snapshotLayers, applyLayerSnap } from '../core/layers.js';

var MAX = 60;
var undo = [];
var redo = [];
var pending = null;
var dirty = false;
var endT = null;
var onChange = null;

var OBJ_KEYS = ['enemies', 'fliers', 'spiders', 'tendrils', 'torches', 'chests', 'items', 'lights', 'sounds', 'volumes'];

export function bindHistory(hooks){
  onChange = hooks && hooks.onChange;
}

function cloneJson(v){
  if (v == null) return v;
  try { return JSON.parse(JSON.stringify(v)); }
  catch (_){ return v; }
}

function captureObjs(S){
  var o = {}, i, k;
  if (!S) return o;
  for (i = 0; i < OBJ_KEYS.length; i++){
    k = OBJ_KEYS[i];
    o[k] = cloneJson(S[k] || []);
  }
  return o;
}

function applyObjs(S, o){
  if (!S || !o) return;
  var i, k;
  for (i = 0; i < OBJ_KEYS.length; i++){
    k = OBJ_KEYS[i];
    S[k] = cloneJson(o[k] || []);
  }
}

function capture(){
  return {
    layers: snapshotLayers(),
    objs: captureObjs(runtime.W),
    water: cloneJson((runtime.LV && runtime.LV.water) || [])
  };
}

function restore(snap){
  if (!snap) return;
  applyLayerSnap(snap.layers);
  applyObjs(runtime.W, snap.objs);
  if (runtime.LV) runtime.LV.water = cloneJson(snap.water || []);
  if (onChange) onChange('restore');
}

function emit(){
  if (onChange) onChange('stack');
}

function flushTimer(){
  if (endT){ clearTimeout(endT); endT = null; }
}

export function beginOp(){
  flushTimer();
  if (pending) return;
  pending = capture();
  dirty = false;
}

export function noteOp(){
  if (!pending) return;
  dirty = true;
}

export function endOp(){
  flushTimer();
  if (!pending) return;
  if (dirty){
    undo.push(pending);
    if (undo.length > MAX) undo.shift();
    redo.length = 0;
    emit();
  }
  pending = null;
  dirty = false;
}

export function touchOp(){
  if (!pending) beginOp();
  noteOp();
  flushTimer();
  endT = setTimeout(function(){ endT = null; endOp(); }, 360);
}

export function undoOp(){
  endOp();
  if (!undo.length) return false;
  var cur = capture();
  var prev = undo.pop();
  redo.push(cur);
  restore(prev);
  emit();
  return true;
}

export function redoOp(){
  endOp();
  if (!redo.length) return false;
  var cur = capture();
  var next = redo.pop();
  undo.push(cur);
  restore(next);
  emit();
  return true;
}

export function clearHistory(){
  flushTimer();
  undo.length = 0;
  redo.length = 0;
  pending = null;
  dirty = false;
  emit();
}

export function canUndo(){ return undo.length > 0; }
export function canRedo(){ return redo.length > 0; }
