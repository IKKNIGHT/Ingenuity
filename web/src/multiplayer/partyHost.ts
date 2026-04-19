/**
 * PartySocket `host` (no protocol).
 * Local dev: connect straight to PartyKit on port 1999 (`npm run dev:full` uses `-p 1999`).
 * Production: set `VITE_PARTYKIT_HOST` to your PartyKit deploy (e.g. `myproj.username.partykit.dev`).
 */
export function getPartyKitHost(): string {
  const raw = import.meta.env.VITE_PARTYKIT_HOST?.trim();
  if (raw) {
    return raw
      .replace(/^wss?:\/\//, "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
  }
  return "127.0.0.1:1999";
}
