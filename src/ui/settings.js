import { getMix, setMixMaster } from '../audio/music.js';
import { loadTalkPrefs, saveTalkPrefs } from '../audio/talk.js';
import { BAKED } from '../core/defaults.js';

var SKEY = 'ledge.settings.v1';

export function loadSettings(){
  var d = { music: 100, talk: 85, fx: 60 };
  if (BAKED.settings){
    if (BAKED.settings.music != null) d.music = clampPct(BAKED.settings.music);
    if (BAKED.settings.talk != null) d.talk = clampPct(BAKED.settings.talk);
    if (BAKED.settings.fx != null) d.fx = clampPct(BAKED.settings.fx);
  }
  try {
    var o = JSON.parse(localStorage.getItem(SKEY));
    if (o && typeof o === 'object'){
      if (o.music != null) d.music = clampPct(o.music);
      if (o.talk != null) d.talk = clampPct(o.talk);
      if (o.fx != null) d.fx = clampPct(o.fx);
    }
  } catch (e) {}
  return d;
}
export function saveSettings(s){
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
}
export function settingsSnapshot(){
  try {
    var raw = localStorage.getItem(SKEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_){ return null; }
}
export function clampPct(n){
  n = +n;
  if (n !== n) return 0;
  return Math.max(0, Math.min(100, n));
}
export function getFxVol(){
  return clampPct(loadSettings().fx) / 100;
}
export function applySettings(s){
  saveSettings(s);
  setMixMaster(s.music / 100);
  saveTalkPrefs({ vol: s.talk / 100 });
}
export function applyBootSettings(){
  var s = loadSettings();
  var mix = getMix();
  var bakedMusic = BAKED.settings && BAKED.settings.music != null;
  if (mix && mix.master != null && localStorage.getItem(SKEY) == null && !bakedMusic)
    s.music = clampPct(Math.round(mix.master * 100));
  applySettings(s);
}
