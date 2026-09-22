import { makeEvent, sha256Hex, nowTs, uuid, GENESIS } from "./chain.js";
import * as db from "./db.js";
import { APP_ORIGIN, ALLOWED_ORIGINS } from "./config.js";

// ---- per-doc chain state (service worker may restart; heads are persisted) ----
const sessions = new Map();   // docId -> {id, seq, head}
let lastCopy = null;          // {host, hash, len, ts, tab}
const AI_HOSTS = ["chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "bard.google.com", "copilot.microsoft.com", "perplexity.ai", "www.perplexity.ai", "poe.com", "character.ai", "grok.com", "x.ai", "mistral.ai", "chat.mistral.ai", "deepseek.com", "chat.deepseek.com", "you.com", "writesonic.com", "jasper.ai", "app.jasper.ai", "quillbot.com", "grammarly.com", "app.grammarly.com", "undetectable.ai", "phrasly.ai", "humanizeai.pro"];

function classify(host, fromSelf) {
  if (fromSelf) return "self";
  if (!host) return "unknown";
  const h = host.toLowerCase();
  return AI_HOSTS.some((a) => h === a || h.endsWith("." + a)) ? "ai" : "web";
}

const words = (text) => text.split(/\s+/).filter(Boolean).length;

// ---- document ids: the editor's id (gdoc:..., notion:..., page:host/path) never leaves this device.
// Every document gets a random id, minted once and stored locally; events, checkpoints and the
// web app all use that id. The server only ever sees random ids.
const aliases = new Map();   // editorId -> random id
async function resolveDoc(editorId, editor, host) {
  if (!editorId) return editorId;
  if (aliases.has(editorId)) return aliases.get(editorId);
  let doc = (await db.byIndex("docs", "editorId", editorId))[0];
  if (!doc) {
    doc = { id: "tr_" + uuid().replace(/-/g, ""), editorId, editor, host, title: null, created: nowTs(), events: 0, typed: 0, pasted: 0, deleted: 0, words: 0 };
    await db.put("docs", doc);
  }
  aliases.set(editorId, doc.id);
  return doc.id;
}

async function pausedHosts() {
  return new Set((await chrome.storage.local.get("paused")).paused || []);
}

async function loadSession(docId) {
  if (sessions.has(docId)) return sessions.get(docId);
  const d = await db.get("docs", docId);
  if (d && d.openSession) {
    const s = await db.get("sessions", d.openSession);
    if (s && !s.ended) { sessions.set(docId, { id: s.id, seq: s.seq, head: s.head }); return sessions.get(docId); }
  }
  return null;
}

async function startSession(docId, editor, host, data, ts) {
  const id = uuid();
  const s = { id, seq: 0, head: GENESIS };
  sessions.set(docId, s);
  await db.put("sessions", { id, doc: docId, editor, host, started: nowTs(new Date(ts)), seq: 0, head: GENESIS, ended: false });
  const doc = (await db.get("docs", docId)) || { id: docId, editor, host, title: null, created: nowTs(), events: 0, typed: 0, pasted: 0, deleted: 0, words: 0 };
  doc.openSession = id; doc.lastSeen = nowTs();
  await db.put("docs", doc);
  await append(docId, "session.start", data, ts);
  return s;
}

async function append(docId, kind, data, tsMs) {
  const s = sessions.get(docId);
  if (!s) return null;
  const ev = await makeEvent({ session: s.id, doc: docId, seq: s.seq, kind, data, prev: s.head, ts: nowTs(new Date(tsMs || Date.now())) });
  s.seq += 1; s.head = ev.hash;
  await db.put("events", ev);
  const sess = await db.get("sessions", s.id);
  if (sess) { sess.seq = s.seq; sess.head = s.head; sess.first_ts = sess.first_ts || ev.ts; sess.last = ev.ts; await db.put("sessions", sess); }
  const doc = await db.get("docs", docId);
  if (doc) {
    doc.events = (doc.events || 0) + 1; doc.lastSeen = ev.ts; doc.firstSeen = doc.firstSeen || ev.ts;
    if (kind === "insert") doc.typed = (doc.typed || 0) + data.text.length;
    if (kind === "paste") doc.pasted = (doc.pasted || 0) + data.text.length;
    if (kind === "delete") doc.deleted = (doc.deleted || 0) + data.len;
    if (kind === "snapshot") doc.words = data.words;
    doc.dirty = true;
    await db.put("docs", doc);
  }
  return ev;
}

async function endSession(docId, reason, tsMs) {
  const s = sessions.get(docId) || (await loadSession(docId));
  if (!s) return;
  sessions.set(docId, s);
  await append(docId, "session.end", { reason }, tsMs);
  const sess = await db.get("sessions", s.id);
  if (sess) { sess.ended = true; await db.put("sessions", sess); }
  const doc = await db.get("docs", docId);
  if (doc) { doc.openSession = null; await db.put("docs", doc); }
  sessions.delete(docId);
}

// ---- messages from content scripts and the popup ------------------------------------------------
// Messages from one page arrive in order but were handled concurrently, so a session.start
// and the first event could race and mint two sessions (or two doc ids). Handle them one at a time.
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  const job = async () => {
    if (m.type === "copy") { lastCopy = { host: m.host, hash: m.hash, len: m.len, ts: m.ts, tab: sender.tab && sender.tab.id }; return; }
    if (m.type === "checkpointAll") return checkpointAll();
    if (m.type === "status.bg") { const { token } = await chrome.storage.local.get("token"); return { connected: !!token, paused: [...(await pausedHosts())] }; }
    if (m.type === "pause") {
      const p = await pausedHosts();
      if (m.paused) p.add(m.host); else p.delete(m.host);
      await chrome.storage.local.set({ paused: [...p] });
      return { paused: [...p] };
    }
    if (m.host && (await pausedHosts()).has(m.host)) return;  // per-site pause: nothing is recorded
    m.doc = await resolveDoc(m.doc, m.editor, m.host);
    if (m.type === "session.start") { await endSession(m.doc, "restart", Date.now()); await startSession(m.doc, m.editor, m.host, m.data, Date.now()); return; }
    if (m.type === "session.end") { await endSession(m.doc, m.reason || "completed", Date.now()); return; }
    if (!sessions.has(m.doc)) { const s = await loadSession(m.doc); if (!s) await startSession(m.doc, m.editor, m.host, { editor: m.editor, host: m.host, title_hash: null, goal_words: null, goal_minutes: null }, m.ts || Date.now()); }
    if (m.type === "event") { await append(m.doc, m.kind, m.data, m.ts); return; }
    if (m.type === "paste") {
      const h = await sha256Hex(m.data.text);
      const fromSelf = !!(lastCopy && lastCopy.hash === h && sender.tab && lastCopy.tab === sender.tab.id);
      const srcHost = lastCopy && lastCopy.hash === h ? lastCopy.host : null;
      await append(m.doc, "paste", { paste_id: uuid(), pos: m.data.pos, text: m.data.text, source_host: srcHost, source_kind: classify(srcHost, fromSelf), from_self: fromSelf }, m.ts);
      return;
    }
    if (m.type === "snapshot") {
      const text = m.text || "";
      const hash = await sha256Hex(text);
      await append(m.doc, "snapshot", { text_hash: hash, chars: text.length, words: words(text), lines: text.split("\n").length }, m.ts);
      await db.put("snapshots", { doc: m.doc, ts: nowTs(new Date(m.ts)), text });
      if (m.title) { const doc = await db.get("docs", m.doc); if (doc && doc.title !== m.title) { doc.title = m.title; await db.put("docs", doc); } }
      return;
    }
    if (m.type === "ai.note") { await append(m.doc, "ai.note", { tool: m.tool, note: m.note }, Date.now()); return; }
  };
  queue = queue.then(job, job).then((result) => reply && reply({ ok: true, result }), (e) => reply && reply({ ok: false, error: String(e) }));
  return true;
});

