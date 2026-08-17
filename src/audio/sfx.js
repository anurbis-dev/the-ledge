import { view } from '../render/index.js';

export var actx = null;
var liftOsc = null, liftGain = null;

function ensureActx(){
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

export function resumeAudio(){
  try{
    ensureActx();
    if (actx && actx.resume) actx.resume();
  }catch(e){}
}

export function hushLift(){
  if (liftGain) liftGain.gain.value = 0;
}

export function blip(f, d, type, vol){
  try{
    ensureActx();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.value = vol || 0.035; o.connect(g); g.connect(actx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d); o.stop(actx.currentTime + d);
  }catch(e){}
}

export function liftSound(on){
  try{
    if (on){
      ensureActx();
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
