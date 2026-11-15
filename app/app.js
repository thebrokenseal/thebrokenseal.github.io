// The Broken Seal Companion - world/map chat over Nakama.
// Plain ES module, no build step. Wrappable later with Capacitor (same files as webDir).
//
// Safety rules kept in this file:
//  - user/server text is only ever placed with textContent, never innerHTML
//  - a message is treated as a system announcement only when content.system is
//    true AND it has no player sender (server-made), so players cannot fake one
//  - no secrets here: server address/key come from config.js / config.local.js

import baseConfig from "./config.js";

const NAKAMA_URL = "https://cdn.jsdelivr.net/npm/@heroiclabs/nakama-js@2.8.0/dist/nakama-js.esm.mjs";
const SYSTEM_SENDER = "00000000-0000-0000-0000-000000000000";
const KEY_SESSION = "bs.companion.session";
const KEY_MAP = "bs.companion.map";
const KEY_TAB = "bs.companion.tab";
const KEY_INSTALL = "bs.companion.installHintClosed";
const MAX_KEEP = 300;          // messages kept in memory per room
const ROOM_TYPE = 1;           // Nakama channel type: 1 = room

// ---------------------------------------------------------------- helpers

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
}

const segmenter = (typeof Intl !== "undefined" && Intl.Segmenter)
  ? new Intl.Segmenter("th", { granularity: "grapheme" }) : null;
function countChars(s) {
  if (!segmenter) return Array.from(s).length;
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}
function cleanOutgoing(s) {
  // Same spirit as ChatRules.Clean on the server: one line, collapsed spaces.
  return s.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
}

