import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualAgent } from "visual-agent";

export default defineConfig({
  plugins: [visualAgent(), react(), tailwindcss()],
});
