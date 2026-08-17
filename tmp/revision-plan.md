# the LEDGE — план ревизии v19 → модульный Vite

**Статус:** done (0.1.0-dev.0) — модули собраны, `npm run build` ок, 5 уровней стартуют  
**Источник:** `tmp/ledge-v19.html` (канон, 4613 строк, LEDGE v2)  
**Цель:** разнести монолит на ES-модули + сборка в один `dist/index.html` (как PixisEditor). Геймплей 1:1, без рерайта физики.  
**Репо:** https://github.com/anurbis-dev/the-ledge  
**Корень:** `D:\TMP\AI_games\the-ledge`

## Принцип

- Поведение = `tmp/ledge-v19.html`. Не «улучшать» прыжок/хват/воду в этом проходе.
- `var`/`function` → `export`. Русские комментарии оставить.
- Циклы импорта рвём через `src/core/runtime.js` (изменяемый bag: карта, LV, W).
- Публичный фасад `src/core/game.js` повторяет объект `GAME` из IIFE (тот же набор полей/методов).
- Рендер/ввод/редактор не импортируют внутренности физики — только `GAME`.
- Vanilla JS ES6, без TS, без фреймворков.

## Стек (как PixisEditor)

| | |
|---|---|
| dev | Vite |
| prod | `vite-plugin-singlefile` → `dist/index.html` |
| CSS | `src/styles.css`, в бандл инлайнится |
| version | `package.json` + `src/core/version.js` |

Команды: `npm run dev` / `npm run build`.

## Карта монолита v19

| Строки | Блок |
|--------|------|
| 1–93 | HTML + CSS + DOM |
| 96–2552 | IIFE `GAME` (ядро) |
| 99–121 | тайлы, `fillR`/`slopeRun`/`line` |
| 124–680 | `LEVELS` ×5 |
| 681–687 | `loadLevel` |
| 689–704 | константы `C` |
| 706–789 | запросы тайлов / `rectFree` |
| 791–1565 | сущности |
| 1567–2141 | игрок + хват/лаз/лестницы/перекладины |
| 2155–2503 | `step` |
| 2505–2551 | экспорт `GAME` |
| 2556–4052 | рендер + FX + HUD + события + SFX |
| 4054–4219 | редактор уровня |
| 4221–4490+ | ввод (стик/клавиши) + меню + цикл |
| 4491–4609 | `frame()` |

Уровни: 1 ПЕЩЕРЫ (126–320), 2 ОБРЫВ (321–414), 3 ВОДОПАД (415–512), 4 ЧЕРТОГИ (513–605), 5 ГОРНИЛО (606–680).

## Целевая раскладка

```
src/
  main.js                 bootstrap
  styles.css
  core/
    version.js
    constants.js          T, ids тайлов, C
    runtime.js            MAP_W/H, base, LV, LVI, W, resetMap
    map.js                fillR, slopeRun, line, tileAt, is*, solid*, rectFree, groundYAt
    player.js             mkPlayer, resetPlayer, move*, hang/climb/ladder/bars, damage
    step.js               step()
    game.js               фасад = бывший return {…} IIFE
  entities/
    items.js chests.js doors.js enemies.js fliers.js
    spiders.js torches.js lifts.js plats.js crumbs.js
    dark.js loot.js pickable.js gear.js
  levels/
    caves.js cliff.js waterfall.js halls.js crucible.js
    index.js              LEVELS, loadLevel
  render/
    ctx.js                canvas, VW/VH, rc, lb, cam, time
    palette.js            P
    poses.js              IDLE/RUN/HANG/…
    figure.js             drawHead, figure
    tiles.js              drawTile, drawLadder, chunkCache, tiles()
    sprites.js            враги/двери/сундуки/лифты/предметы
    hero.js
    light.js              lightSprite, lightPass, LIGHTS
    hud.js                hud, intro/pause/outro
    fx.js                 particles, water, fish, weeds, sky, fore
    camera.js
  audio/sfx.js            blip, liftSound
  input/input.js          held/latch, стик, клавиши
  editor/editor.js
  ui/menu.js
  app/loop.js             frame(), onEvent, start
```

## Контракт модулей

### `src/core/constants.js`
```js
export const T = 16;
export const E=0, ROCK=1, CRUMB=2, LADW=3, LADF=4, LADR=5, LADL=6, HTOP=7, BAR=8;
export const SLR=9, SLL=10, RNDA=11, RNDB=12, WATER=13, FALL=14;
export const C = { /* v19:689-704 дословно */ };
```

### `src/core/runtime.js`
```js
export const runtime = { MAP_W, MAP_H, base, LV, LVI, W };
export function resetMap(w, h) { /* как v19 */ }
export function setWorld(S) { runtime.W = S; }
```
Геттеры `MAP_W`/`MAP_H`/`base` в фасаде читают `runtime`.

