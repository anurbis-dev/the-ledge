export function showSplash(onDone){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.getElementById('splash');
  var menu = document.getElementById('menu');
  if (!root){
    if (onDone) onDone();
    return;
  }

  var started = false;
  var done = false;

  function finish(){
    if (done) return;
    done = true;
    root.classList.add('out');
    setTimeout(function(){
      root.classList.add('hide');
      root.removeEventListener('click', onInput);
      document.removeEventListener('keydown', onInput, true);
      if (onDone) onDone();
    }, 260);
  }

  function onInput(e){
    var tag = e && e.target && e.target.tagName;
    if (e && e.type === 'keydown' && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
    if (started) return;
    started = true;

    if (menu){
      menu.classList.remove('hide');
      menu.classList.add('from-splash');
      setTimeout(function(){ menu.classList.add('from-splash-show'); }, 150);
    }

    root.classList.add('advance');
    setTimeout(finish, reduced ? 80 : 420);
  }

  root.classList.remove('hide');
  root.classList.remove('out');
  root.classList.remove('advance');
  root.classList.add('ready');
  root.addEventListener('click', onInput);
  document.addEventListener('keydown', onInput, { capture: true, passive: true });

  if (reduced){
    setTimeout(onInput, 40);
  }
}
