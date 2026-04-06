import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/lib/db", replacement: path.resolve(__dirname, "./src/lib/__mocks__/db.ts") },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
    },
  },
});
