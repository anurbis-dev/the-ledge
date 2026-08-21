# Редактор уровней the LEDGE

Документ синхронизирован с текущим кодом редактора в `src/editor/` и интеграцией в `src/app/loop.js`.

## 1. Быстрый старт

1. Запустите dev-сервер: `npm run dev`.
2. Откройте игру в браузере.
3. Переключение редактора: `Tab`.
4. Закрытие редактора: `Esc` или кнопка `Close`.

Что происходит при открытии:
- Игра остаётся в сцене, но включается `edit-mode` (скрываются HUD/стики).
- Текущий `viewScale` переключается на зум редактора.
- Открывается панель слоёв.

## 2. Панель редактора

Основная панель `#edbar` содержит вкладки:
- `Tiles`
- `Sprites` (`data-tab=sprite`)
- `Objects`
- `Params`
- `Intro`
- `Gear`
- `Mix`

Дополнительно:
- `New Level` создаёт пустой уровень через хук `onNewLevel`.
- `Del Level` удаляет текущий уровень через хук `onDelLevel` (последний удалить нельзя).
- `Undo` / `Redo` работают на стеке `src/editor/history.js` (карта + вода/spawn + черновики tileset/spriteset/objectset; правки панели Details тоже откатываются).
- `Geo` включает оверлей коллизий.
- `Cover` — режим помещений: рисует, как клетка выглядит снаружи (пока героиня не внутри). Это не декор: `cover` подменяет `tileAt` у скрытой комнаты.
- `Color` — рядом с Cover: перекраска клетки (hue / sat / brightness / contrast). Не Cover и не новый вариант тайла; с Cover взаимоисключается.
- `Bake` пишет полный снапшот в `src/core/defaults.js` через `POST /__bake` (включая кастом-тайлы).

Скролл `#edbar` / `.ed-pal`: полосы скрыты; СКМ-драг панорамирует содержимое как у float-окон (`bindMiddleScroll(edBar, edPal)`).

## 3. Управление (мышь + клавиши)

Глобально в редакторе:
- `Tab` открыть/закрыть редактор.
- `Esc` закрыть редактор.
- `Ctrl+Z` undo.
- `Ctrl+Y` или `Ctrl+Shift+Z` redo.
- `Ctrl+D` — дубль кисти палитры: на **Tiles** → новый кастом-тайл (+ сразу `migrateTilePicture` → spriteId); на **Sprites** → `cloneSpriteDef`; на **Objects** → новый custom kind (+ sprite: клон каталога или bake tile+sprite для процедурки — см. §6). Не map-sel.
- `Delete` / `Backspace` (без map-sel / без выбранного объекта): вкладка **Tiles** на кастом-сваче — `deleteCustomTileById` (см. §4); вкладка **Sprites** на custom — clear refs на tiles/objects/spawn → `removeSpriteDef` (см. §5).
- `G` включить/выключить Geo overlay.
- `0` сброс зума в `1:1`.

