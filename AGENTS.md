# the LEDGE — agent instructions

Канон для Grok Build / Claude / других агентов. Ориентация: `Context_map.md`.

Источник правды по геймплею: `tmp/ledge-v19.html`, пока модули не стабилизированы. Если память и код расходятся — верить текущему коду.

## Memory

- MemPalace wing: `the_ledge`. Старт сессии: `mempalace_search` wing=`the_ledge`, `limit=3`, `max_distance≈0.8`.
- После задачи: `mempalace_add_drawer` / `mempalace_update_drawer` для стабильных фактов.

## Стек

Vanilla JS ES6 + Vite + `vite-plugin-singlefile`. Сборка = один `dist/index.html`. Без TS, без фреймворков.

## Правила кода

- Геймплей 1:1 с каноном, пока план явно не просит фикс.
- Фасад `src/core/game.js` = бывший объект `GAME`. Рендер/ввод/редактор импортируют только его.
- Изменяемое состояние карты/мира — `src/core/runtime.js`, не прятать новые глобалы.
- Циклы импорта рвать через `runtime` / поздние хуки, не через дубли функций.
- Комментарии короткие, по-русски если уже так в файле.

## Git + version

- `package.json` `version` — единственный источник. Перед коммитом bump: `npm run bump:dev` (WIP) / `patch` / `minor` / `major`.
- Агент коммитит и пушит `origin` / текущую ветку сам. Не просить пользователя.
- Не force-push.

## Dev server

Параллельные агент-сессии и соседние проекты (PixisEditor) дерутся за `:5173`. Порт не хардкодить.

1. Сначала проверить: слушает ли уже `vite` с cwd этого репо. Если да — открыть его фактический URL, новый не поднимать.
2. Если нет — `npm run dev`. Vite сам берёт свободный порт (5173, 5174, …). URL только из stdout (`Local: http://localhost:NNNN/`), не угадывать.
3. `strictPort` не включать. `--port 5173` не форсить.
4. Сервер, который подняла **эта** сессия, после проверки убить (pid / task). Чужие `vite` и другие проекты не трогать.
5. Не оставлять хвосты: не плодить процессы на 5174/5175/… на каждую сессию.

## Post-fix

1. Минорный фикс → строка в `docs/CHANGELOG.md`. API/поведение → синк `docs/` + `Context_map.md`.
2. `CHANGELOG.md` только unreleased. При коммите старое → `docs/CHANGELOG_ARCHIVE.md`.
3. MemPalace.
4. Браузер: URL своего Vite (см. Dev server), не `:5173` по умолчанию. Глобали нет `editor` — проверять canvas/`GAME` через evaluate.
5. Commit + push.
