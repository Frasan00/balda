import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const exclude = ["node_modules", "dist", ".idea", ".git", ".cache"];

// Skip GraphQL tests in Deno due to dynamic import resolution issues
if (process.env.DENO) {
  exclude.push("test/graphql/**");
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude,
  },
  resolve: {
    alias: {
      src: resolve(__dirname, "./src"),
      test: resolve(__dirname, "./test"),
    },
  },
});