На канве:
- `LMB` рисование/постановка. В Color — пишет текущие слайдеры в grade клетки.
- `RMB` стирание тайлов и объектов в точке (включая `Door`/`Exit`/`Start`/lights/sounds/volumes/`FX Sand` и сущности палитры). `Door` — оба конца пары; `Start` — сброс на дефолт. В Color — сброс tint (тайл остаётся).
- `MMB` панорама камеры. На `#edbar` / `.ed-pal` — СКМ-драг панорамирует скролл панели (полосы скрыты).
- Колесо: зум `25/50/100/200/400%`. То же — `Ctrl + ПКМ-драг` на канве (вверх крупнее, якорь у курсора; при отпускании — ближайший шаг).
- `Ctrl + колесо` на вкладках `Tiles` / `Sprites` / `Objects`: размер иконок палитры. То же — `Ctrl + ПКМ-драг` по панели палитры (вверх крупнее).
- `Ctrl + LMB` без движения: пипетка (тайл/объект; если есть декорация — её). В Cover — только cover-тайл. В Color — grade клетки в слайдеры.
- `Ctrl + drag` на тайловом слое: рамка выделения. LMB внутри — перенос куска, Shift+LMB — копия, `Ctrl+C`/`Ctrl+V` — буфер, `Delete` стирает. `Esc` сначала снимает выделение.
- Даблклик по тайлу (палитра или канва): `#edTileEdit` в tile-mode — слот **Sprite** + collision/flags/params (Hit = красная рамка коллизии). **Paint только на вкладке Sprites** (`canPaint()` = sprite-mode); у тайла нет Paint / Re-import / Reset picture. Кадры — Edit / dblclick слота → `openSpriteEdit`, либо вкладка Sprites.
- Details (`#edTileEdit`): даблклик по свачу (Tiles / Sprites / Objects). Если окно уже открыто — **одиночный клик** (без движения) по свачу **переключает** цель; **клик-драг** кисть не меняет цель и годится для дропа на Sprite slot / кадр action. **Sprites**: даблклик → `openSpriteEdit`. **Objects** (вкл. Hero / Light / foes): всегда `openObjectEdit` — params + Sprite slot (не редирект в Paint); Edit / dblclick слота → `openSpriteEdit`. `Start` — slot → `spawn.spriteId`. Драг kind `sprite` → `{ spriteId }` на слот Tile/Object (`applySpriteSlotPayload` / `setTileSpriteId`) или на thumb кадра в sprite-mode (`applyFrameSlotPayload`). Каждая анимация — **одна строка кадров**; сепаратор тянется вниз. **Play** / Stop (~8 fps). У `enemy*` / `flier*` / `spider*` при открытии sprite-edit bake материализуется во все слоты.
- Драг-дроп PNG: на вкладке **Tiles** — `addTile` + сразу `migrateTilePicture` → spriteId; на **Sprites** — `addSpriteDef` (не `addTile`).
- `Alt + LMB` в Cover: штамп текущей карты в cover (`base` → `cover`; пустая клетка = лаз).
- Долгое нажатие LMB (примерно 450 мс): переход в стирание с протяжкой.

Работа с объектами под курсором:
- Если в точке несколько объектов, клик циклически переключает попадание.
- Drag объекта двигает его по клеткам.

## 4. Вкладка Tiles

Палитра — **кисти карты** (`ED_TILES` + `customSpecs()`): collision / flags / overlay. Картинка тайла может ссылаться на спрайт через `spriteId` (слот Sprite в Details); сами defs живут на вкладке **Sprites**.

Что можно рисовать:
- Базовые тайлы (`Empty`, `Stone`, `Crumb`, `Ladder`, `Water`, `Fall`, и др.).
- Склоны разных типов (45°, 2:1, дуги).
- Кастом-тайлы (id 64+).