function isPrivateHost(h) {
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local") ||
    /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

async function loadConfig() {
  const cfg = structuredClone(baseConfig);
  // Optional local override (git-ignored). Only looked for on local/LAN hosts
  // so the public site does not request a file that is never there.
  if (isPrivateHost(location.hostname)) {
    try {
      const local = (await import("./config.local.js")).default || {};
      Object.assign(cfg, local, {
        nakama: { ...cfg.nakama, ...(local.nakama || {}) },
        rooms: { ...cfg.rooms, ...(local.rooms || {}) },
        rate: { ...cfg.rate, ...(local.rate || {}) }
      });
    } catch { /* no local config: fine */ }
  }
  return cfg;
}

function isConfigured(cfg) {
  const n = cfg.nakama || {};
  return !!n.host && !!n.serverKey && !/^YOUR_/.test(n.host) && !/^YOUR_/.test(n.serverKey);
}

const timeFmt = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" });
function dayKey(t) { const d = new Date(t); return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate(); }
function dayLabel(t) {
  const today = dayKey(Date.now());
  const k = dayKey(t);
  if (k === today) return "วันนี้";
  if (k === dayKey(Date.now() - 86400000)) return "เมื่อวาน";
  return dayFmt.format(new Date(t));
}

// ---------------------------------------------------------------- state

const cfg = await loadConfig();
const params = new URLSearchParams(location.search);
const DEMO = params.get("demo") === "1";

const mapById = new Map((cfg.maps || []).map((m) => [m.id, m]));
const savedMap = store.get(KEY_MAP);
const state = {
  nk: null,               // nakama-js module
  client: null,
  session: null,
  socket: null,
  connecting: false,
  retry: 0,
  retryTimer: 0,
  tab: store.get(KEY_TAB) === "map" ? "map" : "world",
  mapId: mapById.has(savedMap) ? savedMap : (cfg.maps[0] && cfg.maps[0].id),
  rooms: {
    world: newRoom(),
    map: newRoom()
  },
  sent: [],               // [{t, text}] for the courtesy rate check
  sending: false
};

function newRoom() { return { channelId: null, list: [], ids: new Set(), unread: 0 }; }
function roomName(key) {
  return key === "world" ? cfg.rooms.world : cfg.rooms.mapPrefix + state.mapId;
}
function mapLabel(id) {
  const m = mapById.get(id);
  return m ? m.th : id;
}

// ---------------------------------------------------------------- UI: status, screens

function setStatus(text, kind) {
  const s = $("statusLine");
  s.textContent = text;
  s.className = "top-sub" + (kind ? " " + kind : "");
}

function show(screen) {
  $("app").dataset.screen = screen;
  $("signinScreen").hidden = screen !== "signin";
  $("chatScreen").hidden = screen !== "chat";
  $("signOutBtn").hidden = screen !== "chat" || DEMO;
}

// ---------------------------------------------------------------- messages

// Names shown are the character names the server set as display names (name_reserve), never the account's
// username, which a player could choose to look like someone else (net review 2026-11-02).
const displayNames = new Map();
const gmIds = new Set();
let namesWanted = new Set();
let namesTimer = null;

function nameOf(sender) {
  if (!sender) return "";
  if (displayNames.has(sender)) return displayNames.get(sender);
  namesWanted.add(sender);
  if (!namesTimer) namesTimer = setTimeout(resolveNames, 150);
  return "…";
}

async function resolveNames() {
  namesTimer = null;
  const ids = [...namesWanted].slice(0, 100);
  namesWanted = new Set([...namesWanted].slice(100));
  if (!ids.length || !state.client || !state.session) return;
  try {
    const res = await state.client.getUsers(state.session, ids);
    for (const u of res.users || []) {
      displayNames.set(u.id, u.display_name || "ผู้เล่น");
      let meta = u.metadata;
      if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      if (meta && meta.gm === true) gmIds.add(u.id);   // staff only, set on the server (user 2026-11-02)
    }
    for (const id of ids) if (!displayNames.has(id)) displayNames.set(id, "ผู้เล่น");
    renderLog();
  } catch { /* try again on the next message */ }
}

function normalize(m) {
  let content = m.content;
  if (typeof content === "string") {
    try { content = JSON.parse(content); } catch { content = { text: content }; }
  }
  if (!content || typeof content !== "object") content = {};
  return {
    id: m.message_id,
    code: Number(m.code || 0),
    sender: m.sender_id || "",
    username: m.sender_id ? null : (m.username || ""),   // real names come from nameOf(sender) when drawn
    content,
    time: Date.parse(m.create_time) || Date.now()
  };
}

function isSystem(msg) {
  return msg.content.system === true && (!msg.sender || msg.sender === SYSTEM_SENDER);
}
function isRiftGate(msg) {
  const k = String(msg.content.kind || "").toLowerCase();
  return isSystem(msg) && (k.startsWith("seal_rift") || k === "rift_gate");
}

/** Adds messages (oldest first) to a room. Returns the ones that were new. */
function addMessages(key, msgs) {
  const room = state.rooms[key];
  const added = [];
  for (const raw of msgs) {
    const msg = normalize(raw);
    if (msg.code === 2) { removeMessage(key, msg.id); continue; }   // removed
    if (msg.code === 1 && room.ids.has(msg.id)) {                  // edited
      const i = room.list.findIndex((x) => x.id === msg.id);
      if (i >= 0) room.list[i] = msg;
      continue;
    }
    if (msg.code !== 0 && msg.code !== 1) continue;                  // join/leave notices etc.
    if (!msg.id || room.ids.has(msg.id)) continue;
    room.ids.add(msg.id);
    room.list.push(msg);
    added.push(msg);
  }
  room.list.sort((a, b) => a.time - b.time);
  while (room.list.length > MAX_KEEP) room.ids.delete(room.list.shift().id);
  return added;
}

function removeMessage(key, id) {
  const room = state.rooms[key];
  if (!room.ids.has(id)) return;
  room.ids.delete(id);
  room.list = room.list.filter((x) => x.id !== id);
  if (key === state.tab) renderLog();
}

function buildMessage(msg) {
  const li = el("li", "msg");
  li.dataset.id = msg.id;
  const head = el("div", "msg-head");
  const time = el("span", "msg-time", timeFmt.format(new Date(msg.time)));
  time.title = new Date(msg.time).toLocaleString("th-TH");
  const text = String(msg.content.text == null ? "" : msg.content.text).slice(0, 600);

  if (isSystem(msg)) {
    li.classList.add("system");
    const rift = isRiftGate(msg);
    if (rift) li.classList.add("rift");
    head.append(el("span", "msg-name", rift ? "ประกาศ Seal Rift" : "ประกาศระบบ"), time);
    li.append(head);
    if (rift) {
      const where = msg.content.map ? mapLabel(String(msg.content.map)) : "";
      li.append(el("p", "rift-title", where ? `ประตู Seal Rift เปิดที่ ${where}` : "ประตู Seal Rift เปิดแล้ว"));
    }
    if (text) li.append(el("p", "msg-text", text));
    const mapId = String(msg.content.map || "");
    if (rift && mapById.has(mapId)) {
      const go = el("button", "rift-go", `เปิดแชตแมพ ${mapLabel(mapId)}`);
      go.type = "button";
      go.addEventListener("click", () => { selectMap(mapId); selectTab("map"); });
      li.append(go);
    }
    return li;
  }

  const mine = (state.session && msg.sender === state.session.user_id) || msg.sender === "demo-me";
  if (mine) li.classList.add("mine");
  head.append(el("span", "msg-name", (msg.username ?? nameOf(msg.sender)) || "ผู้เล่น"), time);
  if (msg.sender && gmIds.has(msg.sender)) head.insertBefore(el("span", "msg-gm", "GM"), head.firstChild);
  li.append(head, el("p", "msg-text", text));
  return li;
}

function nearBottom() {
  const log = $("log");
  return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
}
function scrollToBottom() {
  const log = $("log");
  log.scrollTop = log.scrollHeight;
  $("jumpBtn").hidden = true;
}

function renderLog() {
  const log = $("log");
  const room = state.rooms[state.tab];
  const frag = document.createDocumentFragment();
  let lastDay = null;
  for (const msg of room.list) {
    const d = dayKey(msg.time);
    if (d !== lastDay) { frag.append(el("li", "day-sep", dayLabel(msg.time))); lastDay = d; }
    frag.append(buildMessage(msg));
  }
  log.replaceChildren(frag);
  log.dataset.lastDay = lastDay == null ? "" : String(lastDay);
  $("emptyLog").hidden = room.list.length > 0;
  scrollToBottom();
}

function appendLive(key, msgs) {
  if (!msgs.length) return;
  if (key !== state.tab) {
    state.rooms[key].unread += msgs.length;
    updateBadges();
    return;
  }
  const log = $("log");
  const stick = nearBottom();
  for (const msg of msgs) {
    const d = dayKey(msg.time);
    if (String(d) !== log.dataset.lastDay) { log.append(el("li", "day-sep", dayLabel(msg.time))); log.dataset.lastDay = String(d); }
    log.append(buildMessage(msg));
  }
  $("emptyLog").hidden = true;
  const mineLast = state.session && msgs[msgs.length - 1].sender === state.session.user_id;
  if (stick || mineLast) scrollToBottom(); else $("jumpBtn").hidden = false;
}

function updateBadges() {
  for (const [key, id] of [["world", "badgeWorld"], ["map", "badgeMap"]]) {
    const n = state.rooms[key].unread;
    const b = $(id);
    b.hidden = n === 0;
    b.textContent = n > 99 ? "99+" : String(n);
  }
}

// ---------------------------------------------------------------- tabs / map

function selectTab(tab) {
  state.tab = tab;
  store.set(KEY_TAB, tab);
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  $("mapBar").hidden = tab !== "map";
  state.rooms[tab].unread = 0;
  updateBadges();
  updateRoomLabel();
  renderLog();
}

function updateRoomLabel() {
  $("roomLabel").textContent = state.tab === "world" ? "ส่งถึง: แชตโลก (ทุกแมพ)" : `ส่งถึง: แชตแมพ ${mapLabel(state.mapId)}`;
}

async function selectMap(mapId) {
  if (!mapById.has(mapId) || mapId === state.mapId) { $("mapSelect").value = state.mapId; return; }
  const old = state.rooms.map;
  state.mapId = mapId;
  store.set(KEY_MAP, mapId);
  $("mapSelect").value = mapId;
  state.rooms.map = newRoom();
  updateRoomLabel();
  if (state.tab === "map") renderLog();
  if (DEMO) { fillDemoMap(); return; }
  if (state.socket && old.channelId) {
    try { await state.socket.leaveChat(old.channelId); } catch { /* already gone */ }
  }
  if (state.socket) {
    try { await joinRoom("map"); } catch (e) { console.warn("join map failed", e); setStatus("เข้าห้องแชตแมพไม่ได้ ลองใหม่อีกครั้ง", "warn"); }
  }
}

// ---------------------------------------------------------------- Nakama

function saveSession() {
  const s = state.session;
  if (s) store.set(KEY_SESSION, JSON.stringify({ token: s.token, refresh_token: s.refresh_token }));
}

async function loadNakama() {
  if (state.nk) return state.nk;
  state.nk = await import(NAKAMA_URL);
  const n = cfg.nakama;
  state.client = new state.nk.Client(n.serverKey, n.host, String(n.port), !!n.useSSL, 10000, true);
  return state.nk;
}

class AuthError extends Error {}

async function ensureFreshSession() {
  const s = state.session;
  if (!s) throw new AuthError("no session");
  const now = Date.now() / 1000;
  if (!s.isexpired(now + 60)) return;
  if (!s.refresh_token || s.isrefreshexpired(now + 10)) throw new AuthError("refresh expired");
  try {
    await state.client.sessionRefresh(s);
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) throw new AuthError("refresh refused");
    throw e;
  }
  saveSession();
}

