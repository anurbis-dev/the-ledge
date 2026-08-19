#!/usr/bin/env node

/**
 * PreToolUse hook (matcher: Bash, if: "Bash(git commit*)").
 * Ported from levelDesigner; blocks git commit when package.json version
 * has not moved since HEAD.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function allow() {
    process.exit(0);
}

function deny(reason) {
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason
        }
    }));
    process.exit(0);
}

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { allow(); }

let payload;
try { payload = JSON.parse(raw); } catch { allow(); }

const command = payload?.tool_input?.command || '';

if (!/(^|[;&|]\s*)git\s+commit\b/.test(command)) allow();
if (/\s(-h|--help)\b/.test(command)) allow();

// The bump-version convention only applies to this repo (package.json lives
// here). A command that `cd`s elsewhere before `git commit` (e.g. the sibling
// landing-site checkout) targets a different repo entirely — resolve the last
// `cd <dir>` before the commit and skip enforcement if it points outside here.
{
    const commitIdx = command.search(/(^|[;&|]\s*)git\s+commit\b/);
    const prefix = commitIdx >= 0 ? command.slice(0, commitIdx) : '';
    const cdMatches = [...prefix.matchAll(/(?:^|[;&|]\s*)cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))/g)];
    if (cdMatches.length) {
        const last = cdMatches[cdMatches.length - 1];
        const target = last[1] || last[2] || last[3];
        const resolved = path.resolve(process.cwd(), target);
        const cwd = process.cwd();
        const inside = resolved.toLowerCase() === cwd.toLowerCase()
            || resolved.toLowerCase().startsWith(cwd.toLowerCase() + path.sep);
        if (!inside) allow(); // covers cross-drive targets too (path.relative doesn't yield '..' across drives on Windows)
    }
}

function sh(cmd) {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}

let headVersion;
try {
    headVersion = JSON.parse(sh('git show HEAD:package.json')).version;
} catch {
    allow(); // no HEAD yet / package.json not tracked
}

let indexVersion, workingVersion;
try { indexVersion = JSON.parse(sh('git show :package.json')).version; } catch { indexVersion = headVersion; }
try { workingVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version; } catch { workingVersion = headVersion; }

if (indexVersion !== headVersion || workingVersion !== headVersion) allow();

deny(
    `Версия не поднята (package.json version=${headVersion} не менялся). ` +
    'Перед коммитом: npm run bump:patch|minor|major|dev|alpha|beta|rc|release, ' +
    'затем git add package.json и повтори commit.'
);