Особенности:
- Повторный клик той же кистью по той же клетке у тайлов с `varN` переключает вариант (`Auto/1..N`).
- Для `Water` доступны пресеты оттенка воды.
- Для `Fall` в Details (`#edTileEdit` / `fillTileParamsOnly`) — слайдеры процедурных струй (`paintFallStrands`, фаза по world Y через столбец, два слоя нитей): **Speed** (0–200, 70); **Length** (0–100, 25) — светлая нить (ярче снизу → прозрачнее вверх); **Wave** (0–100, 15); **Random** (0–100, 35); **Offset** (0–100, 55) — рассинхрон; **Fade** (0–100, 0). Слой 2: **L2 Speed** (−100…100, −8) оффсет к Speed; **L2 Length** (0–100, 20); **L2 Density** (0–100, 50 → 1…8 нитей); **L2 Wave** (0–100, 20). **Foam** (0–100, 45) — амплитуда частой волновой шапки (`paintFallFoamWave`, не сплошная полоса); **Spray** (0–100, 55) — сила разлёта брызг разных размеров/направлений (`paintFallSpray`). Шапка на верхнем FALL; низ — если под тайлом `Water`. Meta: `tileGfx[14].speed` / `length` / `wave` / `random` / `offset` / `fade` / `speed2` / `length2` / `density2` / `wave2` / `foam` / `spray`.
- Для `Water` в Details — **Shift** (−100…100, дефолт 100 = канон вправо; 0 = стоячая база): общий дрейф реки; **Wave X** (0–100, дефолт 50): амплитуда гребня/bob; **Splash** (0–100, дефолт 80): сила ряби от входа/выхода героя. `Fall` гасит только travel рядом и даёт **расходящиеся** гребни + бурление (`fallChurnAt`); слои ph2/ph3 с разной фазой. Meta: `tileGfx[13].shift` / `waveX` / `splash`.
- Если в клетке уже вода, повторный клик водой меняет только shade.
- `Color` не `varN` и не Cover: тот же тайл, другой grade на клетке.
- Overlay-тайлы (зелёная точка на сваче) пишутся в канал `deco` поверх `base`. Коллизия остаётся у основного тайла. RMB сначала стирает декор, потом грунт.
- Details (`#edTileEdit`, `fillTileParamsOnly`): слот **Sprite** + collision/flags/params only. Дроп `{ spriteId }` → `setTileSpriteId` (custom → `tile.spriteId`, builtin → `tileGfx.spriteId`). Clear / Edit / dblclick слота → `openSpriteEdit`. Нет Paint / Re-import / Reset picture — пиксели только на **Sprites**. Resolve: `getTileSpriteId` / `tileFrameSrc` / `tileImage` берут idle (или первый anim) спрайта; иначе legacy `src`/`frames`. Boot/`Ctrl+D`/PNG-drop мигрируют picture → sprite (`migrateTilePicture`). Thumbs: `tileThumb` учитывает `spriteId`.
- Кастом-тайл: даблклик → Sprite slot + overlay / front / climb / one-way / collision (Hit / Collision → Custom box). `Ctrl+D` клонирует тайл и мигрирует picture → spriteId.
- Удаление кастом-тайла: `Delete`/`Backspace` при кисти на кастом-сваче (без map-sel / без выбранного объекта) или кнопка **Delete** в `#edTileEdit` → `deleteCustomTileById`. Скан всех уровней (`findLevelsUsingTile`: live layers текущего + `_stash` остальных). Если id где-то есть — confirm со списком `name (count)`; затем `wipeTileIdEverywhere` (base/deco/cover/stamp/stampDeco + paired vary) → `removeTile` → `flushAllLevelsStore`. Встроенные id не удаляются.

Ограничения:
- Если активный слой не тайловый (`sky/ridge/fore/pollen`), тайловая кисть не рисует.
- Если слой locked, рисование блокируется.

Перекраска (Color):
- Кнопка `Color` рядом с Cover (`#edColor`, режим `ED.color`). С Cover взаимоисключается.
- Extra-бар: `Hue` / `Sat` / `Bright` / `Contrast` + `Reset` (identity: hue 0, sat 1, bright 0, contrast 1). Кисть по умолчанию — bright 0.15, чтобы первый мазок был виден.
- `LMB` intern текущих слайдеров в `grades[]` (append-only, индекс 1..255) и пишет `L.tint` (0 = нет). Wrap-слои — `stampTint`.
- `RMB` или identity-слайдеры пишут 0 — tint сбрасывается, тайл не стирается.
- `Ctrl+click` (пипетка) грузит grade клетки в слайдеры.
- Overlay в режиме Color подсвечивает клетки с grade.
- Copy / move / paste выделения копирует grade по значению и intern на вставке. Стирание тайла (`setTile` 0) чистит tint.

Помещения (Cover):
- Кнопка `Cover` переключает кисть на буфер «снаружи». Канва показывает, как комнату видит игрок с поверхности; правда карты не затирается.
- Связная область cover-клеток = одна комната. Героиня внутри (ноги на клетке) — видны настоящие тайлы; вышла — снова cover. Переключение по времени `ROOM_FADE` (Params → World).
- `Empty` в Cover = лаз (снаружи дыра, клетка всё ещё в комнате). `RMB` убирает клетку из комнаты.
- Типичный цикл: нарисовать грунт → Cover + `Alt+драг` по будущей пещере → выйти из Cover и вырезать тоннели → Empty-кистью проставить лаз.
- Cover только на collide-слое без Repeat.

## 5. Вкладка Sprites

Палитра = `listSpriteDefs()` (builtins + customs, `src/core/spriteset.js` / `ledge.dev.sprites`). Thumbs: `spriteThumb`. **Единственное место Paint** (`canPaint()` = sprite-mode): пиксели, Re-import, Reset frame, якоря.

