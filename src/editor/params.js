import { C } from '../core/constants.js';
import GAME from '../core/game.js';
import { stanceH, stanceW } from '../core/player.js';
import { initSliders } from './slider.js';
import { BAKED } from '../core/defaults.js';
import { preferLocal, notifyDraftChange } from '../core/persist.js';

var PKEY = 'ledge.dev.C';
if (BAKED.params){
  for (var _bk in BAKED.params){
    if (Object.prototype.hasOwnProperty.call(C, _bk) && typeof BAKED.params[_bk] === 'number' && Number.isFinite(BAKED.params[_bk]))
      C[_bk] = BAKED.params[_bk];
  }
}
export var C0 = {};
for (var _k in C) if (Object.prototype.hasOwnProperty.call(C, _k)) C0[_k] = C[_k];

export function paramsSnapshot(){
  try {
    var raw = localStorage.getItem(PKEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_){ return null; }
}

export var PARAM_GROUPS = [
  { id: 'hitbox', name: 'Hitbox', items: [
    { key: 'W', label: 'Stand width', min: 4, max: 20, step: 1, hint: 'Ширина хитбокса стоя (и в приседе). Коллизии со стенами/полом.' },
    { key: 'H', label: 'Stand height', min: 10, max: 36, step: 1, hint: 'Высота хитбокса стоя. Ноги на y+h.' },
    { key: 'RH', label: 'Roll height', min: 6, max: 22, step: 1, hint: 'Высота хитбокса во время кувырка.' },
    { key: 'CRH', label: 'Crouch height', min: 8, max: 22, step: 1, hint: 'Высота хитбокса в приседе (stance 1).' },
    { key: 'PRH', label: 'Prone height', min: 4, max: 16, step: 1, hint: 'Высота хитбокса лёжа (stance 2).' },
    { key: 'PRW', label: 'Prone width', min: 10, max: 28, step: 1, hint: 'Ширина хитбокса лёжа; обычно шире стоячего.' }
  ]},
  { id: 'run', name: 'Run / Walk', items: [
    { key: 'RUN', label: 'Run speed', min: 20, max: 220, step: 1, hint: 'Макс. горизонтальная скорость бега стоя (px/s).' },
    { key: 'ACC', label: 'Acceleration', min: 100, max: 2400, step: 10, hint: 'Разгон до RUN/WALK (px/s²). Больше — резче старт.' },
    { key: 'FRIC', label: 'Friction', min: 100, max: 3000, step: 10, hint: 'Торможение без ввода на земле (px/s²).' },
    { key: 'WALK_V', label: 'Walk speed', min: 10, max: 120, step: 1, hint: 'Скорость тихого шага (если отдельно от бега).' },
    { key: 'CROUCH_V', label: 'Crouch speed', min: 8, max: 100, step: 1, hint: 'Макс. скорость в приседе.' },
    { key: 'PRONE_V', label: 'Prone speed', min: 4, max: 80, step: 1, hint: 'Макс. скорость лёжа / ползком.' },
    { key: 'DASH_V', label: 'Dash speed', min: 40, max: 280, step: 1, hint: 'Скорость рывка (и потолок под водой с dash).' },
    { key: 'SLOPE_ALONG', label: 'Slope along', min: 0.4, max: 1.2, step: 0.01, hint: 'Множитель скорости вдоль скоса (1 = как по ровному).' },
    { key: 'STEP_UP', label: 'Auto step height', min: 0, max: 8, step: 1, hint: 'Макс. высота ступеньки, на которую нога заходит сама при ходьбе, без mantle (px).' }
  ]},
  { id: 'jump', name: 'Jump / Gravity', items: [
    { key: 'GRAV', label: 'Gravity', min: 200, max: 1600, step: 10, hint: 'Ускорение вниз в воздухе (px/s²).' },
    { key: 'MAXFALL', label: 'Max fall', min: 80, max: 700, step: 5, hint: 'Потолок скорости падения vy (px/s).' },
    { key: 'JUMP', label: 'Jump velocity', min: -420, max: -80, step: 1, hint: 'Начальный vy прыжка (отриц. = вверх).' },
    { key: 'CUT', label: 'Jump cut', min: 0.1, max: 1, step: 0.01, hint: 'Множитель vy при отпускании прыжка рано (короткий хоп).' },
    { key: 'COYOTE', label: 'Coyote time', min: 0, max: 0.3, step: 0.01, hint: 'Сек. после схода с края, когда прыжок ещё засчитывается.' },
    { key: 'BUF', label: 'Jump buffer', min: 0, max: 0.3, step: 0.01, hint: 'Сек. до приземления: ранний Jump всё равно сработает.' }
  ]},
  { id: 'grab', name: 'Grab / Climb', items: [
    { key: 'HAND', label: 'Hand offset', min: 1, max: 10, step: 1, hint: 'Fallback Y рук, если у кадра нет якоря grab (px от origin).' },
    { key: 'TOL_UP', label: 'Grab tol up', min: 1, max: 10, step: 1, hint: 'Тайловая кромка: насколько руки могут быть выше губы (px).' },
    { key: 'TOL_DN', label: 'Grab tol down', min: 1, max: 16, step: 1, hint: 'Тайловая кромка: насколько руки могут быть ниже губы (px).' },
    { key: 'GRAB_VY', label: 'Grab max vy', min: -260, max: -20, step: 1, hint: 'Хват только если vy ≥ этого (слишком быстрый взлёт — не цепляемся).' },
    { key: 'GRAB_CD', label: 'Grab cooldown', min: 0, max: 0.6, step: 0.01, hint: 'Пауза после срыва/отпускания, пока нельзя снова схватить край.' },
    { key: 'PLAT_GRAB', label: 'Plat grab X', min: 2, max: 28, step: 1, hint: 'Движ. платформа: макс. |X| между якорем рук (grab) и губой палубы. Больше — легче зацепиться сбоку.' },
    { key: 'PLAT_GRAB_Y', label: 'Plat grab Y', min: 2, max: 20, step: 1, hint: 'Движ. платформа: макс. |Y| между якорем рук и поверхностью палубы (q.y). Не путать с X-reach: это вертикальный допуск «руки на уровне дека».' },
    { key: 'CLIMB_UP', label: 'Climb up t', min: 0.1, max: 1.2, step: 0.01, hint: 'Длительность анимации подъёма с виса на палубу/уступ (сек).' },
    { key: 'CLIMB_DN', label: 'Climb down t', min: 0.1, max: 1.2, step: 0.01, hint: 'Длительность слезания с края в вис (сек).' },
    { key: 'TO_LAD', label: 'To ladder t', min: 0.05, max: 0.8, step: 0.01, hint: 'Время перехода с виса на низ лестницы в лазание (сек).' },
    { key: 'VAULT_T', label: 'Vault time', min: 0.08, max: 0.6, step: 0.01, hint: 'Mantle: залезть на ступень +1 тайл с земли (сек анимации).' },
    { key: 'STAND_OFF', label: 'Stand offset', min: 2, max: 16, step: 1, hint: 'Смещение центра стоячего хитбокса внутрь от губы после подъёма (px).' },
    { key: 'EDGE_HOLD', label: 'Edge hold', min: 0, max: 0.6, step: 0.01, hint: 'Удержание у края перед авто-слезанием / скатыванием (сек).' }
  ]},
  { id: 'wall', name: 'Wall', items: [
    { key: 'SLIDE_V', label: 'Slide speed', min: 10, max: 160, step: 1, hint: 'Скорость скольжения вниз по стене (px/s).' },
    { key: 'WJ_X', label: 'Walljump X', min: 40, max: 220, step: 1, hint: '|vx| отскока от стены при walljump.' },
    { key: 'WJ_Y', label: 'Walljump Y', min: -320, max: -60, step: 1, hint: 'vy walljump (отриц. = вверх).' },
    { key: 'WJ_LOCK', label: 'Walljump lock', min: 0, max: 0.5, step: 0.01, hint: 'Блок повторного walljump / ввода после отскока (сек).' },
    { key: 'WJ_SAME_X', label: 'Same-wall X', min: 20, max: 160, step: 1, hint: '|vx| слабого отскока, если снова та же стена.' },
    { key: 'WJ_SAME_Y', label: 'Same-wall Y', min: -240, max: -40, step: 1, hint: 'vy слабого same-wall jump.' }
  ]},
  { id: 'combat', name: 'Combat / Action', items: [
    { key: 'ATK_T', label: 'Attack time', min: 0.08, max: 0.8, step: 0.01, hint: 'Длительность анимации удара ближнего боя (сек).' },
    { key: 'ATK_R', label: 'Attack reach', min: 8, max: 48, step: 1, hint: 'Дальность хитбокса удара вперёд (px).' },
    { key: 'ATK_CD', label: 'Attack cooldown', min: 0, max: 0.6, step: 0.01, hint: 'Пауза между ударами после завершения атаки.' },
    { key: 'HURT_CD', label: 'Hurt i-frames', min: 0.2, max: 2.5, step: 0.05, hint: 'Неуязвимость после получения урона (сек).' },
    { key: 'ACT_R', label: 'Action radius', min: 8, max: 48, step: 1, hint: 'Радиус Interact: двери, рычаги, подбор, NPC (px).' },
    { key: 'THROW_X', label: 'Throw X', min: 40, max: 280, step: 1, hint: 'Гориз. скорость брошенного предмета.' },
    { key: 'THROW_Y', label: 'Throw Y', min: -240, max: -20, step: 1, hint: 'Верт. скорость броска (отриц. = вверх).' },
    { key: 'THROW_T', label: 'Throw time', min: 0.06, max: 0.6, step: 0.01, hint: 'Длительность анимации броска (сек).' },
    { key: 'PICK_T', label: 'Pickup time', min: 0.08, max: 0.8, step: 0.01, hint: 'Длительность анимации подбора с пола (сек).' }
  ]},
  { id: 'stance', name: 'Stance / Roll', items: [
    { key: 'STANCE_T', label: 'Stance blend', min: 0.04, max: 0.4, step: 0.01, hint: 'Время морфа хитбокса стоя↔присед↔лёжа (сек).' },
    { key: 'ROLL_V', label: 'Roll speed', min: 60, max: 280, step: 1, hint: 'Гориз. скорость кувырка (px/s).' },
    { key: 'ROLL_T', label: 'Roll time', min: 0.15, max: 1, step: 0.01, hint: 'Длительность кувырка (сек).' },
    { key: 'ROLL_CD', label: 'Roll cooldown', min: 0, max: 0.5, step: 0.01, hint: 'Пауза до следующего кувырка.' },
    { key: 'STAM_MAX', label: 'Stamina', min: 0.4, max: 6, step: 0.1, hint: 'Запас выносливости на рывки/действия (единицы).' }
  ]},
  { id: 'swim', name: 'Swim / Air', items: [
    { key: 'AIR_MAX', label: 'Air max', min: 3, max: 30, step: 0.5, hint: 'Запас воздуха без акваланга (сек под водой).' },
    { key: 'SCUBA_AIR', label: 'Scuba air', min: 10, max: 80, step: 1, hint: 'Запас воздуха со scuba (сек).' },
    { key: 'SWIM_V', label: 'Swim speed', min: 20, max: 140, step: 1, hint: 'Макс. гориз. скорость плавания.' },
    { key: 'SWIM_UP', label: 'Swim up', min: -180, max: -10, step: 1, hint: 'Скорость всплытия по ↑ (отриц. vy).' },
    { key: 'SWIM_DN', label: 'Swim down', min: 20, max: 160, step: 1, hint: 'Скорость погружения по ↓.' },
    { key: 'SWIM_JUMP', label: 'Swim launch', min: -320, max: -60, step: 1, hint: 'vy выпрыгивания с поверхности воды.' },
    { key: 'FLIP_MUL', label: 'Flipper mul', min: 1, max: 2.2, step: 0.05, hint: 'Множитель скорости плавания в ластах.' }
  ]},
  { id: 'harpoon', name: 'Harpoon / Grapple', items: [
    { key: 'HARPOON_V', label: 'Shot speed', min: 60, max: 420, step: 5, hint: 'Скорость полёта гарпуна / крюка (px/s).' },
    { key: 'HARPOON_LEN', label: 'Grapple length', min: 32, max: 320, step: 4, hint: 'Макс. длина троса граппла (px).' },
    { key: 'HARPOON_PULL', label: 'Pull speed', min: 80, max: 480, step: 5, hint: 'Скорость подтягивания к точке зацепа.' },
    { key: 'HARPOON_DETACH', label: 'Detach dist', min: 6, max: 56, step: 1, hint: 'На каком расстоянии до якоря трос отцепляется (px).' },
    { key: 'HARPOON_CD', label: 'Cooldown', min: 0, max: 1, step: 0.01, hint: 'Пауза между выстрелами гарпуна (сек).' }
  ]},
  { id: 'ladder', name: 'Ladder / Bar / Lift', items: [
    { key: 'LAD_V', label: 'Ladder speed', min: 20, max: 140, step: 1, hint: 'Скорость лазания по лестнице (px/s).' },
    { key: 'LAD_TOL', label: 'Ladder Y tol', min: 2, max: 16, step: 1, hint: 'Верт. допуск якоря рук к низу/перекладине лестницы (px).' },
    { key: 'LAD_XTOL', label: 'Ladder X tol', min: 4, max: 20, step: 1, hint: 'Гориз. допуск центра тела к оси лестницы (px).' },
    { key: 'LAD_SNAP', label: 'Ladder snap', min: 0.04, max: 0.4, step: 0.01, hint: 'Время примагничивания к лестнице при заходе (сек).' },
    { key: 'BAR_V', label: 'Bar speed', min: 16, max: 120, step: 1, hint: 'Скорость перемещения по потолочным перекладинам.' },
    { key: 'LIFT_V', label: 'Lift speed', min: 12, max: 100, step: 1, hint: 'Скорость кабины лифта по умолчанию (если у объекта не задано).' },
    { key: 'LIFT_DWELL', label: 'Lift dwell', min: 0.2, max: 4, step: 0.05, hint: 'Пауза лифта на этаже по умолчанию (сек).' }
  ]},
  { id: 'rope', name: 'Rope', items: [
    { key: 'ROPE_SEGS', label: 'Default segs', min: 4, max: 24, step: 1, hint: 'Число сегментов верёвки по умолчанию (Verlet).' },
    { key: 'ROPE_ELAST', label: 'Elasticity', min: 0, max: 1, step: 0.01, hint: 'Жёсткость связей сегментов (0 мягкая … 1 жёсткая).' },
    { key: 'ROPE_SWING', label: 'Swing force', min: 40, max: 500, step: 5, hint: 'Сила раскачки вбок при вводе на верёвке.' },
    { key: 'ROPE_SWING_CD', label: 'Swing CD', min: 0.1, max: 1, step: 0.02, hint: 'Пауза между толчками раскачки (сек).' },
    { key: 'ROPE_DAMP', label: 'Damping', min: 0.9, max: 1, step: 0.005, hint: 'Затухание скорости узлов за кадр (ближе к 1 — дольше качается).' },
    { key: 'ROPE_WIND', label: 'Idle wind', min: 0, max: 8, step: 0.1, hint: 'Слабый «ветер» на простой верёвке без игрока.' },
    { key: 'ROPE_CLIMB', label: 'Climb speed', min: 20, max: 120, step: 1, hint: 'Скорость подъёма/спуска по верёвке (px/s).' },
    { key: 'ROPE_GRAB', label: 'Grab radius', min: 6, max: 28, step: 1, hint: 'Радиус захвата ближайшего узла верёвки (px).' },
    { key: 'ROPE_ITERS', label: 'Constraint iters', min: 2, max: 12, step: 1, hint: 'Итерации стабилизации длины сегментов за кадр.' },
    { key: 'ROPE_CD', label: 'Regrab CD', min: 0, max: 1, step: 0.02, hint: 'Пауза после отпускания, пока нельзя снова схватить верёвку.' }
  ]},
  { id: 'fall', name: 'Fall / Damage', items: [
    { key: 'SAFE', label: 'Safe fall', min: 10, max: 120, step: 1, hint: 'Высота падения без последствий (px набранного fell).' },
    { key: 'HURT', label: 'Hurt fall', min: 30, max: 220, step: 1, hint: 'Порог, с которого падение даёт урон / жёсткое приземление.' },
    { key: 'ROLL_HURT', label: 'Roll hurt fall', min: 40, max: 320, step: 1, hint: 'Даже с roll-приземлением: выше этого fell всё ещё 1 урон.' },
    { key: 'ROLL_HURT_T', label: 'Roll hurt stun', min: 0, max: 1.5, step: 0.05, hint: 'Стан при rollland, который всё же нанёс урон (сек).' },
    { key: 'HITSTOP', label: 'Hitstop', min: 0, max: 0.2, step: 0.005, hint: 'Короткая пауза кадра при ударе/уроне (сек).' },
    { key: 'FALL_CROUCH_T', label: 'Fall crouch t', min: 0.1, max: 2, step: 0.05, hint: 'Длительность «присел от удара» после среднего падения.' },
    { key: 'FALL_PRONE_T', label: 'Fall prone t', min: 0.2, max: 3, step: 0.05, hint: 'Длительность нокаута лёжа после высокого падения.' },
    { key: 'GETUP_T', label: 'Get-up t', min: 0.1, max: 1.5, step: 0.05, hint: 'Длительность анимации подъёма с пола после нокаута.' }
  ]},
  { id: 'world', name: 'World / Hazards', items: [
    { key: 'WARP_T', label: 'Door warp t', min: 0.2, max: 1.5, step: 0.02, hint: 'Длительность перехода через дверь / варп (сек).' },
    { key: 'ROOM_FADE', label: 'Room fade t', min: 0.08, max: 2, step: 0.02, hint: 'Время затемнения/проявления комнаты (cover reveal).' },
    { key: 'CRUMB_T', label: 'Crumb crack t', min: 0.2, max: 3, step: 0.05, hint: 'Сколько секунд стоять на CRUMB, пока тайл не осыплется.' },
    { key: 'TEND_REACH', label: 'Tendril reach', min: 20, max: 180, step: 1, hint: 'Дальность захвата щупальца (px).' },
    { key: 'TEND_HOLD', label: 'Tendril hold', min: 0.4, max: 6, step: 0.1, hint: 'Сколько секунд щупальце держит игрока.' }
  ]},
  { id: 'camera', name: 'Camera', items: [
    { key: 'CAM_DZ_X', label: 'Dead zone X', min: 0, max: 80, step: 1, hint: 'Гориз. полуширина мёртвой зоны: внутри камера не едет за героем.' },
    { key: 'CAM_DZ_Y', label: 'Dead zone Y', min: 0, max: 80, step: 1, hint: 'Верт. полувысота мёртвой зоны камеры.' },
    { key: 'CAM_FOLLOW', label: 'Follow rate', min: 0.5, max: 20, step: 0.1, hint: 'Скорость «резинки» к якорю; больше — резче догоняет.' },
    { key: 'CAM_SNAP', label: 'Snap px', min: 0, max: 8, step: 0.05, hint: 'Если ошибка меньше — прилипание (убирает дрожание на пиксель).' },
    { key: 'CAM_SUBPX', label: 'Subpixel pan', min: 0, max: 1, step: 1, hint: '1 = плавное субпикс. пан; 0 = только целые экранные пиксели.' },
    { key: 'CAM_LEAD', label: 'Lead', min: 0, max: 80, step: 1, hint: 'Смещение взгляда вперёд по ходу бега (px).' },
    { key: 'CAM_LEAD_IDLE', label: 'Lead idle', min: 0, max: 1, step: 0.01, hint: 'Доля Lead при малой скорости (0 = нет взгляда вперёд стоя).' },
    { key: 'CAM_LEAD_V', label: 'Lead vx', min: 0, max: 120, step: 1, hint: 'При |vx| ≥ этого Lead полный.' },
    { key: 'CAM_LEAD_K', label: 'Lead blend', min: 0.2, max: 12, step: 0.1, hint: 'Скорость набора/сброса Lead (выше — быстрее).' },
    { key: 'CAM_LOOK_DN', label: 'Look down', min: 0, max: 90, step: 1, hint: 'Смещение камеры вниз при удержании ↓ (px).' },
    { key: 'CAM_LOOK_UP', label: 'Look up', min: -90, max: 0, step: 1, hint: 'Смещение камеры вверх при ↑ (отриц. px).' },
    { key: 'CAM_LOOK_V', label: 'Look vx max', min: 0, max: 60, step: 1, hint: 'Look up/down только если |vx| ниже этого порога.' },
    { key: 'CAM_LOOK_K', label: 'Look blend', min: 0.2, max: 12, step: 0.1, hint: 'Скорость набора/сброса look-смещения.' }
  ]}
];

export function loadParams(){
  if (!preferLocal()) return;
  try {
    var raw = localStorage.getItem(PKEY);
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    for (var k in o){
      if (Object.prototype.hasOwnProperty.call(C, k) && typeof o[k] === 'number' && Number.isFinite(o[k]))
        C[k] = o[k];
    }
  } catch (_){}
}

export function saveParams(){
  try {
    var o = {};
    for (var k in C) if (Object.prototype.hasOwnProperty.call(C, k) && C[k] !== C0[k]) o[k] = C[k];
    localStorage.setItem(PKEY, JSON.stringify(o));
  } catch (_){}
  notifyDraftChange();
}

export function applyParam(key, val){
  if (!Object.prototype.hasOwnProperty.call(C, key)) return;
  if (!Number.isFinite(val)) return;
  C[key] = val;
  var S = GAME.W, p = S && S.p;
  if (p){
    if (key === 'W' && p.stance !== 2) p.w = stanceW(p.stance);
    if (key === 'H' && p.stance === 0) p.h = stanceH(0);
    if (key === 'CRH' && p.stance === 1) p.h = stanceH(1);
    if (key === 'PRH' && p.stance === 2) p.h = stanceH(2);
    if (key === 'PRW' && p.stance === 2) p.w = stanceW(2);
    if (key === 'AIR_MAX' && !p.scuba) p.air = Math.min(p.air, C.AIR_MAX);
    if (key === 'SCUBA_AIR' && p.scuba) p.air = Math.min(p.air, C.SCUBA_AIR);
    if (key === 'STAM_MAX') p.stam = Math.min(p.stam, C.STAM_MAX);
  }
  saveParams();
}

export function resetAllParams(){
  for (var k in C0) C[k] = C0[k];
  try { localStorage.removeItem(PKEY); } catch (_){}
  notifyDraftChange();
  var S = GAME.W, p = S && S.p;
  if (p){
    if (p.stance === 2){ p.w = C.PRW; p.h = C.PRH; }
    else if (p.stance === 1){ p.w = C.W; p.h = C.CRH; }
    else { p.w = C.W; p.h = C.H; }
  }
}

function matches(q, group, item){
  if (!q) return true;
  var hay = (group.name + ' ' + item.key + ' ' + item.label + ' ' + (item.hint || '')).toLowerCase();
  return hay.indexOf(q) !== -1;
}

export function renderParams(host, query){
  if (!host) return;
  host.textContent = '';
  var q = (query || '').trim().toLowerCase();
  var shown = 0;
  for (var g = 0; g < PARAM_GROUPS.length; g++){
    var group = PARAM_GROUPS[g];
    var items = [];
    for (var i = 0; i < group.items.length; i++){
      if (!Object.prototype.hasOwnProperty.call(C, group.items[i].key)) continue;
      if (matches(q, group, group.items[i])) items.push(group.items[i]);
    }
    if (!items.length) continue;
    var sec = document.createElement('section');
    sec.className = 'ed-pg';
    var h = document.createElement('h4');
    h.className = 'ed-pg-title';
    h.textContent = group.name;
    sec.appendChild(h);
    for (var j = 0; j < items.length; j++){
      (function(it){
        var wrap = document.createElement('div');
        wrap.className = 'slider-wrap';
        wrap.title = it.key + (it.hint ? ' — ' + it.hint : '');
        var over = document.createElement('div');
        over.className = 'slider-label-overlay';
        var lab = document.createElement('span');
        lab.textContent = it.label;
        var val = document.createElement('span');
        over.appendChild(lab);
        over.appendChild(val);
        var inp = document.createElement('input');
        inp.type = 'range';
        inp.min = String(it.min);
        inp.max = String(it.max);
        inp.step = String(it.step);
        var cur = C[it.key];
        if (!Number.isFinite(cur)) cur = C0[it.key];
        inp.value = String(cur);
        inp.dataset.default = String(C0[it.key]);
        inp.addEventListener('input', function(){ applyParam(it.key, +inp.value); });
        wrap.appendChild(over);
        wrap.appendChild(inp);
        sec.appendChild(wrap);
      })(items[j]);
      shown++;
    }
    host.appendChild(sec);
  }
  if (!shown){
    var empty = document.createElement('div');
    empty.className = 'ed-pg-empty';
    empty.textContent = 'No matching parameters';
    host.appendChild(empty);
  }
  initSliders(host);
}

loadParams();
