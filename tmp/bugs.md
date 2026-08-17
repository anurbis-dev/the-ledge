# Bugs — ledge-v19 (канон)

Источник: `tmp/ledge-v19.html`. Только дефекты. BugHunter 2026-08-17.

Серьёзность: **blocker** краш; **high** ломает геймплей; **med** край; **low** редко.

## Таблица

| id | где | симптом | sev | фикс |
|----|-----|---------|-----|------|
| P1 | setTile 2514; chunkOf; hardReset 4365 | setTile/loadLevel/hardReset не чистят кэш чанков | high | invalidateChunk в setTile + invalidateAll в loadLevel/hardReset/applyPal |
| P2 | LIGHTS 2785 | бра только уровня 1 | high | LV.lights \|\| [] |
| P3 | blip 3907 | AudioContext без resume | med | resume на первом pointer/keydown |
| P4 | liftSound + frame early return | пила течёт в паузе/меню | med | liftSound(false) при pause/menu/hidden |
| P5 | chunkOf ctx=g2 | throw оставляет ctx чанковым | med | try/finally |
| P6 | lightSprite regex | хрупкий парсинг альфы | low | парсить явно |
| P7 | нет visibilitychange | фон крутит физику | med | pause на hidden |
| P8 | id=length + erase | p.torch указывает не туда | high | стабильный id; чистить p.torch |
| N1 | resetPlayer / lightAt | смерть с факелом: held липнет, тьма светится | high | в resetPlayer снять held |
| N2 | dropTorch без t | erase факела → TypeError, rAF мёртв | blocker | if (!t) { p.torch=-1; return } |
| N3 | hardReset без applyPal | R: физика новая, картинка старая | high | invalidateAll в hardReset |
| N4 | drawTile LADR как SLL | скос рисуется в другую сторону | high | up = SLR\|\|LADR; LADR через drawLadder |
| N5 | keydown R | в textarea экспорта R сбрасывает мир | high | игнор если target input/textarea |
| N6 | stepWater hp-=1 | укус рыбы в обход damage | high | damage(S,1,0.25) |
| N7 | doors[w.to] | id как индекс, нет guard | med | искать по id |
| N8 | finishLevel ур.5 | outro съедается меню | med | showMenu после outro |
| N9 | buildWater AABB | рыбы через все лужи карты | med | связная лужа |
| N10 | roll inp.x===0 | перекат влево | med | facing от vx |
| N11 | wading fall | брод не гасит падение | med | inWater \|\| wading |
| N12 | mkEnemyAt y-14 | толстый враг в полу | low | смещение -h |
| N13 | ур.2 spiders [21,20]×2 | дубль паука | low | убрать |
| N14 | autoLadder diag | мёртвая ветка | low | удалить |
| N15 | onEvent null | хрупко после erase | low | guards |
| N16 | p.lock=9 | нет air control после WJ | low | таймер |

## В этой ревизии обязательно

N2, N1, P1/N3, P2, P3, P4, P7, P5, N5. Остальное — заметки.