- Каталог `SPRITE_DEFS`: персонажи (hero / enemy* / flier* / spider* / npc_*) **и** placeable object icons (coin, chest, door, torch, gear, markers, ropes/plats/lift, …). Персонажи без авто-bake иконок; icon-каталог при boot получает dirty idle через `ensureCatalogIconFrames` (`migrate-graphics.js` → `paintObjIcon` / `bakeSpriteFrameSrc`).
- Даблклик свача → `openSpriteEdit` (кадры / якоря в `#edTileEdit`).
- Драг kind `sprite` → payload `{ spriteId }` на Tile/Object **Sprite** slot или на thumb кадра action (в sprite-mode).
- Drop PNG на вкладку → `addSpriteDef` (не `addTile`); широкий шит → idle frames.
- `Ctrl+D` → `cloneSpriteDef` («… copy»), открывает клон.
- `Delete` / `Backspace` на **custom**: confirm → `clearSpriteRefs` (tiles / tileGfx / objects / spawn→`hero`) → `removeSpriteDef`. Builtins не удаляются.
- Hint в палитре: «Atlases — soon» (API атласов пока нет).

## 6. Вкладка Objects

Палитра = placeable `ED_OBJS` (`BUILTIN_OBJS` + customs из `ledge.dev.objects`). Каталог спрайтов — вкладка **Sprites**; Objects открывают params Details / place (кадры — через Sprite slot → Edit).

Палитра включает:
- `Hero` (`kind: 'hero'`) — не placeable; Details = params + Sprite slot (`hero`); кадры — Edit / dblclick слота → `openSpriteEdit`.
- `Start` (`kind: 'player_start'`) — spawn уровня; Details: sprite slot → `spawn.spriteId` → `activeHeroId()`.
- `Exit` (`kind: 'level_exit'`) — переход уровня (несколько на карту).
- `Door` (`kind: 'door'`) — парная дверь (warp между двумя точками).
- Враги/птицы/пауки/щупальца — Details = params + Sprite slot; кадры через Edit / Sprites (не авто-Paint).
- Предметы и лут.
- Сундуки (`Chest`, `Locked`).
- `Sound`, `Light`, `Volume` — Light: params + Sprite slot (по умолчанию `lantern`); Edit → кадры фонаря.
- `FX Sand` (`kind: 'fx_sand'`) — непрерывный песчаный эмиттер (`LV.emitters` / `S.emitters`, `mkEmitterAt`); role `marker`. Постановка сразу выбирает объект и открывает Inspect/гизмо `move` (позиция = `x,y`). Форма спавна: `shape` point|square|circle|line (`EMIT_SHAPES`), `shapeSize` (px: сторона / диаметр / длина), `shapeAngle` (deg, только line); `stepEmitters` → `sampleEmitterPoint` → `emitSand`. Те же частицы, что у CRUMB (`SAND_DEF`).
- `Boulder`.
- `Rope V` (`kind: 'rope_v'`) / `Rope H` (`kind: 'rope_h'`) — вертикальный / горизонтальный канат (`LV.ropes`). Постановка `mkRopeAt`; гизмо: handles `a`/`b` + move span; клик → `#edRopeSettings` (H: Length+ 0=длина=span, сдвиг добавляет px; Segments; Elasticity 0..1 с кривой ^2.6; Swing force только V; Wind; Climb; Grab). Play: V — лёгкий wobble при хвате, ↑↓ после отпускания захвата, тап L/R; H — bars, ↓ отцеп. В Play канат сталкивается с solid-тайлами (новых контролов в редакторе нет). Persist `packRope` (`lengthExtra`/`length` для H). Role `marker`.
- `Plat H` (`kind: 'plat_h'`) / `Plat V` (`kind: 'plat_v'`) — движущаяся платформа (`LV.plats` / `S.plats`, `mkPlatAt`; `vert` из kind). Role `marker`. Постановка сразу выбирает объект и открывает Inspect; гизмо `move` (сдвиг всего пути) + ручки `platA`/`platB` (концы A=min / B=max). Persist `packPlat`. History `OBJ_KEYS` включает `plats`.
- `Lift` (`kind: 'lift'`) — лифт по этажам (`LV.lifts` / `S.lifts`, `mkLiftAt` + `syncLiftFloors` / `buildGates`). Role `marker`. Постановка сразу выбирает объект и открывает Inspect; гизмо `move` + ручки `liftFloor` по `floors[]`. Persist `packLift`. History включает `lifts`. Call-кнопки на этажах работают только при `trigger==='call'`.
- NPC (`Hermit`, `Wanderer`) — Details = params + Sprite slot; кадры через Edit.
- Custom kinds (после `Ctrl+D`) — в конце палитры.

