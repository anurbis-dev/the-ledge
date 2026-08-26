/* Реестр hero-family персонажей: palette/style/headRows/parts на каждый spriteId.
   Позы (K/poses.js) — общие для всех, здесь только внешний вид. */
import { PALETTE as HERO_PAL, STYLE as HERO_STYLE, HEAD_ROWS as HERO_HEAD_ROWS, PARTS as HERO_PARTS } from './hero-look.js';
import {
  PALETTE as SHIRLEY_PAL, STYLE as SHIRLEY_STYLE, HEAD_ROWS as SHIRLEY_HEAD_ROWS, PARTS as SHIRLEY_PARTS,
  HEAD_PIVOT as SHIRLEY_HEAD_PIVOT, PART_PIVOTS as SHIRLEY_PART_PIVOTS, DRAW_ORDER as SHIRLEY_DRAW_ORDER
} from './shirley/data.js';

/* Закрытые глаза (knockedOut) — тот же профиль без 'e'. */
function closedRows(rows){
  return rows.map(function(row){
    return row.split('').map(function(ch){ return ch === 'e' ? 's' : ch; }).join('');
  });
}

/* Пивоты/порядок отрисовки, зашитые в figure.js до появления Shirley.html
   как инструмента авторинга — старый риг (hero) их не экспортирует, так что
   тут те же числа, что раньше были захардкожены в drawHead/PART_DEFS. */
var DEFAULT_HEAD_PIVOT = { c: 3, r: 4 };
var DEFAULT_PART_PIVOTS = {
  hand: { c: 1.5, r: 0.5 }, boot: { c: 2, r: 1.5 }, hip: { c: 4, r: 2 }, pack: { c: 2, r: 1 }
};

function entry(palette, style, headRows, parts, headPivot, partPivots, drawOrder){
  return {
    palette: palette, style: style,
    headRows: headRows, headRowsClosed: closedRows(headRows),
    parts: parts,
    headPivot: headPivot || DEFAULT_HEAD_PIVOT,
    partPivots: Object.assign({}, DEFAULT_PART_PIVOTS, partPivots || {}),
    drawOrder: drawOrder || null
  };
}

var CHARACTERS = {
  hero: entry(HERO_PAL, HERO_STYLE, HERO_HEAD_ROWS, HERO_PARTS),
  shirley: entry(SHIRLEY_PAL, SHIRLEY_STYLE, SHIRLEY_HEAD_ROWS, SHIRLEY_PARTS,
    SHIRLEY_HEAD_PIVOT, SHIRLEY_PART_PIVOTS, SHIRLEY_DRAW_ORDER)
};

export function getCharacter(id){
  return CHARACTERS[id] || CHARACTERS.hero;
}
