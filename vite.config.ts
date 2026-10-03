import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Exposes GITHUB_TOKEN from .env to the client as import.meta.env.GITHUB_TOKEN
  envPrefix: ["VITE_", "GITHUB_TOKEN"],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
