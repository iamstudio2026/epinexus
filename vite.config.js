import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // Supabase es opcional: si no está instalado, no rompemos el build.
      external: (id) => id === "@supabase/supabase-js",
      output: {
        manualChunks: {
          react:    ["react", "react-dom"],
          recharts: ["recharts"],
          icons:    ["lucide-react"],
        },
      },
    },
  },
});
