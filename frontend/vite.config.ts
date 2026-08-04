import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
    nodePolyfills(),
  ],
  optimizeDeps: {
    exclude: ["sqlocal", "brotli-wasm"],
  },
  worker: {
    format: "es",
  },
});