### Details (`#edTileEdit`)

- Открывается **даблкликом** по любому Objects-свачу → всегда `openObjectEdit` (не редирект в Paint). Если окно уже открыто — **одиночный клик** переключает цель (то же для Tiles / Sprites).
- Всегда params: Name / Type(role) / Sprite slot (+ hint). Пиксельный холст **не** в object-mode.
- Edit / dblclick слота → `openSpriteEdit` (кадры/якоря; `keepObject` сохраняет шапку объекта).
- **Sprite slot**: предпочтительно дроп с вкладки **Sprites** (`{ spriteId }` → `applySpriteSlotPayload`). Objects-свач со своим spriteId тоже даёт `{ spriteId }`. Слот **не** создаёт sprite из Tiles `tileSrc` / `makeTile` (только готовый `spriteId`). Frame-replace — только в sprite-mode (`applyFrameSlotPayload`). Менять slot у **customs** и `Start`; прочие builtins — сначала `Ctrl+D`. У custom — Clear снимает `spriteId`. После assign — `clearThumbCache` + `fillPal`.

### Role / Type

- Роли: `actor` | `pickup` | `loot` | `prop` | `marker` (`objectset.ROLES`). У custom — селект Type в Details; у builtins — inferred (`builtinRole`: coin/gem/…=`pickup`, key/gear=`loot`, foes/NPC/Start=`actor`, chest/boulder/light=`prop`, Exit/Door/Sound/Volume/FX Sand/Rope V/Rope H/Plat H/Plat V/Lift=`marker`, …).
- Влияет на постановку: `loot`/`pickup` — drag на сундук/врага/птицу; `loot` only — не ставится как мировой объект (только содержимое).

### Ctrl+D (Objects)

- Клонирует кисть в новый custom kind (`cloneObjectFrom` → `ledge.dev.objects`).
- **Каталожный** sprite (`enemy`/`hero`/…) — `cloneSpriteDef` + bake пустых кадров **только в клон** (каталожные id не трогает).
- **Процедурный** kind без dirty idle0 — bake иконки → `addTile` (name "… icon", collide none) + `addSpriteDef` с idle0 dataURL; custom-оригинал без своей картинки тоже получает `spriteId`.
- `builtinSpriteId` смотрит только каталог `SPRITE_DEFS` — у custom sprite `kind` не ставить template вроде `coin`, иначе засорит lookup.
- Клон `Hero` → sprite `family: 'hero'`. У `Start` sprite slot пишет `LV.spawn.spriteId` (playable через `activeHeroId`).
- Свачи палитры: `objThumb(palKind, size, spriteId, paintKind)` всегда отдаёт **новый** canvas (иначе Coin и Coin copy делят DOM); кэш по palKind+spriteId; dirty idle0 перекрывает процедурную `paintObjIcon`.

### Редактор спрайтов (Sprites tab / Edit со слота)

- Каталог и импорт PNG / Paint — вкладка **Sprites**; из Objects/Tiles Details — только через Edit / dblclick Sprite slot → `openSpriteEdit` (тот же `#edTileEdit` в sprite-mode).
- Каждая анимация — своя строка кадров; сепаратор увеличивает высоту. `+` / драг-reorder / Play·Stop. У врагов/птиц/пауков открытие материализует bake во все слоты. Клик по кадру — пиксели. Красная коробка — хитбокс (Box / Hit); origin верх-лево; Hands золотой; weapon пурпурный. Reset anchors / Reset frame. Size — `fw×fh`. Origin/box/Hands → Bake `BAKED.sprites`; кадры → `ledge.dev.sprites`.
- Сущности (items / enemies / fliers / npcs) могут нести `spriteId` при постановке — draw/persist.

### Логика постановки

