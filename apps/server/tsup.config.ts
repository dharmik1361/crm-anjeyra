import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/api.ts", "src/worker.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Workspace packages ship TypeScript source, so bundle them; real npm deps stay external.
  noExternal: [/^@qf\//],
});
