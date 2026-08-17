export var actx = null;

export function getActx(){
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

export function resumeAudio(){
  try{
    getActx();
    if (actx && actx.resume) actx.resume();
  }catch(e){}
}
