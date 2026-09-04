#!/usr/bin/env node
// SessionStart hook: injects AGENTS.md hard constraints into every session's
// context directly (hookSpecificOutput.additionalContext), so compliance
// doesn't depend on the model choosing to Read AGENTS.md first.
const ctx = [
  'AGENTS.md — единственный источник правил проекта the-ledge, прочитать целиком перед нетривиальной задачей (пропустить можно только для typo/config-фикса).',
  'Часто нарушаемые жёсткие правила (полный текст — в AGENTS.md):',
  '1. Отвечать ТОЛЬКО на русском (чат и файлы плана), без переключений на английский — это не обсуждается.',
  '2. Перед нетривиальной задачей — mempalace_search (wing=the_ledge, limit=3, max_distance≈0.8), не только чтение файлов репозитория.',
  '3. Локальная auto-memory — только для always-on поведенческих триггеров (например, язык ответа); всё остальное (архитектурные факты, находки багов) — в MemPalace.',
  '4. Не пушить в git без явной просьбы пользователя; локальный коммит агент делает сам после Post-fix mandatory steps.',
  '5. Свой Vite dev-сервер на сессию (не шарить чужой), гасить свой PID и вкладку после проверки.',
  '6. После агентских правок в agents/*.md — сразу npm run sync:agents.'
].join('\n');
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: ctx
  }
}));
