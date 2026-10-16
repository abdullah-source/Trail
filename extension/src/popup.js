import { APP_ORIGIN } from "./config.js";

const $ = (id) => document.getElementById(id);
const send = (m) => new Promise((r) => chrome.runtime.sendMessage(m, (x) => r(x && x.ok ? x.result : x)));
// The optional permission behind "Know where pastes come from" (see background.js syncCopytrack).
const ALL_SITES = { origins: ["https://*/*", "http://*/*"] };

// ---- first open: nothing records until the student presses "Start recording" -------------------------
async function showConsent(note) {
  $("main").hidden = true;
  $("consent").hidden = false;
  $("dot").className = "dot";
  if (note) $("consent").querySelector("p").textContent = note;
  $("start").onclick = async () => {
    $("start").disabled = true;
    await send({ type: "consent.set", granted: true });
    location.reload();   // re-open as the recording popup
  };
  $("notnow").onclick = () => window.close();
}

async function showMain() {
  $("consent").hidden = true;
  $("main").hidden = false;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = $("status"), dot = $("dot"), stats = $("stats");
  let host = null;
  try { host = new URL(tab.url).host; } catch {}
  const bg = (await send({ type: "status.bg" })) || { connected: false, paused: [] };
  const paused = new Set(bg.paused || []);
  $("conn").textContent = bg.connected ? "Connected to your account. Checkpoints are signed every 10 minutes." : "Not connected yet: open your writing record and sign in.";

  let st = null;
  try { st = await chrome.tabs.sendMessage(tab.id, { type: "status" }); } catch {}
  // Screen time for homework: what this page is and how long it has been worked on today (local only).
  let pr = null;
  try { pr = await chrome.tabs.sendMessage(tab.id, { type: "presence.status" }); } catch {}
  if (pr && pr.context) {
    const c = pr.context;
    const today = (await send({ type: "presence.today", item_key: c.item_key, editor_doc: c.editor_doc })) || { active_ms: 0 };
    const ms = (today.active_ms || 0) + (pr.pending_ms || 0);
    const mins = Math.round(ms / 60000);
    const fmt = mins < 1 ? "under a minute today" : mins < 60 ? `${mins} min today` : `${Math.floor(mins / 60)} h ${mins % 60} min today`;
    const where = c.course_label && c.course_label !== c.item_label ? ` (${c.course_label})` : "";
    $("work").textContent = `Working on: ${c.item_label || c.course_label || "this page"}${where} · ${fmt}`;
    $("work").hidden = false;
  }
  const renderPause = () => {
    if (!host || !(st || (pr && pr.context))) return;
    const p = paused.has(host);
    $("pause").hidden = false;
    $("pause").textContent = p ? `Resume recording on ${host}` : `Pause recording on ${host}`;
    dot.classList.toggle("paused", p); dot.classList.toggle("on", !p && ((st && st.recording) || !!(pr && pr.context)));
    if (p) status.textContent = `Paused on ${host}. Nothing is recorded here until you resume.`;
  };
  if (st && st.recording) {
    dot.classList.add("on");
    status.textContent = `Recording in ${st.editor}. Everything stays on this device.`;
    const since = st.since ? new Date(st.since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
    stats.innerHTML = `<div class="row"><span class="k">Recording since</span><span>${since || "your next keystroke"}</span></div><div class="row"><span class="k">Characters now</span><span>${st.chars.toLocaleString()}</span></div>`;
    $("note").hidden = false; $("noteBtn").hidden = false;
    $("noteBtn").onclick = async () => {
      const note = $("note").value.trim(); if (!note) return;
      const [tool, ...rest] = note.split(":");
      await send({ type: "ai.note", doc: st.doc, tool: tool.trim(), note: rest.join(":").trim() || note });
      $("note").value = ""; status.textContent = "Note added to the record.";
    };
    renderPause();
  } else if (pr && pr.context) {
    status.textContent = "Keeping time on this page. Everything stays on this device.";
    renderPause();
  } else {
    status.textContent = "Recording is on. This page is not an editor Trail records. Supported: Google Docs, Notion, Word Online, Canvas, Moodle, Blackboard, Brightspace.";
  }
  $("pause").onclick = async () => {
    const r = await send({ type: "pause", host, paused: !paused.has(host) });
    paused.clear(); for (const h of r.paused || []) paused.add(h);
    renderPause();
  };
  // ?ext= tells the web app this extension's id (unpacked builds have a random one); it stores it locally.
  $("open").onclick = () => chrome.tabs.create({ url: `${APP_ORIGIN}/app?ext=${chrome.runtime.id}` });
  $("cp").onclick = async () => {
    status.textContent = "Signing…";
    const res = await send({ type: "checkpointAll" });
    if (res && res.skipped) status.textContent = "Not connected: open your writing record and sign in first.";
    else if (Array.isArray(res) && res.some((r) => r.error)) status.textContent = res.find((r) => r.error).error;
    else status.textContent = Array.isArray(res) && res.some((r) => r.created) ? "Checkpoint signed." : "Nothing new to sign.";
  };

  // Paste sources on every site: an optional permission, asked for only when the student turns it on.
  // permissions.request must run straight from the click; the popup may close while Chrome asks, so
  // the background registers or unregisters the copy script itself when the permission changes.
  const anysite = $("anysite");
  anysite.checked = await chrome.permissions.contains(ALL_SITES);
  anysite.onchange = () => {
    const want = anysite.checked;
    const done = (ok) => { anysite.checked = want ? !!ok : !ok; send({ type: "copytrack.sync" }); };
    if (want) chrome.permissions.request(ALL_SITES).then(done, () => done(false));
    else chrome.permissions.remove(ALL_SITES).then(done, () => done(false));
  };

  $("stop").onclick = async () => {
    $("stop").disabled = true;
    await send({ type: "consent.set", granted: false });
    showConsent("Recording is off on this computer. Nothing new is recorded until you start it again; what was recorded before stays here until you delete it in the app.");
  };
}

(async () => {
  const c = await send({ type: "consent.get" });
  if (c && c.granted) await showMain();
  else await showConsent();
})();