async function connect() {
  if (state.connecting) return;
  state.connecting = true;
  clearTimeout(state.retryTimer);
  setStatus("กำลังเชื่อมต่อ…", "warn");
  try {
    await ensureFreshSession();
    const socket = state.client.createSocket(!!cfg.nakama.useSSL, false);
    socket.ondisconnect = () => {
      if (state.socket !== socket) return;
      state.socket = null;
      state.rooms.world.channelId = null;
      state.rooms.map.channelId = null;
      scheduleReconnect();
    };
    socket.onchannelmessage = onChannelMessage;
    await socket.connect(state.session, false);
    state.socket = socket;
    await joinRoom("world");
    await joinRoom("map");
    state.retry = 0;
    setStatus(`เชื่อมต่อแล้ว · ${state.session.username || ""}`, "ok");
  } catch (e) {
    console.warn("connect failed", e);
    if (e instanceof AuthError) { signOut("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"); return; }
    try { state.socket && state.socket.disconnect(false); } catch { /* ignore */ }
    state.socket = null;
    scheduleReconnect();
  } finally {
    state.connecting = false;
  }
}

function scheduleReconnect() {
  if (!state.session) return;
  clearTimeout(state.retryTimer);
  const wait = Math.min(30, 2 ** Math.min(state.retry, 5));
  state.retry++;
  setStatus(navigator.onLine === false ? "ออฟไลน์ รอสัญญาณอินเทอร์เน็ต…" : `ขาดการเชื่อมต่อ จะลองใหม่ใน ${wait} วินาที`, "warn");
  state.retryTimer = setTimeout(connect, wait * 1000);
}

