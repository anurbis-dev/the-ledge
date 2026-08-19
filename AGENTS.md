# the LEDGE — agent instructions

> Канонические правила проекта для **Grok Build**, Claude Code и других агентов.
> Claude Code: короткий указатель в `CLAUDE.md` → этот файл. **Править только здесь.**
>
> Ориентация: `Context_map.md`. Источник правды по геймплею: `tmp/ledge-v19.html`,
> пока модули не стабилизированы. Если память и код расходятся — верить текущему коду.

## Memory-first workflow

- Treat MemPalace as the primary context source for project architecture, systems, and decisions — not the built-in per-session auto-memory.
- At the start of a session involving this project, call MemPalace MCP tools first: `mempalace_search` scoped to `wing=the_ledge`, then `mempalace_get_drawer` / traverse for exact context. **Skip for trivial tasks** (typo fix, config-only change, "what does X mean" — no code change needed).
- `mempalace_search` returns verbatim full drawer content — always bound calls: `limit=3` (raise only if the first pass misses), `max_distance≈0.8` (tighter than the 1.5 default), add `room` filter alongside `wing` whenever the room is known, keep `query` to bare keywords (no restated task text). Prefer a narrow `search` first, then `mempalace_get_drawer` by ID.
- Do not ask to re-read project markdown files when MemPalace already covers the topic.
- Read repository files only for verification, code edits, or when memory coverage is missing.
- If memory and code conflict, prefer current code and report the conflict explicitly.
- After resolving a task, persist newly discovered stable facts back to MemPalace (`mempalace_add_drawer` / `mempalace_update_drawer` and optional `mempalace_kg_add`) instead of (or in addition to) the local auto-memory files.

### MemPalace self-healing workflow

- If MemPalace MCP is online but retrieval looks empty/stale/noisy after recent mining, self-heal before asking the user.
- Run `mempalace_reconnect` first to refresh in-memory index state.
- Re-run a narrow `mempalace_search` query in `wing=the_ledge` to verify recovery.
- If still stale, verify MCP and CLI use the same palace path (`E:\AI_tools\mempalace-palace`).
- If path is correct but data is still stale, restart the MemPalace MCP server and retry search.
- Only after these steps, report the issue briefly and continue with repository evidence as fallback.
- If MemPalace is temporarily unavailable, fall back to the local auto-memory files and repository evidence.

## Стек

Vanilla JS ES6 + Vite + `vite-plugin-singlefile`. Сборка = один `dist/index.html`. Без TS, без фреймворков.

## Правила кода

- Геймплей 1:1 с каноном, пока план явно не просит фикс.
- Фасад `src/core/game.js` = бывший объект `GAME`. Рендер/ввод/редактор импортируют только его.
- Изменяемое состояние карты/мира — `src/core/runtime.js`, не прятать новые глобалы.
- Циклы импорта рвать через `runtime` / поздние хуки, не через дубли функций.
- Комментарии короткие, по-русски если уже так в файле.
- Не плодить markdown без запроса. Не drive-by рефакторить соседние модули.

## Post-fix mandatory steps

After completing any code fix or feature implementation, always execute these steps in order before reporting done:

1. **Update docs** — tier by change scope:
   - **Minor fix** (isolated JS change, no new API or behavior contract): directly append 1-line entry to `docs/CHANGELOG.md` only. Do not spawn DocCodeSync.
   - **Behavioral / API change** (new feature, changed contract, new module): run `DocCodeSync` subagent to sync `docs/`, `Context_map.md`, and `docs/CHANGELOG.md`. Editor UX → also `docs/EDITOR_GUIDE.md`.
   - **`docs/CHANGELOG.md` stays unreleased-only**: it must contain only entries not yet in a git commit. At the moment of `git commit` touching `docs/CHANGELOG.md`, before committing, move everything already committed (i.e. the pre-commit `HEAD` content of the file) into `docs/CHANGELOG_ARCHIVE.md` (prepend, keep newest-first) and leave `CHANGELOG.md` holding only the new entries from this commit. Never let `CHANGELOG.md` re-accumulate multiple releases' worth of history — full history lives in `CHANGELOG_ARCHIVE.md` / `git log`.
2. **Update MemPalace** — persist any stable architectural facts, design decisions, or newly discovered patterns via `mempalace_add_drawer` / `mempalace_update_drawer` and `mempalace_kg_add` if relevant.
3. **Update local auto-memory** — only for always-on behavioral triggers (e.g., response language). Everything else goes to MemPalace, not local files.
4. **Browser verification** — confirm the fix via `chrome-devtools` MCP (`evaluate_script` on `GAME` / canvas, `list_console_messages` for errors). Only then declare the task complete. Docs/rules-only → skip browser.
5. **Commit + push** — agent does this himself (see Git below). Do not ask the user.

