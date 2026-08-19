import { view } from '../render/ctx.js';
import { actx, getActx, resumeAudio } from './context.js';
import { getFxVol } from '../ui/settings.js';

export { actx, getActx, resumeAudio };

var liftOsc = null, liftGain = null;

export function hushLift(){
  if (liftGain) liftGain.gain.value = 0;
}

export function blip(f, d, type, vol){
  try{
    getActx();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.value = (vol || 0.035) * getFxVol(); o.connect(g); g.connect(actx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.stop(actx.currentTime + d);
  }catch(e){}
}

var soundVoices = {};

export function hushSounds(){
  for (var id in soundVoices){
    try { soundVoices[id].gain.gain.value = 0; } catch (e){}
  }
}

export function stopSounds(){
  for (var id in soundVoices){
    try {
      soundVoices[id].osc.stop();
      soundVoices[id].osc.disconnect();
      soundVoices[id].gain.disconnect();
    } catch (e){}
  }
  soundVoices = {};
}

function ensureVoice(s){
  var v = soundVoices[s.id];
  var type = s.type || 'sine', freq = s.freq || 220;
  if (v && v.type === type && v.freq === freq) return v;
  if (v){
    try { v.osc.stop(); v.osc.disconnect(); v.gain.disconnect(); } catch (e){}
  }
  getActx();
  var o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = 0;
  o.connect(g); g.connect(actx.destination);
  o.start();
  v = { osc: o, gain: g, type: type, freq: freq };
  soundVoices[s.id] = v;
  return v;
}

export function stepSounds(S, previewId){
  var list = (S && S.sounds) || [];
  var px = S && S.p ? S.p.x + S.p.w / 2 : 0;
  var py = S && S.p ? S.p.y + S.p.h / 2 : 0;
  var want = {}, i, s, g, dx, dy, d, r;
  for (i = 0; i < list.length; i++){
    s = list[i];
    if (s.roomHide) continue;
    want[s.id] = true;
    g = s.vol != null ? s.vol : 0.4;
    if (s.mode !== 'flat'){
      dx = s.x - px; dy = s.y - py;
      d = Math.sqrt(dx * dx + dy * dy);
      r = s.radius || 96;
      g *= Math.max(0, 1 - d / r);
    }
    if (previewId != null && s.id !== previewId) g *= 0.2;
    try { ensureVoice(s).gain.gain.value = g * 0.07; } catch (e){}
  }
  for (i in soundVoices){
    if (!want[i]){
      try { soundVoices[i].osc.stop(); soundVoices[i].osc.disconnect(); soundVoices[i].gain.disconnect(); } catch (e){}
      delete soundVoices[i];
    }
  }
}

export function liftSound(on){
  try{
    if (on){
      getActx();
      if (!liftOsc){
        liftOsc = actx.createOscillator(); liftGain = actx.createGain();
        liftOsc.type = 'sawtooth'; liftOsc.frequency.value = 62;
        liftGain.gain.value = 0.0;
        liftOsc.connect(liftGain); liftGain.connect(actx.destination);
        liftOsc.start();
      }
      liftGain.gain.value = 0.016;
      liftOsc.frequency.value = 58 + Math.sin((view.time || 0)*3)*4;
    } else if (liftGain){
      liftGain.gain.value = 0;
    }
  }catch(e){}
}
