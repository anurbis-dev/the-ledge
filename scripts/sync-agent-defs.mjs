/**
 * Generate harness-specific subagent defs from shared sources in agents/*.md.
 *
 * Single source of truth for prompt body + description.
 * Claude Code → .claude/agents/*.md  (tools + model)
 * Grok Build  → .grok/agents/*.md    (prompt_mode / permission_mode / agents_md)
 *
 * Usage: node scripts/sync-agent-defs.mjs
 *        npm run sync:agents
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "agents");
const claudeDir = path.join(root, ".claude", "agents");
const grokDir = path.join(root, ".grok", "agents");

function parseShared(raw, file) {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new Error(`${file}: must start with YAML frontmatter ---`);
  }
  const end = raw.indexOf("\n---", 3);
  if (end < 0) throw new Error(`${file}: missing closing ---`);
  const fmBlock = raw.slice(4, end).replace(/\r/g, "");
  const body = raw.slice(end + 4).replace(/^[\r\n]+/, "");

  /** @type {Record<string, string>} */
  const fm = {};
  for (const line of fmBlock.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) throw new Error(`${file}: bad frontmatter line: ${line}`);
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    fm[m[1]] = v;
  }

  for (const key of ["name", "description", "claude_tools", "claude_model", "grok_permission_mode"]) {
    if (!fm[key]) throw new Error(`${file}: missing required key "${key}"`);
  }

  return {
    name: fm.name,
    description: fm.description,
    claudeTools: fm.claude_tools,
    claudeModel: fm.claude_model,
    grokPermissionMode: fm.grok_permission_mode,
    body,
  };
}

function yamlEscapeDouble(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderClaude(a) {
  return [
    "---",
    `name: ${a.name}`,
    `description: "${yamlEscapeDouble(a.description)}"`,
    `tools: ${a.claudeTools}`,
    `model: ${a.claudeModel}`,
    "---",
    "",
    a.body.replace(/\s+$/, "") + "\n",
  ].join("\n");
}

function renderGrok(a) {
  // Fold long description for readability (Grok style)
  const descLines = a.description.match(/.{1,88}(\s|$)/g) || [a.description];
  const folded = descLines
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .map((l, i) => (i === 0 ? l : `  ${l}`))
    .join("\n");
  return [
    "---",
    `name: ${a.name}`,
    "description: >",
    `  ${folded}`,
    "prompt_mode: full",
    "model: inherit",
    `permission_mode: ${a.grokPermissionMode}`,
    "agents_md: true",
    "---",
    "",
    a.body.replace(/\s+$/, "") + "\n",
  ].join("\n");
}

function main() {
  if (!fs.existsSync(srcDir)) {
    console.error("Missing agents/ directory");
    process.exit(1);
  }
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(grokDir, { recursive: true });

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  if (!files.length) {
    console.error("No agent sources in agents/");
    process.exit(1);
  }

  const names = new Set();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(srcDir, file), "utf8");
    const a = parseShared(raw, file);
    names.add(a.name);
    const outName = `${a.name}.md`;
    fs.writeFileSync(path.join(claudeDir, outName), renderClaude(a), "utf8");
    fs.writeFileSync(path.join(grokDir, outName), renderGrok(a), "utf8");
    console.log(`synced ${a.name}`);
  }

  // Drop stale generated agents not present in agents/
  for (const dir of [claudeDir, grokDir]) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
      const base = f.replace(/\.md$/, "");
      if (!names.has(base)) {
        fs.unlinkSync(path.join(dir, f));
        console.log(`removed stale ${path.relative(root, path.join(dir, f))}`);
      }
    }
  }

  console.log(`OK — ${names.size} agent(s) → .claude/agents + .grok/agents`);
}

main();
