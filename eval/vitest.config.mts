import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The harness imports the app's real search code, so `@/` points into apps/web.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../apps/web/src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
