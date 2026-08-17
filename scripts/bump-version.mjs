#!/usr/bin/env node

/**
 * SemVer bump for package.json (single source of truth).
 *
 * Usage:
 *   node scripts/bump-version.mjs <level>
 *
 * Levels:
 *   patch | minor | major  — numeric release bump (strips prerelease)
 *   dev | alpha | beta | rc — prerelease channel (SemVer: X.Y.Z-CHANNEL.N)
 *   release                — strip prerelease → stable X.Y.Z
 *
 * Scale (agent judgment before commit/push):
 *   patch  — bugfix / isolated change
 *   minor  — feature / behavioral change
 *   major  — breaking / large architectural milestone
 *   dev    — WIP between releases (default while feature branch is open)
 *   alpha  — early public preview of next version
 *   beta   — feature-complete candidate, still fixing
 *   rc     — release candidate
 *   release — promote prerelease to stable (no digit change)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");

const LEVELS = [
  "patch",
  "minor",
  "major",
  "dev",
  "alpha",
  "beta",
  "rc",
  "release",
];

const level = process.argv[2];
if (!LEVELS.includes(level)) {
  console.error(
    "Usage: node scripts/bump-version.mjs <" + LEVELS.join("|") + ">",
  );
  process.exit(1);
}

/**
 * @param {string} raw
 * @returns {{ major: number, minor: number, patch: number, preid: string|null, prenum: number|null }}
 */
function parseSemver(raw) {
  const s = String(raw || "0.0.0").trim().replace(/^v/i, "");
  const m = s.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+?)(?:\.(\d+))?)?(?:\+.*)?$/,
  );
  if (!m) {
    console.error("Invalid package.json version:", raw);
    process.exit(1);
  }
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    preid: m[4] || null,
    prenum: m[5] != null ? +m[5] : m[4] ? 0 : null,
  };
}

/** @param {ReturnType<typeof parseSemver>} p */
function formatSemver(p) {
  let out = `${p.major}.${p.minor}.${p.patch}`;
  if (p.preid) {
    out +=
      p.prenum != null && p.prenum > 0
        ? `-${p.preid}.${p.prenum}`
        : p.prenum === 0
          ? `-${p.preid}.0`
          : `-${p.preid}`;
  }
  return out;
}

const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
const prev = parseSemver(pkg.version);
const next = { ...prev };

if (level === "major") {
  next.major += 1;
  next.minor = 0;
  next.patch = 0;
  next.preid = null;
  next.prenum = null;
} else if (level === "minor") {
  next.minor += 1;
  next.patch = 0;
  next.preid = null;
  next.prenum = null;
} else if (level === "patch") {
  if (prev.preid) {
    // Leave base digits; strip channel → stable of current X.Y.Z
    // (npm-like: finishing a prerelease series). Prefer explicit `release`.
    next.preid = null;
    next.prenum = null;
  } else {
    next.patch += 1;
  }
} else if (level === "release") {
  next.preid = null;
  next.prenum = null;
} else {
  // prerelease channel: dev | alpha | beta | rc
  const channel = level;
  if (prev.preid === channel) {
    next.prenum = (prev.prenum ?? 0) + 1;
  } else if (prev.preid) {
    // switch channel, keep base digits, reset counter
    next.preid = channel;
    next.prenum = 0;
  } else {
    // first prerelease after a stable: bump patch then attach channel
    // so 1.2.2 → 1.2.3-dev.0 (next stable target is 1.2.3)
    next.patch += 1;
    next.preid = channel;
    next.prenum = 0;
  }
}

const previousVersion = pkg.version;
const nextVersion = formatSemver(next);
if (nextVersion === previousVersion && level !== "release") {
  // avoid no-op (e.g. already clean + release)
  console.error(`Version unchanged: ${previousVersion} (${level})`);
  process.exit(1);
}

pkg.version = nextVersion;
fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version bumped: ${previousVersion} -> ${nextVersion} (${level})`);
