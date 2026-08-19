// vite 8 (rolldown) rejects rollupOptions.output.codeSplitting=false whenever
// there is more than one HTML input, but vite-plugin-singlefile forces that
// flag on so each page inlines into a single file. Build each entry in its
// own pass into the shared dist/ dir instead of one multi-entry build.
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const entries = [
  { name: "main", input: "index.html" },
  { name: "talklab", input: "talk-lab.html" },
];

for (const [i, entry] of entries.entries()) {
  await build({
    configFile: false,
    base: "./",
    plugins: [viteSingleFile()],
    build: {
      outDir: "dist",
      emptyOutDir: i === 0,
      assetsInlineLimit: 100000000,
      chunkSizeWarningLimit: 100000000,
      cssCodeSplit: false,
      rollupOptions: {
        input: { [entry.name]: entry.input },
      },
    },
  });
}