// ---- messages from the web app (externally_connectable) ------------------------------------------
// Events never leave this device except through this channel to the Trail page itself.
function originOf(sender) {
  if (sender.origin) return sender.origin;
  try { return new URL(sender.url).origin; } catch { return null; }
}

async function listDocs() {
  const docs = await db.all("docs");
  const out = [];
  for (const d of docs) {
    const sess = await db.byIndex("sessions", "doc", d.id);
    out.push({ id: d.id, title: d.title || null, editor: d.editor || "generic", firstSeen: d.firstSeen || d.created, lastSeen: d.lastSeen || d.created,
               typed: d.typed || 0, pasted: d.pasted || 0, deleted: d.deleted || 0, events: d.events || 0, sessions: sess.length, words: d.words || 0 });
  }
  return out;
}

async function getEvents(docId) {
  const evs = await db.byIndex("events", "doc", docId);
  return evs.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));
}

async function getCheckpoints(docId) {
  return (await db.byIndex("checkpoints", "doc", docId)).sort((a, b) => a.seq - b.seq).map((c) => ({ body: c.body, signature: c.signature, key_id: c.key_id, hash: c.hash }));
}

async function addAiNote(docId, tool, note) {
  if (!sessions.has(docId) && !(await loadSession(docId))) {
    const doc = await db.get("docs", docId);
    if (!doc) throw new Error("unknown document");
    await startSession(docId, doc.editor, doc.host, { editor: doc.editor, host: doc.host, title_hash: null, goal_words: null, goal_minutes: null }, Date.now());
  }
  await append(docId, "ai.note", { tool, note }, Date.now());
}

