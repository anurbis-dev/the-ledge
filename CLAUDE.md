# Claude / Grok — the LEDGE

**Единый источник правил: [`AGENTS.md`](./AGENTS.md).**

Claude Code подхватывает этот файл; Grok Build — `AGENTS.md` (и при наличии короткий `CLAUDE.md`).
Правила (MemPalace, post-fix, стиль, git/version, browser, subagents) **править только в `AGENTS.md`**.
Субагенты: **SoT** [`agents/`](./agents/) → `npm run sync:agents` (не править `.claude/agents` / `.grok/agents` вручную).
В начале сессии / если harness не вложил `AGENTS.md` — прочитай его и следуй полностью.

Карта: `Context_map.md`. Канон геймплея: `tmp/ledge-v19.html`. Геймплей не переписывать без явной задачи.
Dev-сервер: свободный порт, после проверки убить свой. Не хардкодить `:5173`.