async function joinRoom(key) {
  const name = roomName(key);
  const channel = await state.socket.joinChat(name, ROOM_TYPE, true, false);
  if (key === "map" && roomName("map") !== name) return;   // map changed while joining
  const room = state.rooms[key];
  room.channelId = channel.id;
  const res = await state.client.listChannelMessages(state.session, channel.id, cfg.historyLimit || 100, false);
  saveSession(); // the call may have refreshed the session
  const older = (res.messages || []).slice().reverse();  // API gives newest first
  addMessages(key, older);
  if (key === state.tab) renderLog();
}

function keyForChannel(channelId) {
  if (channelId && channelId === state.rooms.world.channelId) return "world";
  if (channelId && channelId === state.rooms.map.channelId) return "map";
  return null;
}

function onChannelMessage(m) {
  const key = keyForChannel(m.channel_id);
  if (!key) return;
  const added = addMessages(key, [m]);
  if (added.length) appendLive(key, added);
  else if (key === state.tab && Number(m.code) === 1) renderLog();   // an edit
}

// ---------------------------------------------------------------- sign-in / out

function signinError(text) {
  const p = $("signinError");
  p.textContent = text || "";
  p.hidden = !text;
}

function authErrorText(e) {
  const status = e && e.status;
  if (status === 401) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (status === 404) return "ไม่พบบัญชีนี้ สร้างตัวละครและผูกอีเมลในเกมก่อน แล้วค่อยกลับมาเข้าที่นี่";
  if (status === 400) return "อีเมลหรือรหัสผ่านไม่ถูกรูปแบบ (รหัสผ่านอย่างน้อย 8 ตัวอักษร)";
  if (status === 409) return "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน";
  if (status === 429) return "ลองเข้าบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  if (status >= 500) return "เซิร์ฟเวอร์ขัดข้องชั่วคราว ลองใหม่อีกครั้งภายหลัง";
  return "ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
}

