import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same as vite.config.ts but keeps Vite's cache off the full C: drive.
export default defineConfig({
  plugins: [react()],
  cacheDir: "E:/cp-work/vite-cache",
});
