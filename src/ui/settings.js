import { getMix, setMixMaster } from '../audio/music.js';
import { loadTalkPrefs, saveTalkPrefs } from '../audio/talk.js';

var SKEY = 'ledge.settings.v1';

export function loadSettings(){
  var d = { music: 100, talk: 85, fx: 60 };
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
  if (mix && mix.master != null && localStorage.getItem(SKEY) == null)
    s.music = clampPct(Math.round(mix.master * 100));
  applySettings(s);
}