async function onSignIn(ev) {
  ev.preventDefault();
  signinError("");
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { signinError("กรอกอีเมลให้ถูกต้อง"); return; }
  if (password.length < 8) { signinError("รหัสผ่านอย่างน้อย 8 ตัวอักษร"); return; }
  const btn = $("signinBtn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    await loadNakama();
    const create = !!cfg.allowSignUp && $("signUp").checked;
    state.session = await state.client.authenticateEmail(email, password, create);
    saveSession();
    $("password").value = "";
    enterChat();
  } catch (e) {
    console.warn("sign-in failed", e);
    signinError(authErrorText(e));
  } finally {
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
}

function signOut(message) {
  clearTimeout(state.retryTimer);
  const s = state.session;
  const sock = state.socket;
  state.socket = null;
  state.session = null;
  store.del(KEY_SESSION);
  if (sock) { try { sock.disconnect(false); } catch { /* ignore */ } }
  if (s && state.client) state.client.sessionLogout(s, s.token, s.refresh_token).catch(() => {});
  state.rooms.world = newRoom();
  state.rooms.map = newRoom();
  updateBadges();
  show("signin");
  setStatus("ยังไม่ได้เข้าสู่ระบบ");
  signinError(message || "");
}

function enterChat() {
  show("chat");
  selectTab(state.tab);
  connect();
}

// ---------------------------------------------------------------- sending

function note(text) {
  const n = $("sendNote");
  n.textContent = text || "";
  n.hidden = !text;
  clearTimeout(note.timer);
  if (text) note.timer = setTimeout(() => { n.hidden = true; }, 6000);
}

function updateCounter() {
  const text = cleanOutgoing($("msgInput").value);
  const n = countChars(text);
  const max = cfg.maxChars || 120;
  const c = $("charCount");
  c.textContent = `${n}/${max}`;
  c.className = "count" + (n > max ? " over" : n > max - 15 ? " near" : "");
  $("sendBtn").disabled = state.sending || n === 0 || n > max;
  const ta = $("msgInput");
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight + 2, 120) + "px";
}

/** Mirrors the server's ChatLimiter so we can be polite before sending. */
function courtesyCheck(text) {
  const now = Date.now() / 1000;
  const r = cfg.rate || { messages: 5, perSeconds: 10, repeatSeconds: 30 };
  state.sent = state.sent.filter((x) => now - x.t < Math.max(r.perSeconds, r.repeatSeconds));
  const same = state.sent.find((x) => x.text === text && now - x.t < r.repeatSeconds);
  if (same) return `ข้อความนี้เพิ่งส่งไป รออีก ${Math.ceil(r.repeatSeconds - (now - same.t))} วินาทีก่อนส่งซ้ำนะ`;
  const recent = state.sent.filter((x) => now - x.t < r.perSeconds);
  if (recent.length >= r.messages) {
    const wait = Math.ceil(r.perSeconds - (now - recent[0].t));
    return `ส่งเร็วไปนิด พักสัก ${wait} วินาทีแล้วส่งต่อได้เลย`;
  }
  return null;
}

