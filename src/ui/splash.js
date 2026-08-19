var TITLE_FACE = "48px 'Press Start 2P'";

if (typeof document !== 'undefined' && document.fonts && document.fonts.load){
  document.fonts.load(TITLE_FACE).catch(function(){});
}

function titleFaceReady(){
  try { return !!(document.fonts && document.fonts.check(TITLE_FACE)); }
  catch (e) { return false; }
}

function whenTitleStyled(cb){
  var fired = false;
  function go(){
    if (fired) return;
    fired = true;
    cb();
  }
  var el = document.querySelector('.splash-title');
  var lastW = -1, stable = 0, t0 = performance.now();
  if (document.fonts && document.fonts.load){
    document.fonts.load(TITLE_FACE).catch(function(){});
  }
  function tick(){
    var booted = !document.body.getAttribute('data-boot');
    var w = el ? el.getBoundingClientRect().width : 0;
    var ok = booted && titleFaceReady() && w > 1 && Math.abs(w - lastW) < 0.5;
    lastW = w;
    stable = ok ? stable + 1 : 0;
    if (stable >= 2 || performance.now() - t0 > 2500){
      requestAnimationFrame(function(){ requestAnimationFrame(go); });
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

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

  function reveal(){
    if (started || done) return;
    if (reduced){
      root.classList.add('ready');
      setTimeout(onInput, 40);
      return;
    }
    root.classList.add('can-fade');
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if (started || done) return;
        root.classList.add('ready');
      });
    });
  }

  root.classList.remove('hide');
  root.classList.remove('out');
  root.classList.remove('advance');
  root.addEventListener('click', onInput);
  document.addEventListener('keydown', onInput, { capture: true, passive: true });

  whenTitleStyled(reveal);
}
