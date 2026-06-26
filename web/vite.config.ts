import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    minify: command === "build",
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  // Use relative paths for assets (required for GitHub Pages subpath deployment)
  base: "./",
}));
