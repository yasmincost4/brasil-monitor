import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Brasil Monitor",
        short_name: "BR Monitor",
        description: "Painel de inteligência em tempo real do Brasil",
        theme_color: "#0f1419",
        background_color: "#0f1419",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // guarda a última resposta de dados do Supabase → abre offline
            urlPattern: ({ url }) => url.href.includes(".supabase.co/rest/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-dados",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // tiles/estilo do mapa
            urlPattern: ({ url }) => url.host.includes("demotiles.maplibre.org"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "mapa-tiles",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
