import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: Number(process.env.PORT) || 38421,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.API_SERVER_URL || "http://localhost:38422",
        changeOrigin: true,
      },
    },
  },
  css: {
    postcss: "./postcss.config.js",
  },
  build: {
    outDir: "dist",
  },
});
