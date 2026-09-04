export function isFS(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }

export function isMobileTouch(){
  try { return matchMedia('(pointer:coarse)').matches; } catch(_){ return false; }
}

export function enterFS(){
  var el = document.documentElement;
  var rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq){ try { var r = rq.call(el); if (r && r.catch) r.catch(function(){}); } catch(_){} }
  if (screen.orientation && screen.orientation.lock){
    try { var l = screen.orientation.lock('landscape'); if (l && l.catch) l.catch(function(){}); } catch(_){}
  }
}

export function exitFS(){
  var ex = document.exitFullscreen || document.webkitExitFullscreen;
  if (ex){ try { ex.call(document); } catch(_){} }
}

// iOS Safari (не PWA) не даёт Fullscreen API и orientation.lock — там форс невозможен,
// портретный блок закрывается CSS-оверлеем (см. #rotate в styles.css).
export function requestMobileFS(){
  if (isMobileTouch() && !isFS()) enterFS();
}
