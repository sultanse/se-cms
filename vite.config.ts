import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ["VITE_", "GITHUB_APP_CLIENT_ID"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // GitHub's device-flow endpoints don't support CORS, so proxy them same-origin
      "/github-oauth": {
        target: "https://github.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-oauth/, "/login"),
      },
    },
  },
})
