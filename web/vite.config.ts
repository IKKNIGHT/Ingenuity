import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // PartyKit WebSockets connect directly to 127.0.0.1:1999 (see getPartyKitHost). A Vite /parties
  // proxy caused noisy ECONNABORTED errors on some Windows setups; direct WS avoids that.
});
