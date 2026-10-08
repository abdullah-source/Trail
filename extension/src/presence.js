// Screen time for homework: how long you actively work on each class and assignment.
// Active = this tab is visible AND you touched the keyboard, mouse, wheel or screen within the
// last 60 s. Accumulated active time is sent to the background every 30 s and when the tab is
// hidden or closed; the background stores it in a local work log that never leaves the device.
// Context (which course / assignment) comes from context.js, injected just before this script.
(() => {
  if (window !== window.top) return;           // top frame only
  if (window.__trailPresence) return;
  window.__trailPresence = true;
  const detect = globalThis.TrailContext && globalThis.TrailContext.detectContext;
  if (!detect) return;

  // Tests shorten the heartbeat with ?trail_fast_ms=<ms> (content scripts cannot see page globals).
  let fastMs = 0;
  try { fastMs = Number(new URL(location.href).searchParams.get("trail_fast_ms")) || 0; } catch {}
  const HEARTBEAT_MS = fastMs > 0 ? fastMs : 30_000;
  const IDLE_MS = 60_000;
  const TICK_MS = 1000;
  const host = location.host;

  // ---- which page is this? -------------------------------------------------------------------
  const CRUMB_CONTAINERS = ["#breadcrumbs", "nav[aria-label*='readcrumb' i]", "d2l-breadcrumbs", ".d2l-breadcrumbs", "bb-breadcrumbs", "ol.breadcrumb", ".breadcrumb", ".breadcrumbs"];
  function breadcrumbs() {
    for (const sel of CRUMB_CONTAINERS) {
      let box; try { box = document.querySelector(sel); } catch { continue; }
      if (!box) continue;
      let items = [...box.querySelectorAll("li, d2l-breadcrumb")];
      if (!items.length) items = [...box.querySelectorAll("a")];
      const out = items.map((el) => {
        const a = el.tagName === "A" ? el : el.querySelector("a");
        return { text: (el.getAttribute("text") || el.textContent || "").replace(/\s+/g, " ").trim(), href: (a && a.getAttribute("href")) || el.getAttribute("href") || null };
      }).filter((c) => c.text);
      if (out.length) return out;
    }
    return [];
  }
  function heading() {
    for (const sel of ["h1.title", ".page-header-headings h1", "h1", "h2.page-title", ".assignment-title h1, .assignment-title h2", "h2"]) {
      let el; try { el = document.querySelector(sel); } catch { continue; }
      const t = el && (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t) return t.slice(0, 200);
    }
    return "";
  }
  function currentContext() {
    try { return detect(location.href, document.title, breadcrumbs(), heading()); } catch { return null; }
  }

  // ---- activity ---------------------------------------------------------------------------------
  let ctx = currentContext();
  let lastInput = 0;
  let lastTick = Date.now();
  let acc = 0;                 // active ms not yet sent
  let sentToday = 0;           // active ms sent since this page loaded (popup shows it with the stored total)
  const touch = () => { lastInput = Date.now(); };
  for (const ev of ["keydown", "mousedown", "mousemove", "wheel", "scroll", "touchstart", "touchmove", "pointerdown"]) {
    window.addEventListener(ev, touch, { capture: true, passive: true });
  }

  function send(active_ms) {
    if (!ctx || active_ms <= 0) return;
    const msg = { type: "presence", host, editor: ctx.editor, kind: ctx.kind, course_key: ctx.course_key, course_label: ctx.course_label, item_key: ctx.item_key, item_label: ctx.item_label, editor_doc: ctx.editor_doc || null, active_ms: Math.round(active_ms), ts: Date.now() };
    try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch {}
    sentToday += active_ms;
  }
  function flush() { if (acc > 0) { send(acc); acc = 0; } }

  function tick() {
    const now = Date.now();
    const dt = Math.min(now - lastTick, TICK_MS * 2);   // a throttled background tab must not inflate the count
    lastTick = now;
    // SPA navigation (Canvas, Notion, Brightspace): the item changed under us; close the old stint first.
    const next = currentContext();
    const same = !!ctx && !!next && ctx.item_key === next.item_key && ctx.course_key === next.course_key;
    if (!same) { flush(); sentToday = 0; }
    if (next && same) { next.item_label = next.item_label || ctx.item_label; next.course_label = next.course_label || ctx.course_label; }
    ctx = next;
    if (!ctx) return;
    const active = document.visibilityState === "visible" && lastInput && now - lastInput < IDLE_MS;
    if (active) acc += dt;
    if (acc >= HEARTBEAT_MS) flush();
  }
  setInterval(tick, TICK_MS);
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);

  // The popup asks what this page is and how much has been counted here since it loaded.
  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m && m.type === "presence.status") { reply({ context: ctx, pending_ms: Math.round(acc), page_ms: Math.round(sentToday + acc) }); }
  });
})();
