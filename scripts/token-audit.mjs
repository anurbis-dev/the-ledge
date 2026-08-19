#!/usr/bin/env node
/**
 * Token-budget audit for Grok Build sessions (proxy metrics — harness does not
 * expose prompt/completion token counts in session files).
 *
 * Usage:
 *   node scripts/token-audit.mjs
 *   node scripts/token-audit.mjs --session <id|path>
 *   node scripts/token-audit.mjs --cwd d:\TMP\AI_games\the-ledge
 *   node scripts/token-audit.mjs --json
 *
 * Heuristics detect waste patterns (re-reads, piecemeal context, MCP bloat)
 * and emit agent self-corrections + user prompt recommendations.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_PER_TOKEN = 4; // rough proxy

function parseArgs(argv) {
  const out = { session: null, cwd: process.cwd(), json: false, write: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--no-write") out.write = false;
    else if (a === "--session") out.session = argv[++i];
    else if (a === "--cwd") out.cwd = path.resolve(argv[++i]);
    else if (a === "-h" || a === "--help") {
      console.log(`Usage: node scripts/token-audit.mjs [--session id|path] [--cwd dir] [--json] [--no-write]`);
      process.exit(0);
    }
  }
  return out;
}

function encodeCwdForGrokSessions(cwd) {
  // Grok: d:\PixisEditor → d%3A%5CPixisEditor (drive letter lowercased)
  let abs = path.resolve(cwd);
  abs = abs.replace(/^([A-Za-z]):/, (_, d) => `${d.toLowerCase()}:`);
  return abs.replace(/\\/g, "%5C").replace(/\//g, "%5C").replace(/:/g, "%3A");
}

function sameCwd(a, b) {
  const na = path.resolve(a || "").replace(/\\/g, "/").toLowerCase();
  const nb = path.resolve(b || "").replace(/\\/g, "/").toLowerCase();
  return na === nb;
}

function collectSessionDirs(dir, cwd, out, depth = 0) {
  if (!dir || !fs.existsSync(dir) || depth > 2) return;
  const chatPath = path.join(dir, "chat_history.jsonl");
  if (fs.existsSync(chatPath)) {
    const summaryPath = path.join(dir, "summary.json");
    let mtime = fs.statSync(chatPath).mtimeMs;
    let summary = null;
    if (fs.existsSync(summaryPath)) {
      try {
        summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        mtime = Date.parse(summary.last_active_at || summary.updated_at || 0) || mtime;
      } catch {}
    }
    if (summary?.info?.cwd && !sameCwd(summary.info.cwd, cwd)) return;
    out.push({ id: path.basename(dir), path: dir, mtime, summary });
    return;
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === "mcp" || e.name.startsWith(".")) continue;
    collectSessionDirs(path.join(dir, e.name), cwd, out, depth + 1);
  }
}

function resolveSession(opts) {
  const home = process.env.GROK_HOME || path.join(os.homedir(), ".grok");
  const homeSessions = path.join(home, "sessions");

  if (opts.session) {
    if (fs.existsSync(opts.session) && fs.statSync(opts.session).isDirectory()) {
      return {
        id: path.basename(opts.session),
        path: opts.session,
        summary: readJson(path.join(opts.session, "summary.json")),
      };
    }
    const encoded = encodeCwdForGrokSessions(opts.cwd);
    const candidates = [
      path.join(homeSessions, encoded, opts.session),
      path.join(homeSessions, opts.session),
    ];
    for (const direct of candidates) {
      if (fs.existsSync(path.join(direct, "chat_history.jsonl"))) {
        return { id: opts.session, path: direct, summary: readJson(path.join(direct, "summary.json")) };
      }
    }
    throw new Error(`Session not found: ${opts.session}`);
  }

  const dirs = [];
  const encoded = encodeCwdForGrokSessions(opts.cwd);
  const projectRoot = path.join(homeSessions, encoded);
  if (fs.existsSync(projectRoot)) collectSessionDirs(projectRoot, opts.cwd, dirs);
  if (dirs.length === 0 && fs.existsSync(homeSessions)) {
    collectSessionDirs(homeSessions, opts.cwd, dirs);
  }
  dirs.sort((a, b) => b.mtime - a.mtime);
  if (dirs.length === 0) {
    throw new Error(
      `No Grok sessions found for cwd=${opts.cwd} (looked under ${projectRoot})`
    );
  }
  return dirs[0];
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function approxTokens(chars) {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function safeParseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: String(raw) };
  }
}

function normalizePath(p) {
  if (!p || typeof p !== "string") return null;
  return p.replace(/\\/g, "/").toLowerCase();
}

function analyze(session) {
  const chat = readJsonl(path.join(session.path, "chat_history.jsonl"));
  const events = readJsonl(path.join(session.path, "events.jsonl"));

  const toolCalls = []; // {name, args, id}
  const toolResults = []; // {id, name?, chars, content preview}
  const userMessages = [];
  const assistantTexts = [];

  const callIdToName = new Map();

  for (const row of chat) {
    if (row.type === "user") {
      const text = extractText(row.content);
      if (text && !text.includes("<system-reminder") && !text.includes("<user_info>")) {
        // keep real-ish user turns; still count system-reminder bulk separately
      }
      userMessages.push({
        chars: text.length,
        tokens: approxTokens(text.length),
        isMeta: /<user_info>|<git_status>|<system-reminder>/.test(text),
        preview: text.slice(0, 200).replace(/\s+/g, " "),
      });
    }
    if (row.type === "assistant") {
      const text = extractText(row.content);
      if (text) assistantTexts.push({ chars: text.length, tokens: approxTokens(text.length) });
      if (Array.isArray(row.tool_calls)) {
        for (const tc of row.tool_calls) {
          const args = safeParseArgs(tc.arguments);
          callIdToName.set(tc.id, tc.name);
          toolCalls.push({ id: tc.id, name: tc.name, args, argChars: JSON.stringify(args).length });
        }
      }
    }
    if (row.type === "tool_result") {
      const content = typeof row.content === "string" ? row.content : JSON.stringify(row.content ?? "");
      const name = callIdToName.get(row.tool_call_id) || "unknown";
      toolResults.push({
        id: row.tool_call_id,
        name,
        chars: content.length,
        tokens: approxTokens(content.length),
      });
    }
  }

  // tool aggregates
  const byTool = {};
  for (const r of toolResults) {
    if (!byTool[r.name]) byTool[r.name] = { calls: 0, resultChars: 0, resultTokens: 0 };
    byTool[r.name].calls += 1;
    byTool[r.name].resultChars += r.chars;
    byTool[r.name].resultTokens += r.tokens;
  }
  for (const c of toolCalls) {
    if (!byTool[c.name]) byTool[c.name] = { calls: 0, resultChars: 0, resultTokens: 0 };
  }

  // file read patterns
  const readsByFile = new Map();
  for (const c of toolCalls) {
    if (c.name !== "read_file" && c.name !== "Read") continue;
    const fp = normalizePath(c.args.target_file || c.args.path || c.args.file);
    if (!fp) continue;
    if (!readsByFile.has(fp)) readsByFile.set(fp, []);
    readsByFile.get(fp).push({
      offset: c.args.offset ?? null,
      limit: c.args.limit ?? null,
      argChars: c.argChars,
    });
  }

  const findings = [];

  // re-reads
  for (const [fp, reads] of readsByFile) {
    if (reads.length >= 3) {
      findings.push({
        severity: "high",
        code: "reread_hot_file",
        file: fp,
        detail: `${reads.length}× read_file on same path`,
        agent_fix: "Cache path content after first read; re-read only after edit.",
        user_hint: null,
      });
    } else if (reads.length === 2) {
      findings.push({
        severity: "medium",
        code: "reread_file",
        file: fp,
        detail: `2× read_file on ${fp}`,
        agent_fix: "Avoid second full read unless file was modified.",
        user_hint: null,
      });
    }
    // piecemeal: multiple offset/limit slices without a full read
    const partials = reads.filter((r) => r.offset != null || r.limit != null);
    const fulls = reads.filter((r) => r.offset == null && r.limit == null);
    if (partials.length >= 2 && fulls.length === 0) {
      findings.push({
        severity: "high",
        code: "piecemeal_read",
        file: fp,
        detail: `${partials.length} partial reads (offset/limit), no single full read`,
        agent_fix: "If >50% of file needed, one full read is cheaper than N slices (each pays tool+prefix overhead).",
        user_hint: null,
      });
    }
  }

  // mempalace wake waste
  const mpStatus = (byTool.mempalace_status?.calls || 0) + (byTool["mempalace__mempalace_status"]?.calls || 0);
  const mpWings = (byTool.mempalace_list_wings?.calls || 0) + (byTool["mempalace__mempalace_list_wings"]?.calls || 0);
  const mpTax = (byTool.mempalace_get_taxonomy?.calls || 0);
  // also use_tool with mempalace
  const useToolMp = toolCalls.filter((c) => c.name === "use_tool" && /mempalace/i.test(JSON.stringify(c.args)));
  const mpSearch = toolCalls.filter(
    (c) =>
      c.name === "mempalace_search" ||
      (c.name === "use_tool" && /mempalace_search|mempalace__mempalace_search/i.test(JSON.stringify(c.args)))
  );
  if (mpStatus + mpWings + mpTax >= 2) {
    findings.push({
      severity: "medium",
      code: "mempalace_wake_bloat",
      detail: `status/wings/taxonomy calls=${mpStatus + mpWings + mpTax}; prefer one narrow search`,
      agent_fix: "Wake-up: one mempalace_search wing=the_ledge limit=3 max_distance=0.8. Skip status/list_wings.",
      user_hint: null,
    });
  }

  // chrome / mcp heavy
  const chromeish = Object.entries(byTool).filter(([n]) => /chrome|devtools|screenshot|snapshot|heapsnapshot|performance_/i.test(n));
  const chromeCalls = chromeish.reduce((s, [, v]) => s + v.calls, 0);
  const chromeTokens = chromeish.reduce((s, [, v]) => s + v.resultTokens, 0);
  if (chromeCalls >= 8 || chromeTokens > 15000) {
    findings.push({
      severity: "high",
      code: "chrome_heavy",
      detail: `chrome/devtools-related calls≈${chromeCalls}, ~${chromeTokens} result-tokens proxy`,
      agent_fix: "Use lightest verification tier; errors-only console; one evaluate_script; no screenshot.",
      user_hint: "If task is docs/rules only, say so — agent should skip browser entirely.",
    });
  }

  // shell spam
  const shell = byTool.run_terminal_command || byTool.Bash || { calls: 0, resultTokens: 0 };
  if (shell.calls >= 25) {
    findings.push({
      severity: "medium",
      code: "shell_spam",
      detail: `${shell.calls} shell calls, ~${shell.resultTokens} result-tokens proxy`,
      agent_fix: "Batch checks; prefer git status/diff --stat; avoid re-running same command.",
      user_hint: null,
    });
  }

  // list_dir on node_modules / huge trees (from args)
  const hugeLists = toolCalls.filter((c) => {
    if (c.name !== "list_dir" && c.name !== "run_terminal_command") return false;
    const s = JSON.stringify(c.args);
    return /node_modules|Get-ChildItem.*-Recurse/i.test(s);
  });
  if (hugeLists.length) {
    findings.push({
      severity: "high",
      code: "huge_listing",
      detail: `${hugeLists.length} listing(s) risking node_modules/recursive dumps`,
      agent_fix: "Never list node_modules; narrow path + depth.",
      user_hint: null,
    });
  }

  // user prompt quality (non-meta user messages)
  const realUsers = userMessages.filter((m) => !m.isMeta && m.chars > 0);
  for (const m of realUsers) {
    if (m.chars > 4000) {
      findings.push({
        severity: "high",
        code: "user_prompt_huge",
        detail: `User message ~${m.tokens} tok proxy: "${m.preview}…"`,
        agent_fix: "Summarize task internally; don't re-quote user wall of text.",
        user_hint: "Split mega-prompts; attach only paths needed; one goal per message.",
      });
    }
    // multi-goal: many sentences with и/also/также + multiple verbs
    const goals = (m.preview.match(/[.!?]| и | also |также|плюс |заодно /gi) || []).length;
    if (m.chars > 200 && goals >= 4) {
      findings.push({
        severity: "medium",
        code: "user_prompt_multi_goal",
        detail: `Possibly multi-goal user turn (~${m.tokens} tok): "${m.preview.slice(0, 120)}…"`,
        agent_fix: "Execute goals sequentially; compact between goals if long.",
        user_hint: "One primary ask per message reduces thrash and re-exploration.",
      });
    }
    // vague exploration
    if (/посмотри|разберись|как там|что с |исследуй всё|пройдись/i.test(m.preview) && m.chars < 80) {
      findings.push({
        severity: "medium",
        code: "user_prompt_vague",
        detail: `Vague short prompt: "${m.preview}"`,
        agent_fix: "Ask 1 clarifying Q only if blocked; else MemPalace+Context_map first, not full-tree walk.",
        user_hint: "Name file/feature/acceptance criteria — open exploration burns tokens on search.",
      });
    }
  }

  // total proxy
  const totalResultTokens = toolResults.reduce((s, r) => s + r.tokens, 0);
  const totalAssistantTokens = assistantTexts.reduce((s, a) => s + a.tokens, 0);
  const totalUserTokens = userMessages.reduce((s, u) => s + u.tokens, 0);
  // chat file size as upper bound
  const chatBytes = fs.existsSync(path.join(session.path, "chat_history.jsonl"))
    ? fs.statSync(path.join(session.path, "chat_history.jsonl")).size
    : 0;

  const turnCount = events.filter((e) => e.type === "turn_started").length || realUsers.length;
  const toolStartCount = events.filter((e) => e.type === "tool_started").length;

  // score 0-100 waste (higher = worse)
  let waste = 0;
  for (const f of findings) {
    waste += f.severity === "high" ? 12 : f.severity === "medium" ? 6 : 2;
  }
  waste = Math.min(100, waste);

  const topTools = Object.entries(byTool)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.resultTokens - a.resultTokens)
    .slice(0, 12);

  const agentCorrections = [...new Set(findings.map((f) => f.agent_fix).filter(Boolean))];
  const userRecommendations = [...new Set(findings.map((f) => f.user_hint).filter(Boolean))];

  return {
    session_id: session.id,
    session_path: session.path,
    model: session.summary?.current_model_id || null,
    turns: turnCount,
    tool_starts_events: toolStartCount,
    proxy: {
      note: "Not API billing tokens. chars/4 over tool_results + message texts in chat_history.",
      tool_result_tokens: totalResultTokens,
      assistant_text_tokens: totalAssistantTokens,
      user_text_tokens: totalUserTokens,
      chat_history_bytes: chatBytes,
      chat_history_tokens_proxy: approxTokens(chatBytes),
    },
    top_tools_by_result_tokens: topTools,
    waste_score: waste,
    findings,
    agent_corrections: agentCorrections,
    user_recommendations: userRecommendations,
    auto_tune: {
      apply_now: agentCorrections.slice(0, 5),
      next_session_bias: buildBias(findings),
    },
  };
}

function buildBias(findings) {
  const codes = new Set(findings.map((f) => f.code));
  const bias = [];
  if (codes.has("piecemeal_read") || codes.has("reread_hot_file")) {
    bias.push("prefer_full_read_once");
  }
  if (codes.has("chrome_heavy")) bias.push("browser_tier_strict");
  if (codes.has("mempalace_wake_bloat")) bias.push("mempalace_search_only");
  if (codes.has("shell_spam")) bias.push("shell_batch");
  if (codes.has("user_prompt_vague") || codes.has("user_prompt_multi_goal")) {
    bias.push("prompt_user_for_scope_if_blocked");
  }
  return bias;
}

function extractText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p?.text) return p.text;
        if (p?.type === "text" && p.text) return p.text;
        return "";
      })
      .join("\n");
  }
  return String(content);
}

function formatReport(report) {
  const lines = [];
  lines.push(`# Token audit (proxy) — session ${report.session_id}`);
  lines.push("");
  lines.push(`Waste score: **${report.waste_score}/100** (higher = worse heuristics)`);
  lines.push(`Turns≈${report.turns} · tool_started events=${report.tool_starts_events} · model=${report.model || "?"}`);
  lines.push("");
  lines.push("## Proxy volume");
  lines.push(`- tool_result ≈ **${report.proxy.tool_result_tokens}** tok`);
  lines.push(`- assistant text ≈ **${report.proxy.assistant_text_tokens}** tok`);
  lines.push(`- user text ≈ **${report.proxy.user_text_tokens}** tok`);
  lines.push(`- chat_history file ≈ **${report.proxy.chat_history_tokens_proxy}** tok (${report.proxy.chat_history_bytes} bytes)`);
  lines.push(`- _${report.proxy.note}_`);
  lines.push("");
  lines.push("## Top tools by result size");
  for (const t of report.top_tools_by_result_tokens) {
    lines.push(`- \`${t.name}\`: ${t.calls} calls, ≈${t.resultTokens} tok results`);
  }
  lines.push("");
  if (report.findings.length) {
    lines.push("## Findings");
    for (const f of report.findings) {
      lines.push(`- **[${f.severity}]** \`${f.code}\`${f.file ? ` · ${f.file}` : ""} — ${f.detail}`);
    }
    lines.push("");
  } else {
    lines.push("## Findings");
    lines.push("- none (no heuristic fired)");
    lines.push("");
  }
  if (report.agent_corrections.length) {
    lines.push("## Agent self-corrections (apply rest of session)");
    for (const c of report.agent_corrections) lines.push(`- ${c}`);
    lines.push("");
  }
  if (report.user_recommendations.length) {
    lines.push("## Recommendations for user (prompts / workflow)");
    for (const c of report.user_recommendations) lines.push(`- ${c}`);
    lines.push("");
  }
  if (report.auto_tune.next_session_bias.length) {
    lines.push("## Auto-tune bias tags");
    lines.push(report.auto_tune.next_session_bias.map((b) => `\`${b}\``).join(", "));
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv);
  const session = resolveSession(opts);
  const report = analyze(session);

  if (opts.write) {
    const outDir = path.join(opts.cwd, "tmp", "token-audit");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `${stamp}_${report.session_id.slice(0, 8)}.json`);
    const mdPath = path.join(outDir, `${stamp}_${report.session_id.slice(0, 8)}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
    fs.writeFileSync(mdPath, formatReport(report) + "\n");
    report.written = { json: jsonPath, md: mdPath };
  }

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
    if (report.written) {
      console.log(`\nWrote:\n  ${report.written.md}\n  ${report.written.json}`);
    }
  }
}

main();
