import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "NBA Field Assistant",
        short_name: "NBA",
        theme_color: "#0f172a",
        background_color: "#f8fafc",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/kc": {
        target: "http://host.docker.internal:8081",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kc/, "")
      }
    }
  }
});
