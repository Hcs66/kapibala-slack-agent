import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts"],
    exclude: ["node_modules", ".nitro", ".output", "dist"],
    testTimeout: 10000,
    alias: {
      "~/": resolve(__dirname, "server") + "/",
    },
  },
});