chrome.runtime.onMessageExternal.addListener((m, sender, reply) => {
  const origin = originOf(sender);
  if (!ALLOWED_ORIGINS.includes(origin)) { reply({ ok: false, error: `origin ${origin} is not allowed` }); return false; }
  (async () => {
    switch (m && m.type) {
      case "status": {
        const { token } = await chrome.storage.local.get("token");
        return { version: chrome.runtime.getManifest().version, connected: !!token, recording: sessions.size > 0 };
      }
      case "listDocs": case "getEssays": return listDocs();
      case "getEvents": return getEvents(m.doc);
      case "getCheckpoints": return getCheckpoints(m.doc);
      case "setToken": {
        if (m.token) await chrome.storage.local.set({ token: m.token, server: (m.server || origin).replace(/\/$/, "") });
        else await chrome.storage.local.remove(["token", "server"]);
        return { connected: !!m.token };
      }
      case "addAiNote": await addAiNote(m.doc, m.tool, m.note); return null;
      case "checkpoint": {
        const r = await checkpointAll(m.doc);
        const row = Array.isArray(r) ? r.find((x) => x.doc === m.doc) : null;
        if (r && r.skipped) throw new Error("Not connected: open Settings and connect the extension first.");
        if (row && row.error) throw new Error(row.error);
        return { created: !!(row && row.created) };
      }
      case "clearAll": await db.clearAll(); sessions.clear(); return null;
      default: throw new Error(`unknown message type ${m && m.type}`);
    }
  })().then((result) => reply({ ok: true, result })).catch((e) => reply({ ok: false, error: e && e.message ? e.message : String(e) }));
  return true;
});

// ---- first run: open the welcome page -------------------------------------------------------------
chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === "install") chrome.tabs.create({ url: `${APP_ORIGIN}/app/welcome` });
});

// ---- source visits: which sites were open while a document session is active ----
let activeTab = null, activeSince = 0;
async function noteVisit() {
  if (!activeTab || !activeTab.url) return;
  const dwell = Date.now() - activeSince;
  if (dwell < 5000) return;
  let host; try { host = new URL(activeTab.url).host; } catch { return; }
  for (const [docId] of sessions) await append(docId, "source.visit", { host, dwell_ms: dwell }, Date.now());
}
chrome.tabs.onActivated.addListener(async ({ tabId }) => { await noteVisit(); try { activeTab = await chrome.tabs.get(tabId); } catch { activeTab = null; } activeSince = Date.now(); });

// ---- checkpoints: every 10 minutes, send chain heads (never text) to the signing service ----
chrome.alarms.create("checkpoint", { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener(async (a) => { if (a.name === "checkpoint") await checkpointAll(); });

export async function checkpointAll(onlyDoc) {
  const { server, token } = await chrome.storage.local.get(["server", "token"]);
  if (!server || !token) return { skipped: "not signed in" };
  const docs = await db.all("docs");
  const out = [];
  for (const doc of docs) {
    if (onlyDoc ? doc.id !== onlyDoc : !doc.dirty) continue;
    const sess = await db.byIndex("sessions", "doc", doc.id);
    const heads = {};
    for (const s of sess) if (s.seq > 0) heads[s.id] = { seq: s.seq - 1, hash: s.head, first_ts: s.first_ts || s.started };
    if (!Object.keys(heads).length) continue;
    try {
      // chain heads and the random document id only: no title, no editor id, no text
      const r = await fetch(server + "/v1/checkpoint", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ doc: doc.id, heads }) });
      if (r.status === 401) { await chrome.storage.local.remove(["token"]); out.push({ doc: doc.id, error: "Signed out: reconnect the extension from Settings." }); continue; }
      const j = await r.json();
      if (!r.ok) { out.push({ doc: doc.id, error: typeof j.detail === "string" ? j.detail : `HTTP ${r.status}` }); continue; }
      if (j.created && j.checkpoint) { await db.put("checkpoints", { doc: doc.id, seq: j.checkpoint.body.seq, ...j.checkpoint }); }
      doc.dirty = false; doc.lastCheckpoint = nowTs(); await db.put("docs", doc);
      out.push({ doc: doc.id, created: !!j.created });
    } catch (e) { out.push({ doc: doc.id, error: String(e) }); }
  }
  return out;
}