### `src/core/map.js`
Экспорт: `fillR, slopeRun, line, tileAt, isSolidV, isSlopeV, isWaterV, isFlowV, isWetV, isHalfV, isBarV, isLadV, slopeTop, slopeSurfaceY, solidTile, ladderTile, ladderTop, solidAt, ladderAt, tileBlocks, waterSurfaceY, groundYAt, rectFree`.
`solidTile` читает `runtime.W` и вызывает `gateClosed` из `entities/lifts.js` — **поздняя связь**: `lifts.js` не импортирует `map.js` для `gateClosed`; `map.js` импортирует только `gateClosed` (функция не тянет map). Если цикл — положить `gateClosed` в `map.js` или `runtime.hooks.gateClosed`.

### `src/levels/*.js`
Каждый файл: `export const level = { id, name, pal, w, h, spawn, exit, build, items, … }`.
`build` зовёт `fillR`/`slopeRun`/`line` из `map.js`. Не дублировать хелперы.

### `src/core/game.js`
Собирает и реэкспортирует тот же API, что IIFE `return {…}` (v19:2505–2551). Рендер импортирует только отсюда: `import * as G from '../core/game.js'` или `import { GAME } from '../core/game.js'`.

## Пункты (параллель)

| ID | Владелец | Файлы (только свои) | Источник v19 | Статус |
|----|----------|---------------------|--------------|--------|
| A | scaffold | package.json, vite, index.html, styles.css, README, AGENTS | 1–93 | **done** |
| B | core | `src/core/{constants,runtime,map,player,step,game}.js` | 96–123, 681–2551 без LEVELS | **done** |
| C | levels | `src/levels/*` | 124–680 | **done** |
| D | entities | `src/entities/*` | 791–1565 + связанные mk/step | **done** |
| E | render | `src/render/*` | 2556–3900 без editor/input | **done** |
| F | app | input, editor, audio, ui/menu, app/loop, main.js | 3905–4610 + 4054–4220 | **done** |
| G | bugs | `tmp/bugs.md` + фиксы N1/N2/N3/N4/N5/N6/P1–P5/P7 | — | **done** |
| H | perf | `tmp/perf.md` + invalidate + try/finally ctx | — | **done** |

B/C/D пишут независимо из канона. F импортирует GAME + render. После всех — `npm run build`, проверка в браузере.

## Известные баги / узкие места (v19)

1. **chunkCache не инвалидируется** при правке тайла (редактор) и при `setTile`. После paint чанк старый. Фикс: `invalidateChunk(c,r)` + `invalidateAll()` на смене уровня.
2. **LIGHTS захардкожены** под уровень 1 (`[[15,21],…]`). На 2–5 бра висят не там. Фикс: `LV.lights || []`.
3. **AudioContext** создаётся в `blip` без `resume()` — на мобилках тишина до жеста; жест есть (стик), но resume не вызван.
4. **liftOsc** не стопается при паузе/меню — пила может течь.
5. **drawTile + смена `ctx`** в `chunkOf` (`ctx = g2`) — глобальный `ctx` на время билда чанка; если draw бросит — ctx останется чанковым.
6. **lightSprite** кэширует по строке цвета; `col.replace(/[\d.]+\)$/, '0.42)')` ломается на `rgba` без пробела / hex — сейчас цвета rgba, ок, но хрупко.
7. **Нет паузы на `visibilitychange`** — вкладка в фоне крутит физику через rAF (браузер душит, accumulator разъедется).
8. **IDs сущностей = индекс** (`id:S.items.length`) — после удаления/редактора индексы в событиях `pick:kind:i` разъедутся.
9. **Второй проход `tiles()`** каждый кадр рисует все CRUMB/WATER/FALL в кадре — ок для геймплея, но вода на большом озере (уровень 2) — горячий путь.
10. **SKY/fore пересоздают градиенты** лениво — ок; `foreLayer` со seed — каждый кадр много `rc`.
11. **`mkWorld(li)`**: `if (li !== undefined || !LV)` — повторный `mkWorld()` без аргумента не пересобирает карту (задумано). Редактор/reset должны звать `loadLevel` явно.
12. **Приоритет `hang && ledge || climb && ledge`** — работает из-за `&&` > `||`, но читать опасно; скобки при переносе обязательны.

В этом проходе обязательно: (1) invalidate чанков, (3) actx.resume на первом pointer/keydown, (7) пауза по hidden, (2) `LV.lights`. Остальное — заметки, не блокер.

## Критерий готовности

- [x] `npm run build` → один `dist/index.html` (126 kB)
- [x] Меню 5 уровней, старт, прыжок (`jump`/`land`), step без ошибок
- [x] Редактор `apply` + `invalidateChunk`; `setTile` хук
- [x] Консоль без ошибок (Vite 5188)
- [x] Канон `tmp/ledge-v19.html` на месте

## Пост-фикс

CHANGELOG, MemPalace wing=`the_ledge`, commit+push `origin/master`.
