// The Broken Seal Companion - settings.
//
// Every value that starts with "YOUR_" is a placeholder. Do NOT commit real
// server addresses or keys to this file. For local testing copy this file to
// `config.local.js` (git-ignored) and fill it in there; the app loads
// `config.local.js` on top of these values when it exists.
// See README.md in this folder.

export default {
  nakama: {
    host: "YOUR_NAKAMA_HOST",          // e.g. "chat.example.com" (no "https://")
    port: "7350",                      // "443" behind an HTTPS proxy
    useSSL: true,                      // must be true when the app is served over https
    serverKey: "YOUR_CLIENT_SERVER_KEY" // Nakama socket.server_key (the client key, never the console/http key)
  },

  // Chat room names. They must match what the game client joins.
  rooms: {
    world: "world",
    mapPrefix: "map."                  // map room = mapPrefix + mapId, e.g. "map.whisperwood"
  },

  // Maps shown in the Map tab dropdown (Eldoria, Alpha). Names = Resources/World/maps.json.
  maps: [
    { id: "eldoria_keep", th: "เอลโดเรีย คีป", en: "Eldoria Keep" },
    { id: "whisperwood",  th: "วิสเปอร์วูด",       en: "Whisperwood" },
    { id: "thornveil",    th: "ป่าธอร์นเวล",        en: "Thornveil Forest" },
    { id: "mirefen",      th: "บึงไมร์เฟน",         en: "Mirefen Marsh" },
    { id: "old_barrow",   th: "ซากสุสานโอลด์แบร์โรว์", en: "Old Barrow Ruins" }
  ],

  // Accounts are made in the game. Leave false so the app only signs in.
  allowSignUp: false,

  historyLimit: 100,   // messages loaded when a room opens (Nakama max is 100)
  maxChars: 120,       // same limit as the game (ChatRules.Clean, text elements)

  // Client-side courtesy check that mirrors the server rule (ChatLimiter).
  // The server still decides; this only avoids sending messages it will refuse.
  rate: { messages: 5, perSeconds: 10, repeatSeconds: 30 }
};