function refusalText(e) {
  const msg = String((e && (e.message || e.error)) || "");
  const code = e && e.code;
  if (code === 8 || /rate|limit|too ?fast|slow down|repeat/i.test(msg)) return "เซิร์ฟเวอร์ขอให้ส่งช้าลงหน่อย รอสักครู่แล้วลองใหม่นะ";
  if (code === 7) return "ตอนนี้ยังส่งข้อความในห้องนี้ไม่ได้";
  if (code === 3) return "ข้อความนี้ส่งไม่ได้ ลองแก้ข้อความแล้วส่งใหม่";
  if (code === 16) return "เซสชันหมดอายุ กำลังเชื่อมต่อใหม่";
  return "ส่งไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่";
}

async function onSend(ev) {
  ev.preventDefault();
  const input = $("msgInput");
  const text = cleanOutgoing(input.value);
  const max = cfg.maxChars || 120;
  if (!text) return;
  if (countChars(text) > max) { note(`ข้อความยาวเกิน ${max} ตัวอักษร`); return; }
  const wait = courtesyCheck(text);
  if (wait) { note(wait); return; }

  if (DEMO) {
    state.sent.push({ t: Date.now() / 1000, text });
    displayNames.set("demo-me", "คุณ (ตัวอย่าง)");
    const added = addMessages(state.tab, [{ message_id: "demo-" + Date.now() + "-" + (++demoSeq), sender_id: "demo-me", username: "คุณ (ตัวอย่าง)", content: { text }, create_time: new Date().toISOString() }]);
    appendLive(state.tab, added);
    input.value = "";
    updateCounter();
    return;
  }

  const room = state.rooms[state.tab];
  if (!state.socket || !room.channelId) { note("ยังไม่ได้เชื่อมต่อ รอสักครู่แล้วลองใหม่"); return; }
  state.sending = true;
  updateCounter();
  try {
    await state.socket.writeChatMessage(room.channelId, { text });
    state.sent.push({ t: Date.now() / 1000, text });
    input.value = "";
    note("");
  } catch (e) {
    console.warn("send refused", e);
    const server = e && e.message ? ` (${String(e.message).slice(0, 80)})` : "";
    note(refusalText(e) + server);
    if (e && e.code === 16) connect();
  } finally {
    state.sending = false;
    updateCounter();
  }
}

// ---------------------------------------------------------------- install hint

let deferredPrompt = null;
function setupInstallHint() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone || store.get(KEY_INSTALL) === "1") return;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const box = $("installHint");
  const text = $("installText");
  if (ios) {
    text.textContent = "ติดตั้งเป็นแอป: ใน Safari แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\"";
    box.hidden = false;
  } else if (android) {
    text.textContent = "ติดตั้งเป็นแอป: เปิดเมนู ⋮ ของเบราว์เซอร์ แล้วเลือก \"ติดตั้งแอป\" หรือ \"เพิ่มไปยังหน้าจอหลัก\"";
    box.hidden = false;
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    text.textContent = "ติดตั้งแอปไว้บนหน้าจอโฮม เปิดดูแชตโลกได้ทันทีโดยไม่ต้องเข้าเกม";
    $("installBtn").hidden = false;
    box.hidden = false;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch { /* ignore */ }
    deferredPrompt = null;
    box.hidden = true;
  });
  $("installClose").addEventListener("click", () => { box.hidden = true; store.set(KEY_INSTALL, "1"); });
  window.addEventListener("appinstalled", () => { box.hidden = true; store.set(KEY_INSTALL, "1"); });
}

// ---------------------------------------------------------------- demo (no server)

