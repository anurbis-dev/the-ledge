# Changelog (unreleased)

- Редактор Objects: `Exit` (`level_exit`) — несколько `LV.exits[{id,x,y,toId}]` (миграция с `LV.exit`; blank → `[]`); Inspect Target level (пусто = MENU); `tryExit` / `finishLevel` → индекс `LEVELS` или меню; persist `exits`.
- Редактор Objects: `Door` — пара за 2 клика (`mkDoorAt`, Esc отменяет первый, Delete снимает оба); Inspect: required bag item + consume-on-activate (`locked=!!need`); persist `need`/`consume`.