- `Start`: строго один на уровень — повтор **переносит** `LV.spawn` (верх-лево idle-box активного героя). `spawn.spriteId` задаёт playable sprite/box. Маркер в гизмо. `Delete` → дефолт пустого уровня (`16`, `6*T−22`). Persist — `packLevel.spawn`. `Hero` на карту не ставится.
- `Exit`: несколько точек в `LV.exits: [{id,x,y,toId}]` (миграция со старого `LV.exit`; blank → `exits:[]`). Маркер в гизмо; `Delete` убирает выбранный. Persist — `packLevel.exits` (+ legacy `exit` = первый).
- `Door`: всегда пара — **2 клика** (`mkDoorAt`); первый ждёт return (`doorPending`), второй связывает `pair` по id. `Esc` отменяет первый (удаляет pending). `Delete` / `RMB` снимают **оба** конца пары. В гизмо: общий цвет/бейдж номера пары + линия между концами (ярче при выборе). Поля `need` / `consume` / `locked=!!need` пишутся в persist.
- Антидубль: нельзя поставить второй экземпляр **того же** template/kind в ту же клетку. Разные kind в одной клетке — можно. Start — один (повтор = перенос).
- Для `Sound/Light/Volume/FX Sand/Plat H/Plat V/Lift` сразу выбирается объект и открывается Inspect/гизмо.
- Для `pickup`/`loot` drag на сундук/врага/птицу открывает окно количества (`1..99`).
- Builtin loot-only (и custom role=`loot`): только содержимое лута — `key`, `helmet`, `shield`, `sword`, `scuba`, `flippers`, `harpoon`, `bow`.

## 7. Слои

Панель `#edLayers`:
- `👁` скрыть/показать.
- `Ctrl+клик по 👁` — solo-режим слоя.
- `🔒` блокировка рисования.
- `+ / -` добавить и удалить слой.
- Drag строки меняет порядок (с подсветкой слота).
- DblClick по имени — rename.

Параметры слоя:
- `Parallax X/Y`.
- `Hue/Saturation/Brightness`.
- Для `tiles`: `Collision layer`, `Repeat`, `Stamp W/H`.
- Для процедурных слоёв (`sky/ridge/fore/pollen`) доступны профильные параметры генерации.

Важно:
- Герой и мир-объекты «живут» на collide-слое; в solo другого слоя они скрываются.
- У collision-слоя parallax всегда фиксируется в `1/1`.

## 8. Плавающие окна

Плавающие окна: Layers, Inspect, Chest Loot, NPC Talk, Boulder Settings, Rope Settings (`#edRopeSettings`), Tile.

Управление:
- Drag за шапку.
- Drag `RMB` по окну тоже двигает.
- Полосы прокрутки нет.
- `MMB`-драг по контенту — панорама (ближайший overflow, в т.ч. строки кадров).
- Колесо крутит тот же контент (на горизонтальной строке кадров — вбок).
- SE-уголок меняет размер.

Позиция и размер сохраняются в `localStorage` ключ `ledge.ed.float`.

## 9. Inspect и гизмо (Start / Exit / Door / Sound / Light / Volume / FX Sand / Plat / Lift)

Выбор:
- Клик по объекту (включая маркеры `Start` / `Exit` / `Door` / `FX Sand` / `Plat` / `Lift`).
- Для overlapping-объектов клик циклически перебирает попадание.