Do not skip these steps even for "small" fixes — consistency is what keeps docs and memory trustworthy over time.

## Git, version, commit, push

**Single source of truth = `package.json` `version`** (SemVer). Агент **сам** коммитит и пушит `origin` / текущую ветку. Не просить пользователя. Не force-push.

### SemVer + channel

Format: `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-CHANNEL.N`.

| Channel | Meaning |
|---------|---------|
| *(none)* | Stable / release |
| `dev` | Active development (default for WIP commits) |
| `alpha` | Early public preview |
| `beta` | Feature-complete, still polishing |
| `rc` | Release candidate |

### Перед каждым коммитом

1. Run status/diff/log; draft message from the diff.
2. **Bump version** before commit (required — hook blocks otherwise):
   - `npm run bump:patch` — bugfix / small isolated change
   - `npm run bump:minor` — feature / behavioral change
   - `npm run bump:major` — breaking / large architectural milestone
   - `npm run bump:dev` — WIP / intermediate (preferred while unfinished): `…-dev.N`
   - `npm run bump:alpha` / `bump:beta` / `bump:rc` / `bump:release`
   - Choice is judgment from the **diff scope**; hook only checks that version **changed** vs HEAD.
3. If `docs/CHANGELOG.md` is in the commit: archive pre-commit `HEAD` content into `docs/CHANGELOG_ARCHIVE.md` (prepend), leave only this commit’s new bullets in `CHANGELOG.md`.
4. Stage relevant files including `package.json` (and CHANGELOG pair if touched). Do not commit secrets.
5. Commit with a clear message. Prefer no `Co-Authored-By` unless the user wants it.
6. Push: `git push -u origin HEAD` on a new branch; never force-push `main`/`master` unless explicitly requested.
7. After push, report branch + remote URL + version.

Default remote: `origin` → `https://github.com/anurbis-dev/the-ledge.git`.

### Enforcement

- Claude Code / compatible harness: `.claude/settings.json` → PreToolUse on `git commit*` runs `scripts/check-version-bump-hook.mjs`.
- Scripts: `scripts/bump-version.mjs`, `npm run bump:patch|minor|major|dev|alpha|beta|rc|release`.

## Iteration loop mode

Triggered only by explicit user phrases: "сделай в лупе", "используй луп", "луп эту ошибку", "loop this". Not the default workflow — regular tasks use a single pass.

- Use only when the task has an **objectively checkable** success criterion (reproducible bug, failing test, clear acceptance criteria). If the ask is exploratory/ambiguous, say so instead of looping.
- Cap at **6 iterations**. If criteria aren't met by then, stop, report remaining gaps, and ask how to proceed.
- Each iteration: PLAN (next single step) → EXECUTE → CHECK → DECISION.
- **CHECK must be objective, never self-graded prose scores.** Use whichever applies: actual test run, `chrome-devtools` verification tier with real console/state output, or an independent subagent (CodeMaster/BugHunter) reviewing the diff. A pass/fail per criterion, not a 1-10 vibe rating.
- DECISION: all criteria pass → stop and report `FINAL`. Otherwise `ITERATING`, fix the single worst-failing criterion next, continue.
- Run **Post-fix mandatory steps** once after the loop ends (`FINAL`), not on every iteration.
- No mid-loop clarifying questions unless genuinely blocked.

## Response style

- Отвечать на русском языке.
- Только суть: без вступлений, вежливости, «отличный вопрос», «как видно из».
- Не пересказывать вопрос и не анонсировать что сейчас будет сделано — сразу результат.
- Ссылки на код: `ClassName.method` или `file:line` — без описания что делает функция, если не просят.
- Куски кода «было → стало» в чат не отправлять если не просят явно. Изменение: `file:line — что и почему (если не очевидно)`.
- Одно предложение на факт/действие. Без воды.
- Do not ask the user to save/update memory manually — handle via MemPalace when a stable fact is discovered.
- **Режим максимальной экономии токенов**: любой промежуточный статус — 2-4 слова, не полное предложение. Это касается текста между tool call’ами и описаний в TodoWrite.

## Dev server

Параллельные агент-сессии и соседние проекты (PixisEditor) дерутся за `:5173`. Порт не хардкодить. `strictPort` не включать. `--port 5173` не форсить.