const demoNow = Date.now();
let demoSeq = 0;
function demoMsg(id, mins, username, content, sender = "demo-" + username) {
  if (sender) displayNames.set(sender, username);   // the demo has no server to ask for names
  return { message_id: id, sender_id: sender, username, content, create_time: new Date(demoNow - mins * 60000).toISOString() };
}
function fillDemoWorld() {
  addMessages("world", [
    demoMsg("w1", 26, "", { system: true, kind: "notice", text: "ยินดีต้อนรับสู่แชตโลก ข้อความนี้เป็นตัวอย่างหน้าตาแอป" }, ""),
    demoMsg("w2", 21, "Kaewmanee", { text: "มีใครฟาร์มที่วิสเปอร์วูดบ้าง ขอเข้าปาร์ตี้ด้วยคน" }),
    demoMsg("w3", 18, "IronOath", { text: "ห้องผมว่าง 1 ที่ ดาบโล่ Lv 9 ทักมาเลย" }),
    demoMsg("w4", 12, "", { system: true, kind: "seal_rift_gate", map: "thornveil", text: "รอยแยกจะปิดในอีก 60 นาที ต้องมีปาร์ตี้อย่างน้อย 2 คน" }, ""),
    demoMsg("w5", 11, "Runeleaf", { text: "เจอประตู Seal Rift ที่ป่าธอร์นเวล หาปาร์ตี้ ขาดสายฮีล 1" }),
    demoMsg("w6", 4, "ShadowFang", { text: "ไปด้วย! มีดคู่สายพิษ รอที่ประตูนะ" })
  ]);
}
function fillDemoMap() {
  addMessages("map", [
    demoMsg("m-" + state.mapId + "-1", 9, "Lumen", { text: `แคมป์ทางเหนือของ${mapLabel(state.mapId)}เกิดใหม่แล้ว` }),
    demoMsg("m-" + state.mapId + "-2", 2, "Brakka", { text: "Elite โผล่ข้างแม่น้ำ ใครว่างมาช่วยตีหน่อย" })
  ]);
  if (state.tab === "map") renderLog();
}

// ---------------------------------------------------------------- boot

function wireUi() {
  $("signinForm").addEventListener("submit", onSignIn);
  $("signOutBtn").addEventListener("click", () => signOut());
  for (const b of document.querySelectorAll(".tab")) b.addEventListener("click", () => selectTab(b.dataset.tab));
  const sel = $("mapSelect");
  for (const m of cfg.maps) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = `${m.th} · ${m.en}`;
    sel.append(o);
  }
  sel.value = state.mapId;
  sel.addEventListener("change", () => selectMap(sel.value));
  $("composer").addEventListener("submit", onSend);
  const input = $("msgInput");
  input.addEventListener("input", updateCounter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("composer").requestSubmit(); }
  });
  $("log").addEventListener("scroll", () => { if (nearBottom()) $("jumpBtn").hidden = true; }, { passive: true });
  $("jumpBtn").addEventListener("click", scrollToBottom);
  $("signUpRow").hidden = !cfg.allowSignUp;
  window.addEventListener("online", () => { if (state.session && !state.socket) connect(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.session && !state.socket && !state.connecting) connect();
  });
  updateCounter();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && !isPrivateHost(location.hostname)) return;
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((e) => console.warn("sw", e));
}

async function boot() {
  wireUi();
  setupInstallHint();
  registerServiceWorker();

  if (DEMO) {
    const flag = el("span", "demo-flag", "ตัวอย่าง");
    document.querySelector(".top h1").append(flag);
    fillDemoWorld();
    fillDemoMap();
    show("chat");
    selectTab(state.tab);
    setStatus("โหมดตัวอย่าง · ไม่ได้ต่อเซิร์ฟเวอร์", "warn");
    return;
  }

  if (!isConfigured(cfg)) {
    $("configNotice").hidden = false;
    $("signinBtn").disabled = true;
    show("signin");
    setStatus("ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์", "warn");
    return;
  }

  try {
    await loadNakama();
  } catch (e) {
    console.warn("nakama-js load failed", e);
    show("signin");
    $("signinBtn").disabled = true;
    signinError("โหลดตัวเชื่อมต่อแชตไม่ได้ ตรวจอินเทอร์เน็ตแล้วเปิดแอปใหม่");
    setStatus("ออฟไลน์", "warn");
    return;
  }

  const saved = store.get(KEY_SESSION);
  if (saved) {
    try {
      const { token, refresh_token } = JSON.parse(saved);
      state.session = state.nk.Session.restore(token, refresh_token);
      if (state.session.isrefreshexpired(Date.now() / 1000 + 10)) throw new Error("expired");
      enterChat();
      return;
    } catch {
      store.del(KEY_SESSION);
      state.session = null;
    }
  }
  show("signin");
  setStatus("ยังไม่ได้เข้าสู่ระบบ");
}

boot();
