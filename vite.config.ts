import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle the lazy viewer dependencies before the first route request.
  optimizeDeps: {
    include: [
      "@react-three/fiber",
      "@react-three/drei",
      "three",
      "three/examples/jsm/loaders/GLTFLoader.js",
    ],
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/socket.io": { target: "http://127.0.0.1:4000", ws: true },
    },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
