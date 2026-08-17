# Context map — the LEDGE

Пиксельный платформер 320×180, тайл 16px. Канон: `tmp/ledge-v19.html`.

## Точки входа

- `index.html` — DOM (canvas `#c`, меню, стик, кнопки, редактор)
- `src/main.js` — bootstrap
- `src/core/game.js` — фасад симуляции (бывший IIFE `GAME`)
- `src/app/loop.js` — rAF, камера, пауза, меню

## Ядро

| Модуль | Суть |
|--------|------|
| `core/constants.js` | `T=16`, ids тайлов, физика `C` |
| `core/runtime.js` | `MAP_W/H`, `base` Uint8Array, `LV`, `W` |
| `core/map.js` | запросы тайлов, скосы, `rectFree` |
| `core/player.js` | хват кромки, лаз, лестницы, перекладины, вода |
| `core/step.js` | один тик мира |
| `levels/` | 5 карт, `build()` пишет в `base` |
| `entities/` | mk/step врагов, лифтов, факелов, сундуков |

## Рендер

Процедурные пиксели (`rc`/`lb`), кэш чанков 8×8. Свет — offscreen multiply. Позы героя — скелетные ключи.

## Ввод

Клавиши + виртуальный стик слева (`#stick`) + ✋/⤒ справа. Редактор — нижняя панель `#edbar`.

## Не путать

- `D:\TMP\AI_games\levelDesigner` — редактор уровней, не эта игра.
- `D:\TMP\AI_games\Ledge_game` — старый экспорт проекта редактора.
- Порт в редактор (`LEDGE_PORT_PLAN`) — отдельная линия, этот репо автономный.
