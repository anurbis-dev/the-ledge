import { defineConfig, normalizePath } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile, rename, unlink } from "node:fs/promises";
import { mergeBaked, formatDefaults, parseDefaultsSource } from "./scripts/bake-merge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultsPath = path.join(__dirname, "src", "core", "defaults.js");
// Vite's moduleGraph keys files by posix-style path internally; on Windows
// path.join() produces backslashes, so getModulesByFile(defaultsPath) below
// silently matched nothing and every bake kept serving the pre-bake
// transform to the running app until the dev server was restarted — the
// file on disk was correct, but the page never actually saw it.
const defaultsPathNormalized = normalizePath(defaultsPath);

// Dev-only: lets the editor's "Bake" button write src/core/defaults.js
// directly on disk, so baking a level/params/settings snapshot needs no
// manual download+script step.
function loadExistingBaked() {
  if (!existsSync(defaultsPath)) return null;
  try {
    return parseDefaultsSource(readFileSync(defaultsPath, "utf8"));
  } catch (err) {
    console.error("[bake] could not parse defaults.js, using last good snapshot:", err.message);
    return loadExistingBaked.last || null;
  }
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function atomicWriteDefaults(text) {
  // Unique tmp name prevents cross-process collisions when multiple vite
  // servers are running against the same workspace.
  const tmp = `${defaultsPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, text, "utf8");
  let lastErr = null;
  for (let i = 0; i < 8; i++) {
    try {
      await rename(tmp, defaultsPath);
      return;
    } catch (err) {
      lastErr = err;
      const code = err && err.code;
      if (code !== "EPERM" && code !== "EACCES") break;
      await waitMs(20 * (i + 1));
    }
  }
  try { await unlink(tmp); } catch {}
  throw lastErr;
}

function bakeEndpoint() {
  return {
    name: "ledge-bake-endpoint",
    configureServer(server) {
      let bakeChain = Promise.resolve();
      server.middlewares.use("/__bake", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        console.log("[bake] request received from", req.socket.remoteAddress);
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("error", (err) => {
          console.error("[bake] request stream error:", err);
        });
        req.on("end", () => {
          bakeChain = bakeChain.then(async () => {
            try {
              const dump = JSON.parse(body);
              const existing = loadExistingBaked();
              const merged = mergeBaked(existing, dump);
              const text = formatDefaults(merged);
              await atomicWriteDefaults(text);
              loadExistingBaked.last = merged;
              // defaults.js is excluded from the fs watcher (see server.watch.ignored
              // below) so a plain write never reaches Vite's per-module transform
              // cache. Without this, every future request for defaults.js — including
              // a brand-new tab or a plain page reload — would keep being served the
              // pre-bake transform forever, not just until the next edit. Manually
              // invalidating just this module (no server.ws send) forces the next
              // request to re-transform from the file we just wrote, while the
              // currently-open editor tab still isn't force-reloaded/wiped.
              const staleMods = server.moduleGraph.getModulesByFile(defaultsPathNormalized);
              if (staleMods) staleMods.forEach((m) => server.moduleGraph.invalidateModule(m));
              const levelCount = merged.levels ? Object.keys(merged.levels).filter((k) => k !== "_gone").length : 0;
              console.log(`[bake] OK — wrote ${defaultsPath} (levels: ${levelCount})`);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, levels: levelCount }));
            } catch (err) {
              console.error("[bake] FAILED:", err);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
            }
          });
        });
      });
    }
  };
}

// Dev-only: lets the standalone ../Chars/Shirley.html character workbench
// (outside this repo, opened via file://) export its pose/palette/style
// data straight into src/render/shirley/data.js on whichever dev server
// happens to be running — no dedicated process, no manual copy-paste.
// CORS is wide open here because the caller is a file:// origin, not this
// server's own origin; the endpoint only ever writes into src/render/shirley/.
function shirleyEndpoint() {
  const renderDir = path.join(__dirname, "src", "render");
  // Characters share one skeleton but export to their own folder, so
  // multiple characters authored in ../Chars/Shirley.html can coexist
  // in the engine (src/render/<charId>/data.js). No character field
  // (older payloads) defaults to "shirley", preserving the original path.
  function sanitizeCharId(name) {
    const s = String(name || "shirley").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return s || "shirley";
  }
  function genData(payload) {
    return [
      "/* AUTO-GENERATED — экспортировано из ../Chars/Shirley.html, не редактировать руками */",
      `export const PALETTE = ${JSON.stringify(payload.palette, null, 2)};`,
      `export const STYLE = ${JSON.stringify(payload.style, null, 2)};`,
      `export const HEAD_ROWS = ${JSON.stringify(payload.headRows, null, 2)};`,
      `export const HEAD_PIVOT = ${JSON.stringify(payload.headPivot || null, null, 2)};`,
      `export const PARTS = ${JSON.stringify(payload.parts, null, 2)};`,
      `export const PART_PIVOTS = ${JSON.stringify(payload.partPivots || null, null, 2)};`,
      `export const FRAMES = ${JSON.stringify(payload.frames, null, 2)};`,
      `export const DRAW_ORDER = ${JSON.stringify(payload.drawOrder || null, null, 2)};`,
      ""
    ].join("\n");
  }
  return {
    name: "shirley-export-endpoint",
    configureServer(server) {
      server.middlewares.use("/__shirley", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            const charId = sanitizeCharId(payload.character);
            const outDir = path.join(renderDir, charId);
            if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
            const file = path.join(outDir, "data.js");
            await writeFile(file, genData(payload), "utf8");
            console.log("[shirley] wrote", file);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `src/render/${charId}/data.js` }));
          } catch (err) {
            console.error("[shirley] FAILED:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile(), bakeEndpoint(), shirleyEndpoint()],
  server: {
    // Writing defaults.js from /__bake would otherwise trigger a full HMR
    // reload and wipe the editor's live draft. The bake handler above
    // manually invalidates just this module's transform cache after each
    // successful write, so a new tab / plain reload still sees the fresh
    // bake; the currently-open tab keeps its in-memory state until it
    // navigates or reloads itself.
    watch: { ignored: ["**/src/core/defaults.js"] },
    // Vite's default cors handling doesn't set Access-Control-Allow-Origin
    // for Origin: null (what file:// pages send), which breaks the
    // ../Chars/Shirley.html export's preflight. Reflecting the origin
    // covers that case too.
    cors: { origin: true }
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: "index.html",
        talklab: "talk-lab.html",
      },
    },
  },
});