Изменение:
- Через поля/слайдеры в `Inspect`.
- `Start`: заметка в Inspect («один на уровень»); позиция — гизмо `move` / повторная кисть; playable sprite — `LV.spawn.spriteId`.
- `Exit`: слот **Target level** (`toId` = id уровня в `LEVELS`); пусто = `(none / MENU)` — на CONTINUE уходит в меню (`finishLevel` / `resolveExitNext`). Несколько выходов; `tryExit` читает `LV.exits`.
- `Door`: **Required item** (bag kind или none); при выбранном предмете — **Consume item on activate** (`consume`, дефолт true). `locked = !!need`; значения синкаются на пару. Позиция — гизмо `move`.
- Light: `Color` / `Intensity` / `Radius` / `Sprite` (какой спрайт висит в точке света; `Lantern` — факел по умолчанию, без PNG рисуется процедурный; `None` — только свечение). Постановка Light сразу ставит факел (`sprite:'lantern'`).
- `FX Sand`: `Shape` (point|square|circle|line); `Shape size` если не point; `Shape angle` если line; далее `Density` / `Speed` / `Speed rand` / `Color` / `Life` / `Life rand` / `Gravity` / `Size` (px зерна) / `Spread` / `Drag` / `Lift` (дефолты `SAND_EMIT_DEF`: shape=point, shapeSize=16, shapeAngle=0). Гизмо: `move` + контур формы при выборе + ручка `emitSize` (resize; у line ещё angle). Persist `packEmitter` (+ dump emitters) с shape/shapeSize/shapeAngle.
- `Plat H` / `Plat V`: `Width` / `Height` / `Speed` / `Pause A` / `Pause B`; `Travel` (`pingpong`|`oneway`); `Loop` (`infinite`|`once`); `Trigger` (`auto`|`ride`); `On leave` (`continue`|`return`|`stop`). Гизмо: `move` + `platA`/`platB`. Persist `packPlat` (`PLAT_DEF`).
- `Lift`: `Width` / `Cabin H` / `Speed` / `Dwell` (пусто → `C.LIFT_V` / `C.LIFT_DWELL`); `Travel` (`pingpong`|`oneway`); `Loop` (`infinite`|`once`); `Trigger` (`call`|`auto`|`ride`); `On leave` (`stay`|`return`); `Home floor` + кнопки `+ Floor` / `− Floor` (минимум 2 этажа). Гизмо: `move` + `liftFloor`. Persist `packLift` (`LIFT_DEF`).
- Через гизмо на канве:
- `move`
- `radius` (для света и sound falloff)
- `rotate`, `scaleX`, `scaleY` (для volume)
- `platA` / `platB` (концы платформы)
- `liftFloor` (этажи лифта)
- `emitSize` (размер/угол формы FX Sand)

Удаление выбранного special-объекта:
- Клавиша `Delete` (`Start` не удаляется — сброс `LV.spawn` на дефолт; `Door` — оба конца пары).

## 10. NPC Talk

Открытие:
- Клик по NPC.

Возможности:
- Выбор пресета дерева.
- Настройка голоса.
- Выбор стартовой ноды (`First`).
- Переходы `Met again` и `Already told`.
- Добавление/удаление нод.
- Редактирование текста ноды, флагов, выдачи предметов, переходов.

Закрытие:
- Кнопка `×` или клик вне окна.

## 11. Boulder Settings

Открытие:
- Клик по валуну.

Параметры:
- `Push speed`
- `Friction`
- `Max roll speed`

Значения пишутся в объект валуна и попадают в persist.

## 12. Params / Intro / Gear / Mix

`Params`:
- Живые слайдеры констант `C` (persist `ledge.dev.C`, bake через snapshot params).
- Поиск по параметрам.
- `Backspace` на наведённом контроле сбрасывает к дефолту.
- `Reset all` сбрасывает все параметры к заводским.
- Группа `Camera` (`src/render/camera.js`): `CAM_DZ_X/Y` (мёртвая зона якоря, 10×8), `CAM_FOLLOW` (резина, выше = резче, 6.5), `CAM_SNAP` (липнет при Δ≤snap, 1px — без pixel crawl на стопе), `CAM_SUBPX` (0/1, дефолт 1 — мир `floor(cam)` на буфере 321×181, доля CSS `translate` `#c` в `#view` шагом экрана; HUD на `#h` без сдвига; 0 и редактор — старый `Math.round(cam)`), `CAM_LEAD` / `CAM_LEAD_IDLE` / `CAM_LEAD_V` / `CAM_LEAD_K` (взгляд вперёд), `CAM_LOOK_DN` / `CAM_LOOK_UP` / `CAM_LOOK_V` / `CAM_LOOK_K` (↑↓ стоя).
- Группа `Fall / Damage`: `SAFE` / `HURT` (без переката), `ROLL_HURT` / `ROLL_HURT_T` (dir-roll на приземлении всё ещё даёт 1 урон выше порога; stun при этом).

`Intro`:
- Поле `This level` = индивидуальная фраза уровня (`LV.intro`).
- Секция `Pool` = глобальный пул фраз (`ledge.dev.intro`).
- Пустое поле уровня означает выбор случайной фразы из пула.

`Gear`:
- Прочность оружия на уровень (`LV.gearDurability`).
- `0` означает unbreakable.

