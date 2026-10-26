import { defineConfig } from "vitest/config";
import { transformWithOxc } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null;
        if (code.includes("<") && (code.includes("/>") || code.includes("</"))) {
          return transformWithOxc(code, id, {
            lang: "jsx",
          });
        }
        return null;
      },
    },
  ],
  test: {
    environment: "node",
    // Several suites load whole route modules (the page builder, checkout) for the first time, which can take longer than
    // the 5 s default on a busy machine.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
