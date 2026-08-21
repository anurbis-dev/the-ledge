import { view } from './ctx.js';
import { P } from './palette.js';

/* дефолты осыпания песка — placeable FX и CRUMB делят один API */
export var SAND_DEF = {
  n: 1,
  speed: 18,
  speedRand: 14,
  life: 0.5,
  lifeRand: 0.4,
  gravity: 55,
  size: 1,
  spread: 6,
  drag: 1.4,
  lift: 0,
  colors: null
};

/* конфигурируемые песчаные зёрна (kind:'dust') */
export function emitSand(x, y, opts){
  opts = opts || {};
  var d = SAND_DEF;
  var n = opts.n != null ? (opts.n | 0) : d.n;
  if (n < 1) return;
  var speed = opts.speed != null ? +opts.speed : d.speed;
  var speedRand = opts.speedRand != null ? +opts.speedRand : d.speedRand;
  var life0 = opts.life != null ? +opts.life : d.life;
  var lifeRand = opts.lifeRand != null ? +opts.lifeRand : d.lifeRand;
  var g = opts.gravity != null ? +opts.gravity : d.gravity;
  var spread = opts.spread != null ? +opts.spread : d.spread;
  var drag = opts.drag != null ? +opts.drag : d.drag;
  var sz = opts.size != null ? (opts.size | 0) : d.size;
  if (sz < 1) sz = 1;
  var lift = opts.lift != null ? +opts.lift : d.lift;
  var cols = opts.color ? [opts.color]
    : (opts.colors || d.colors || ['#e8d8b4', '#cbb892', P.crumL, P.crumD]);
  var parts = view.parts, i, spd, life, vx, vy;
  for (i = 0; i < n; i++){
    spd = speed + Math.random() * speedRand;
    /* g=0 и speed=0: не разгоняем через один speedRand — иначе «падают» при нулях */
    if (g <= 0 && speed <= 0 && lift <= 0) spd = 0;
    life = Math.max(0.08, life0 + Math.random() * lifeRand);
    vx = (Math.random() - 0.5) * spread * 2;
    /* g>0: песок вниз; g=0: speed без одностороннего падения */
    if (lift > 0) vy = -(Math.random() * lift) + spd * 0.25;
    else if (g > 0) vy = spd * (0.35 + Math.random() * 0.65);
    else vy = (Math.random() - 0.5) * spd;
    parts.push({
      x: x + (Math.random() - 0.5) * spread,
      y: y + (g > 0 ? Math.random() * 2 : 0),
      vx: vx, vy: vy, t: life, life: life,
      c: cols[i % cols.length],
      g: g, sz: (opts.sizeRand !== false && Math.random() < 0.4) ? sz + 1 : sz,
      drag: drag, kind: 'dust'
    });
  }
}