`Mix`:
- Выбор трека.
- Play/Pause/Stop.
- Перемотка по времени и по секциям.
- Микширование по каналам (mute/solo/wave/volume).

## 13. Сохранение, persist, bake

Автосохранение:
- Любая правка уровня помечает dirty.
- Через debounce изменения пишутся в `localStorage` (`ledge.dev.levels`).
- Параллельно триггерится bake-запрос к Vite (`/__bake`) для обновления `src/core/defaults.js`.

Что сохраняется:
- Геометрия и слои.
- Объекты мира редактора.
- Вода и её shade.
- Intro/Gear/Mix/Params (через соответствующие snapshot-части).
- Спрайт-якоря и коробка действия (`BAKED.sprites`: origin / grab / box / size; без PNG-кадров).

Ручной bake:
- Кнопка `Bake` запускает full dump.
- Если live-запись не удалась, редактор предлагает JSON-файл `ledge-bake.json`.

## 14. Практические сценарии (как собрать игровые ситуации)

### Сценарий 1: Закрытый сундук с редким лутом

1. Вкладка `Objects` → поставьте `Locked` сундук.
2. Перетащите нужные loot-иконки на сундук.
3. В окне лута задайте количество.
4. Для сундука с несколькими лут-позициями включите `Random — drop only one`.

### Сценарий 2: Засада у узкого прохода

1. В `Tiles` соберите узкий тоннель/щель (склоны и half-тайлы).
2. На входе поставьте врага (`Foe`) и сверху паука/щупальце.
3. На уровне слоя проверьте, что коллизия в нужном collide-слое.
4. Протестируйте проход в игре и поправьте через `Undo/Redo`.

### Сценарий 3: Подводный карман с градацией глубины

1. В `Tiles` нарисуйте воду.
2. Повторным рисованием `Water` примените нужный shade preset.
3. Поставьте `Tank`/`Scuba`/`Flippers` перед длинным участком.
4. Добавьте `Light` для читаемости глубокой зоны.

### Сценарий 4: Секретная пещера под грунтом

1. Нарисуйте поверхность как обычно (камень, склоны).
2. Включите `Cover`, зажмите `Alt` и закрасьте будущую пещеру — cover снимет копию грунта.
3. Выключите `Cover`, вырежьте тоннели и комнату в обычном Draw.
4. Снова `Cover`, кисть `Empty` — проставьте лаз (дыру, которую видно снаружи).
5. Закройте редактор: с поверхности пещеры не видно; спуск в лаз открывает её, выход закрывает.

### Сценарий 5: Аудио-зона и локальный свет

1. Поставьте `Sound` в точку интереса.
2. В `Inspect` задайте `Mode` (`flat` или `falloff`), `Radius`, `Freq`.
3. Поставьте `Light` рядом и отрегулируйте `Intensity/Radius/Color`.
4. Протяните гизмо радиуса для быстрого подбора охвата.

### Сценарий 6: Зона пост-обработки через Volume

1. Поставьте `Volume`.
2. Гизмо растяните рамку (`scaleX/scaleY`) и поверните (`rot`).
3. В `Inspect` выберите `Mask` и коррекцию (`Hue/Sat/Brightness/Contrast/Tint`).
4. Проверьте переход при входе/выходе игрока из зоны.

### Сценарий 7: NPC с ветвлением и наградой

1. Поставьте `Hermit` или `Wanderer`.
2. Клик по NPC → откройте `NPC Talk`.
3. Настройте `First`, `Met again`, `Already told`.
4. В нужной ноде задайте `grant` (например `key` или `relic`).
5. Проверьте диалог в рантайме.

### Сценарий 8: Тест баланса оружия под уровень

1. Откройте вкладку `Gear`.
2. Поставьте durability для `stick/spear/sword/blade/bow/harpoon`.
3. Для экспериментального уровня поставьте `0` (unbreakable), затем снижайте до целевых значений.

## 15. Что сейчас не покрыто UI редактора

На уровне persist ещё лежат `dark`, `stick`, `key` без отдельных кистей Objects / Inspect.

`lifts` / `plats` — уже в палитре (`Plat H` / `Plat V` / `Lift`) + Inspect/гизмо. `Exit` / `Door` — тоже Objects + Inspect.