1. Сначала проверить: слушает ли уже `vite` с cwd **этого** репо. Если да — открыть его фактический URL, новый не поднимать.
2. Если нет — `npm run dev`. Vite сам берёт свободный порт (5173, 5174, …). URL только из stdout (`Local: http://localhost:NNNN/`), не угадывать.
3. Вывод редиректить в `.dev-server.<port>.log` (не в общий `.dev-server.log`) — не дописывать/не перезаписывать чужой лог.
4. **Zombie-check** перед стартом: зависшие процессы **от прошлых запусков этой же сессии**. Серверы других сессий и других проектов не трогать. Гасить чужой PID — только по явной просьбе.
5. Сервер, который подняла **эта** сессия, после проверки убить (pid / task), если пользователь не попросил оставить. Не плодить хвосты на 5174/5175/….

## Browser verification (chrome-devtools MCP)

- Глобального `editor` нет. Состояние — фасад `GAME` (`src/core/game.js`) и хуки `window.__state` / `__start` / `__menu` / `__skip` / `__screens` / `__game` / `__editor`. Перед `evaluate_script` сверять актуальный экспорт; при необходимости `await import('/src/core/game.js')` в контексте страницы dev-сервера.
- If `chrome-devtools` MCP is unavailable this session, say so explicitly and fall back to static code review.

### Правильный workflow подключения к браузеру

1. Сначала `list_pages` — увидеть уже открытые вкладки.
2. Если игра открыта → `select_page` по ID, затем `evaluate_script`. **Не вызывай `navigate_page` если страница уже есть.**
3. Если страницы нет — открыть URL **своего** Vite (см. Dev server), не `:5173` по умолчанию.
4. После тестов не чистить страницу ради следующего агента.

### Verification tier — choose the lightest tier that covers the change

| Tier | Change type | Steps |
|------|-------------|-------|
| **Skip** | Docs / CHANGELOG / config / agent rules only | No browser check needed |
| **Lightweight** | Logic / JS fix, no UI change | `evaluate_script` state check → `list_console_messages` (errors only) |
| **Standard** | Behavior change with interaction | `evaluate_script` → trigger interaction → `list_console_messages` |
| **Full** | UI layout / visual / render change | Exercise the feature end-to-end as a user would; hunt regressions on shared surfaces. `evaluate_script`/`list_console_messages` always. Screenshots only if needed to confirm a visual bug, not to judge “looks right”. |

**Rules:**
- Start with `evaluate_script` on `GAME` / canvas — cheaper than navigating and clicking.
- Only `navigate_page` if a specific page state cannot be set via script.
- `list_network_requests` only for asset load issues.
- Re-check `list_console_messages` *after* interaction.

## Session & token hygiene

- `/compact` mid-task when debug noise is spent; `/new` for unrelated new tasks.
- `chrome-devtools` MCP is expensive — skip if session is non-UI.
- `list_console_messages` / network lists are cumulative — call right after the interaction, not spam.

### Token budget (max economy) — ranked by cost

1. **chrome-devtools** — #1 cost. Call only when verification tier needs it. Prefer one `evaluate_script` over click-paths. `list_console_messages` with errors-only and small `pageSize` when enough. Don't re-`list_pages` every step if page already selected.
2. **MemPalace** — session start: **one** narrow `search` (`limit=3`, `max_distance≈0.8`, keywords). No `status` / `list_wings` / `get_taxonomy` as default wake-up. Don't widen `limit` before a second targeted query. After task: one small `add_drawer`/`update_drawer` for stable facts. Skip MemPalace entirely on trivial tasks.
3. **Repo reads** — prefer `grep`/path-known `read` with `offset`/`limit` on big files. Don't load full `docs/CHANGELOG.md`, `CHANGELOG_ARCHIVE.md`, or whole `tmp/ledge-v19.html` unless the task is about them. `Context_map.md` — only if MemPalace miss. Don't re-read a file unchanged since last read in the same task.
4. **Shell** — no unbounded dumps (`git log -p`, full build logs). Prefer short flags (`git log -5 --oneline`, `git diff --stat` then targeted paths).
5. **Subagents** — spawn only when parallel isolation saves parent context (review, multi-file research) or for Coder with a fixed plan. Never spawn for a 1-file 5-line edit. Prompt = minimal: paths, contract, no pasted file bodies if child can read. Parent does **not** re-read every file the child already reported. Don't run CodeMaster+BugHunter+browser all three when one check answers the question.
6. **Writes / docs** — CHANGELOG: one line per change. DocCodeSync only for behavioral/API scope. No new markdown files unless asked. No drive-by refactors.
7. **Chat output** — intermediate: 2–4 words. Final: proportional to task. Never echo tool payloads, full diffs, or large JSON unless user asked.
8. **TodoWrite** — only multi-step (≥3) work; short item text; no status essays.
9. **Session shape** — one task per session when possible; switch topic → `/new`. After heavy browser/debug → `/compact` before the next feature.
10. **Default bias** — if two approaches work, pick the one with fewer tool calls and smaller results. Static read of 1–2 files beats spinning MCP. Ask the user only when blocked.

