// Заставка «the LEDGE»: буквы складываются из тлеющих угольков снизу вверх.
// Клик во время сборки — ускоряет проявление. Клик после сборки — буквы
// угольками улетают вверх и открывают меню.
var DUR = 2000, FORM_T = 1.55;

// Свечение вокруг угольков рисуем заранее отрисованным спрайтом (drawImage),
// а не ctx.shadowBlur — блюр на сотни фигур в кадр заметно дороже блита текстуры.
var GLOW_CACHE = {};
function getGlow(rgb){
  var cached = GLOW_CACHE[rgb];
  if (cached) return cached;
  var s = 48;
  var c = document.createElement('canvas');
  c.width = c.height = s;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(s/2,s/2,0, s/2,s/2, s/2);
  grad.addColorStop(0, 'rgba('+rgb+',1)');
  grad.addColorStop(.35, 'rgba('+rgb+',.55)');
  grad.addColorStop(1, 'rgba('+rgb+',0)');
  g.fillStyle = grad;
  g.fillRect(0,0,s,s);
  GLOW_CACHE[rgb] = c;
  return c;
}
function drawGlow(ctx, rgb, x, y, r, alpha){
  if (alpha <= 0) return;
  var d = r*7;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(getGlow(rgb), x-d/2, y-d/2, d, d);
  ctx.globalAlpha = 1;
}

