import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/primitives/artifacts/index.ts",
    "src/states/empty-states.ts",
  ],
  format: ["esm", "cjs"],
  // TypeScript 7 no longer exposes the compiler API consumed by tsup's DTS
  // bundler. Native declaration emit runs separately via tsconfig.build.json.
  dts: false,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "@radix-ui/react-dialog",
  ],
  treeshake: true,
  splitting: false,
});
