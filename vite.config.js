import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile, rename } from "node:fs/promises";
import { mergeBaked, formatDefaults, parseDefaultsSource } from "./scripts/bake-merge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultsPath = path.join(__dirname, "src", "core", "defaults.js");
const tilesDir = path.join(__dirname, "src", "tiles");

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

function bakeEndpoint() {
  return {
    name: "ledge-bake-endpoint",
    configureServer(server) {
      let bakeChain = Promise.resolve();
      server.middlewares.use("/__tile", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const dump = JSON.parse(body);
            const t = dump.tile || dump;
            const id = t && t.id | 0;
            const src = t && t.src;
            if (!id || !src) throw new Error("missing tile id/src");
            if (!existsSync(tilesDir)) mkdirSync(tilesDir, { recursive: true });
            const m = String(src).match(/^data:image\/\w+;base64,(.+)$/);
            if (!m) throw new Error("src is not a data URL");
            const file = path.join(tilesDir, `t${id}.png`);
            await writeFile(file, Buffer.from(m[1], "base64"));
            console.log("[tile] wrote", file);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, file: `src/tiles/t${id}.png` }));
          } catch (err) {
            console.error("[tile] FAILED:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
          }
        });
      });
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
              const tmp = defaultsPath + ".tmp";
              await writeFile(tmp, text, "utf8");
              await rename(tmp, defaultsPath);
              loadExistingBaked.last = merged;
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

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile(), bakeEndpoint()],
  server: {
    // Writing defaults.js from /__bake would otherwise trigger a full HMR
    // reload and wipe the editor. The open tab already has the draft in
    // memory; dist / a new origin reads the file on next load. Newer
    // savedAt wins (persist.preferLocal) so file:// cannot hide a fresh bake.
    watch: { ignored: ["**/src/core/defaults.js"] }
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
