# Shared subagent definitions

**Edit files here only.** Do not hand-edit `.claude/agents/*.md` or `.grok/agents/*.md` — they are generated.

```bash
npm run sync:agents
```

## Source format (`agents/<Name>.md`)

```markdown
---
name: CodeMaster
description: "Use when: … One-line (or long) trigger description."
claude_tools: Read, Grep, Glob
claude_model: sonnet
grok_permission_mode: plan
---

Prompt body (shared by Claude Code and Grok Build)…
```

| Key | Meaning |
|-----|---------|
| `name` | Agent id / filename |
| `description` | Spawn trigger text (both harnesses) |
| `claude_tools` | Claude Code tool allowlist |
| `claude_model` | Claude Code model (`sonnet` / `haiku`) |
| `grok_permission_mode` | Grok: `plan` (read-only) or `default` (can edit) |

Grok always gets `prompt_mode: full`, `model: inherit`, `agents_md: true`.

Main session rules live in root **`AGENTS.md`** (not here). `CLAUDE.md` is only a pointer to that file.