### Token accounting & auto-tune

Harness **does not** expose billed prompt/completion tokens in session files. We use a **proxy audit** over Grok session logs (`~/.grok/sessions/.../chat_history.jsonl` + `events.jsonl`).

**Script:** `npm run token-audit` (or `node scripts/token-audit.mjs`)
- Latest session for this cwd by default; `--session <id|path>`, `--json`, reports in `tmp/token-audit/`.
- Metrics: tool_result size proxy (chars/4), re-reads, piecemeal offset/limit reads, MemPalace wake bloat, chrome/shell spam, huge listings, user-prompt smells.
- Outputs: `waste_score`, findings, **agent_corrections**, **user_recommendations**, `auto_tune.next_session_bias` tags.

**When to run (agent):**
1. After a **heavy** task (many tools / browser / long exploration) — once before final reply.
2. After **~8–10 user turns** in one session, or when you notice thrashing (same file read 3+, search loops).
3. When user says «аудит токенов», «token audit», «почему так дорого».
4. **Not** on trivial 1-shot answers.

**Self-correct (agent) after audit:**
- Apply `agent_corrections` for the **rest of this session** without waiting for user.
- If `waste_score ≥ 40` or any `severity: high` finding: mention **1–3 lines** in the final reply (score + top fix). Full markdown report path is enough.
- Persist recurring high findings to MemPalace `wing=the_ledge` `room=token_budget` (one short drawer, not every run).

**Recommend to user (only if prompt/workflow is a root cause):**
- If findings include `user_prompt_*` codes — put **user_recommendations** in the reply (short bullets).
- If waste is **agent-only** — fix silently + optional one-line self-note.

**Auto-tune bias tags** (from report → remember for session):
| tag | behavior |
|-----|----------|
| `prefer_full_read_once` | one full read > N offset slices when most of file needed |
| `browser_tier_strict` | enforce lightest tier; errors-only console |
| `mempalace_search_only` | no status/list_wings on wake |
| `shell_batch` | fewer/shell-shorter commands |
| `prompt_user_for_scope_if_blocked` | one clarifying Q only if blocked |

**Honest limit:** proxy ≠ billing. Directional only.

## Specialist subagents

| Agent | Role |
|-------|------|
| **CodeMaster** | code review / architecture |
| **BugHunter** | crashes, races, leaks, edge cases |
| **PerformanceOptimizer** | canvas / rAF / entity-step performance |
| **DocCodeSync** | docs only (`docs/`, `Context_map.md`, CHANGELOG) |
| **TestGenerator** | manual / `evaluate_script` QA checklists |
| **Coder** | implement detailed plan only (no design) |

- **Shared SoT:** `agents/*.md` (body + description + harness meta). **Do not hand-edit** generated copies.
- After editing `agents/*`: `npm run sync:agents` → writes `.claude/agents/*.md` and `.grok/agents/*.md`.
- **Grok Build:** loads `.grok/agents/*.md` — `spawn_subagent` with `subagent_type` = name.
- **Claude Code:** loads `.claude/agents/*.md`.
- Main session rules: only **`AGENTS.md`** (Claude pointer: `CLAUDE.md`). No per-model rule forks.

Before delegating, reuse MemPalace context from session start. Persist subagent findings back to MemPalace after the task.

### Coder (cheap-model implementer) — orchestrator responsibilities

- Main session = orchestrator/planner first; prefer **Coder** only with a detailed file/line-level plan.
- Never delegate to Coder without exact files, contracts, and named patterns — escalate if underspecified.
- Good: mechanical edits, 1:1 patterns, CodeMaster/BugHunter-specified fixes.
- Bad: new architecture, ambiguous scope, gameplay rewrite, >~2–3 files without per-file plan.
- Verify Coder output like any other implementation (CodeMaster/BugHunter / browser tier as needed).
