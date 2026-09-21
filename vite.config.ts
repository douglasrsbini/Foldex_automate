import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Impede o Vite de monitorar a pasta de compilação do Rust e node_modules
      ignored: ["**/src-tauri/**", "**/node_modules/**"],
    },
  },
});