export function showSplash(onDone){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.getElementById('splash');
  var canvas = document.getElementById('splashCv');
  var hint = document.getElementById('splashHint');
  var ctx = canvas.getContext('2d');

  var state = {
    particles:[], coal:[], sparks:[], sparkAcc:0,
    coalMinX:0, coalMaxX:0, coalY:0, topY:0,
    formedShown:false, disperse:null, playing:true,
    elapsed:0, speed:1, start:0, lastTs:0
  };
  var done = false;

  function resize(){
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio||1, 2);
    canvas.width = Math.max(1, Math.round(r.width*dpr));
    canvas.height = Math.max(1, Math.round(r.height*dpr));
  }

  function buildWordScene(dim){
    var off = document.createElement('canvas');
    off.width = dim.w; off.height = dim.h;
    var octx = off.getContext('2d');
    var bigSize = Math.round(Math.min(dim.w*0.095, dim.h*0.26));
    var smallSize = Math.round(bigSize*0.42);
    var hasLS = 'letterSpacing' in octx;
    octx.textBaseline = 'alphabetic';
    octx.font = '400 '+smallSize+'px ui-monospace, Menlo, Consolas, monospace';
    if (hasLS) octx.letterSpacing = '0px';
    var wThe = octx.measureText('the').width;
    octx.font = '700 '+bigSize+'px ui-monospace, Menlo, Consolas, monospace';
    if (hasLS) octx.letterSpacing = Math.round(bigSize*0.06)+'px';
    var wLedge = octx.measureText('LEDGE').width;
    var gap = bigSize*0.24;
    var total = wThe+gap+wLedge;
    var startX = dim.w/2 - total/2;
    var baseY = dim.h/2 + bigSize*0.32;
    octx.fillStyle = '#fff';
    octx.font = '400 '+smallSize+'px ui-monospace, Menlo, Consolas, monospace';
    if (hasLS) octx.letterSpacing = '0px';
    octx.fillText('the', startX, baseY);
    octx.font = '700 '+bigSize+'px ui-monospace, Menlo, Consolas, monospace';
    if (hasLS) octx.letterSpacing = Math.round(bigSize*0.06)+'px';
    octx.fillText('LEDGE', startX+wThe+gap, baseY);
    var data = octx.getImageData(0,0,dim.w,dim.h).data;
    var pts = [], minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    var step = Math.max(1, Math.round(dim.w/260));
    for (var y=0;y<dim.h;y+=step){
      for (var x=0;x<dim.w;x+=step){
        if (data[(y*dim.w+x)*4+3] > 120){
          pts.push([x,y]);
          if (x<minX) minX=x; if (x>maxX) maxX=x;
          if (y<minY) minY=y; if (y>maxY) maxY=y;
        }
      }
    }
    return {pts:pts, minX:minX, maxX:maxX, minY:minY, maxY:maxY, baseY:baseY};
  }

  function build(){
    resize();
    var dim = {w:canvas.width, h:canvas.height};
    var scene = buildWordScene(dim);
    var coalMinX = Math.max(0, scene.minX - dim.w*0.03);
    var coalMaxX = Math.min(dim.w, scene.maxX + dim.w*0.03);
    var coalY = scene.baseY + dim.h*0.045;
    var span = Math.max(1, coalY-scene.minY);
    // Точки рисуются в тех же px, что и canvas.width/height (уже умноженных на dpr),
    // поэтому без масштабирования на больших разрешениях они выглядят мельче буквы.
    var scale = Math.max(1, dim.w/900);
    state.scale = scale;

    state.particles = scene.pts.map(function(p){
      var tx=p[0], ty=p[1];
      var sx = Math.min(coalMaxX, Math.max(coalMinX, tx + (Math.random()*30-15)));
      var sy = coalY + (Math.random()*4-2);
      return {
        sx:sx, sy:sy, tx:tx, ty:ty,
        delay: ((coalY-ty)/span)*0.32 + Math.random()*0.5,
        size: (1.0+Math.random()*1.7)*scale,
        hue: Math.random()<0.5 ? '255,157,61' : '255,217,160',
        flicker: Math.random()*Math.PI*2,
        dDelay:0, dJitter:0, dRise:0
      };
    });

    var coalR = 1.6*scale;
    var coalCount = Math.max(10, Math.round((coalMaxX-coalMinX)/(coalR*2.2)));
    state.coal = [];
    for (var i=0;i<coalCount;i++){
      var x = coalMinX + (i+0.5)/coalCount*(coalMaxX-coalMinX);
      state.coal.push({x:x, y:coalY+(Math.random()*3-1.5), phase:Math.random()*Math.PI*2});
    }
    state.coalR = coalR;
    state.coalMinX=coalMinX; state.coalMaxX=coalMaxX; state.coalY=coalY; state.topY=scene.minY;
    state.sparks = []; state.sparkAcc = 0;
  }

  function spawnSpark(t){
    var x, y;
    if (t > 1.3 && state.particles.length){
      var p = state.particles[Math.floor(Math.random()*state.particles.length)];
      x = p.tx + (Math.random()*6-3); y = p.ty + (Math.random()*6-3);
    } else {
      x = state.coalMinX + Math.random()*(state.coalMaxX-state.coalMinX);
      y = state.coalY;
    }
    state.sparks.push({
      x:x, y:y, vx:(Math.random()*30-15), vy:-(40+Math.random()*70),
      life:1, maxLife:0.9+Math.random()*0.9, size:(0.8+Math.random()*1.4)*state.scale
    });
  }

  function beginDisperse(ts){
    state.disperse = { start: ts };
    var span = Math.max(1, state.coalY-state.topY);
    for (var i=0;i<state.particles.length;i++){
      var p = state.particles[i];
      p.dDelay = ((state.coalY-p.ty)/span)*0.5 + Math.random()*0.18;
      p.dJitter = Math.random()*10-5;
      p.dRise = canvas.height*(0.1+Math.random()*0.22);
    }
    if (hint) hint.classList.remove('show');
    root.classList.add('out');
  }

  function finish(){
    if (done) return;
    done = true;
    root.classList.add('hide');
    root.removeEventListener('click', onClick);
    window.removeEventListener('resize', onResize);
    if (onDone) onDone();
  }

  function draw(ts){
    if (!state.playing) return;
    if (!state.start) state.start = ts;
    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min(0.05, (ts-state.lastTs)/1000); state.lastTs = ts;
    if (!reduced) state.elapsed += dt*state.speed*1000;
    else state.elapsed = DUR*1.6;
    var t = state.elapsed/DUR;
    var dim = {w:canvas.width, h:canvas.height};
    ctx.clearRect(0,0,dim.w,dim.h);

    if (!state.formedShown && t >= FORM_T){
      state.formedShown = true;
      if (hint) hint.classList.add('show');
    }

    var dRawT = 0;
    if (state.disperse){
      if (!state.disperse.start) state.disperse.start = ts;
      dRawT = (ts-state.disperse.start)/650;
    }

    if (!state.disperse){
      for (var i=0;i<state.coal.length;i++){
        var c = state.coal[i];
        var decay = Math.max(0, 1 - t/1.5);
        var fl = reduced ? 0 : Math.sin(ts/240+c.phase)*0.18;
        var a = Math.max(0, decay + fl);
        if (a > 0.003){
          var cR = state.coalR*Math.max(0.6, 1+fl*0.6);
          drawGlow(ctx, '255,140,60', c.x, c.y, cR, a);
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,140,60,'+a+')';
          ctx.arc(c.x, c.y, cR, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }

    for (var i=0;i<state.particles.length;i++){
      var p = state.particles[i];
      var x, y, alpha, sizeMul=1;
      if (state.disperse){
        var dlt = (dRawT - p.dDelay)/0.6;
        if (dlt < 0){
          var flw = reduced ? 0 : Math.sin(ts/260+p.flicker)*0.15;
          x = p.tx; y = p.ty; alpha = 0.85+flw; sizeMul = 1+flw*0.6;
        } else {
          var dcl = Math.min(1, dlt);
          var de = dcl*dcl*(3-2*dcl);
          x = p.tx + p.dJitter*de;
          y = p.ty - p.dRise*de;
          alpha = Math.max(0, 1-de)*0.85;
          if (alpha <= 0.01) continue;
        }
      } else {
        var lt = (t-p.delay)/0.7;
        if (lt < 0) continue;
        var cl = Math.min(1, Math.max(0, lt));
        var e = 1-Math.pow(1-cl,3);
        x = p.sx + (p.tx-p.sx)*e;
        y = p.sy + (p.ty-p.sy)*e - Math.sin(cl*Math.PI)*dim.h*0.02;
        alpha = cl;
        if (cl >= 1){
          var fl2 = reduced ? 0 : Math.sin(ts/260+p.flicker)*0.15;
          alpha = 0.85+fl2; sizeMul = 1+fl2*0.6;
        }
      }
      var pSize = p.size*sizeMul;
      drawGlow(ctx, p.hue, x, y, pSize, Math.max(0,alpha)*0.9);
      ctx.beginPath();
      ctx.fillStyle = 'rgba('+p.hue+','+Math.max(0,alpha)+')';
      ctx.arc(x,y,pSize,0,Math.PI*2);
      ctx.fill();
    }

    if (!reduced && !state.disperse){
      var elapsedS = state.elapsed/1000;
      var rate = elapsedS < (DUR/1000)*0.6 ? 55 : 6;
      state.sparkAcc += dt*rate;
      while (state.sparkAcc >= 1){ spawnSpark(t); state.sparkAcc -= 1; }
    }
    if (!reduced || state.disperse){
      for (var i=state.sparks.length-1;i>=0;i--){
        var s = state.sparks[i];
        s.x += s.vx*dt; s.y += s.vy*dt; s.vy *= 0.995;
        s.life -= dt/s.maxLife;
        if (s.life<=0 || s.y<-20){ state.sparks.splice(i,1); continue; }
        var sSize = s.size*(0.55+0.45*Math.max(0,s.life));
        drawGlow(ctx, '255,190,120', s.x, s.y, sSize, Math.max(0,s.life));
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,190,120,'+Math.max(0,s.life)+')';
        ctx.arc(s.x,s.y,sSize,0,Math.PI*2);
        ctx.fill();
      }
    }

    if (state.disperse && dRawT >= 1.35 && !state.sparks.length){
      state.playing = false;
      finish();
      return;
    }
    if (!reduced || state.disperse) requestAnimationFrame(draw);
  }

  function onClick(){
    if (!state.formedShown){ state.speed = 5; return; }
    if (!state.disperse){
      beginDisperse(performance.now());
      requestAnimationFrame(draw);
    }
  }
  function onResize(){ if (state.coal.length) build(); }

  root.classList.remove('hide'); root.classList.remove('out');
  root.addEventListener('click', onClick);
  window.addEventListener('resize', onResize);

  document.fonts.ready.then(function(){
    build();
    requestAnimationFrame(draw);
  });
}
