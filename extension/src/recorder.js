// Records how a document is written. Runs inside supported editors.
// Keystrokes are batched (text + timing), pastes carry a hash-matched source,
// and periodic snapshots let the record be verified against the real text.
(() => {
  if (window.__trailRecorder) return;
  window.__trailRecorder = true;

  const host = location.host;
  const IDLE_SESSION_MS = 30 * 60_000;
  const BATCH_GAP_MS = 1500;
  const SNAPSHOT_MS = 3 * 60_000;

  // ---- editor adapters ---------------------------------------------------
  function docIdFromUrl() {
    const p = location.pathname;
    if (host === "docs.google.com") { const m = p.match(/\/document\/d\/([^/]+)/); return m ? "gdoc:" + m[1] : null; }
    if (host.endsWith("notion.so") || host.endsWith("notion.site")) { const m = p.match(/([0-9a-f]{32})/); return m ? "notion:" + m[1] : null; }
    if (host.includes("officeapps.live.com") || host === "word.cloud.microsoft" || host.endsWith("sharepoint.com")) {
      const u = new URL(location.href); const id = u.searchParams.get("sourcedoc") || u.searchParams.get("wdOrigin") || p; return "word:" + id;
    }
    return "page:" + host + p;
  }
  function editorName() {
    if (host === "docs.google.com") return "docs";
    if (host.includes("notion")) return "notion";
    if (host.includes("officeapps") || host === "word.cloud.microsoft" || host.endsWith("sharepoint.com")) return "word";
    return "generic";
  }
  function findRoot() {
    if (host === "docs.google.com") {
      const f = document.querySelector(".docs-texteventtarget-iframe");
      return f && f.contentDocument ? f.contentDocument.body : null;
    }
    if (host.includes("notion")) return document.querySelector(".notion-page-content") || document.querySelector("[contenteditable='true']");
    return document.querySelector("#WACViewPanel_EditingElement") || document.querySelector("[contenteditable='true']") || document.querySelector("textarea");
  }
  const editor = editorName();
  const docId = docIdFromUrl();
  if (!docId) return;
  const positionsKnown = editor !== "docs";

  // ---- text and offsets ----------------------------------------------------
  function rootText(root) {
    if (!root) return "";
    if (root.tagName === "TEXTAREA") return root.value;
    return root.innerText.replace(/\r\n/g, "\n");
  }
  function caretOffset(root) {
    if (!positionsKnown) return -1;
    if (root.tagName === "TEXTAREA") return root.selectionStart;
    const sel = root.ownerDocument.getSelection();
    if (!sel || sel.rangeCount === 0) return -1;
    const r = sel.getRangeAt(0).cloneRange();
    r.setStart(root, 0);
    r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return r.toString().replace(/\r\n/g, "\n").length;
  }

  // ---- state -------------------------------------------------------------------
  let root = null;
  let model = "";                 // our reconstruction of the text from recorded ops
  let batch = null;               // {kind, pos, text|len, dts, t0, tLast}
  let lastActivity = 0;
  let sessionOpen = false;
  let lastSnapshot = 0;

  function send(msg) { try { chrome.runtime.sendMessage({ ...msg, doc: docId, editor, host }); } catch {} }

  function flush() {
    if (!batch) return;
    const b = batch; batch = null;
    if (b.kind === "insert") send({ type: "event", kind: "insert", ts: b.t0, data: { pos: b.pos, text: b.text, origin: "typed", dts: b.dts } });
    else send({ type: "event", kind: "delete", ts: b.t0, data: { pos: b.pos, len: b.len, dts: b.dts } });
  }
  function ensureSession() {
    const now = Date.now();
    if (!sessionOpen || now - lastActivity > IDLE_SESSION_MS) {
      if (sessionOpen) send({ type: "session.end", reason: "idle" });
      send({ type: "session.start", data: { editor, host, title_hash: null, goal_words: null, goal_minutes: null } });
      sessionOpen = true;
      model = rootText(root);
      if (model) send({ type: "event", kind: "resync", ts: now, data: { text: model } });
    }
    lastActivity = now;
  }
  function applyModel(kind, pos, arg) {
    if (pos < 0) pos = model.length;
    if (kind === "insert") model = model.slice(0, pos) + arg + model.slice(pos);
    else model = model.slice(0, pos) + model.slice(pos + arg);
  }

  // ---- events --------------------------------------------------------------------
  function onBeforeInput(e) {
    if (!root) return;
    ensureSession();
    const now = Date.now();
    const t = e.inputType || "";
    const pos = caretOffset(root);
    if (t === "insertFromPaste" || t === "insertFromDrop") {
      flush();
      const text = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || (e.data || "");
      if (!text) return;
      send({ type: "paste", ts: now, data: { pos, text } });
      applyModel("insert", pos, text);
      return;
    }
    if (t.startsWith("insert")) {
      const text = t === "insertParagraph" || t === "insertLineBreak" ? "\n" : (e.data || "");
      if (!text) return;
      if (batch && batch.kind === "insert" && now - batch.tLast < BATCH_GAP_MS && (pos < 0 || pos === batch.pos + batch.text.length)) {
        batch.dts.push(now - batch.tLast); batch.text += text; batch.tLast = now;
      } else {
        flush(); batch = { kind: "insert", pos, text, dts: [0], t0: now, tLast: now };
      }
      applyModel("insert", pos, text);
      return;
    }
    if (t.startsWith("delete")) {
      let len = 1, at = pos;
      const sel = root.ownerDocument.getSelection();
      if (root.tagName === "TEXTAREA") { len = Math.max(1, root.selectionEnd - root.selectionStart); at = t.endsWith("Backward") && len === 1 ? pos - 1 : pos; }
      else if (sel && !sel.isCollapsed) { len = sel.toString().length; }
      else if (t.endsWith("Backward")) { at = pos - 1; }
      if (at < 0 && positionsKnown) at = 0;
      if (batch && batch.kind === "delete" && now - batch.tLast < BATCH_GAP_MS && len === 1 && (at < 0 || at === batch.pos - 1)) {
        batch.dts.push(now - batch.tLast); batch.pos = at; batch.len += 1; batch.tLast = now;
      } else {
        flush(); batch = { kind: "delete", pos: at, len, dts: [0], t0: now, tLast: now };
      }
      applyModel("delete", at, len);
    }
  }
  // Google Docs does not fire beforeinput on its hidden iframe reliably; fall back to keydown/paste there.
  function onKeyDown(e) {
    if (editor !== "docs" || !root) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    ensureSession();
    const now = Date.now();
    if (e.key.length === 1 || e.key === "Enter") {
      const text = e.key === "Enter" ? "\n" : e.key;
      if (batch && batch.kind === "insert" && now - batch.tLast < BATCH_GAP_MS) { batch.dts.push(now - batch.tLast); batch.text += text; batch.tLast = now; }
      else { flush(); batch = { kind: "insert", pos: -1, text, dts: [0], t0: now, tLast: now }; }
      applyModel("insert", -1, text);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      if (batch && batch.kind === "delete" && now - batch.tLast < BATCH_GAP_MS) { batch.dts.push(now - batch.tLast); batch.len += 1; batch.tLast = now; }
      else { flush(); batch = { kind: "delete", pos: -1, len: 1, dts: [0], t0: now, tLast: now }; }
      applyModel("delete", -1, 1);
    }
  }
  function onPasteDocs(e) {
    if (editor !== "docs") return;
    ensureSession();
    const text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!text) return;
    flush();
    send({ type: "paste", ts: Date.now(), data: { pos: -1, text } });
    applyModel("insert", -1, text);
  }
  function snapshot(force) {
    if (!root || !sessionOpen) return;
    const now = Date.now();
    if (!force && now - lastSnapshot < SNAPSHOT_MS) return;
    lastSnapshot = now;
    flush();
    const actual = rootText(root);
    if (positionsKnown && actual !== model) {
      // Something changed that we did not observe (undo, collaborator, autocorrect). Resync.
      send({ type: "event", kind: "resync", ts: now, data: { text: actual } });
      model = actual;
    }
    send({ type: "snapshot", ts: now, text: positionsKnown ? actual : model, title: (document.title || "").replace(/ [-–] (Google Docs|Notion|Word)$/, "").slice(0, 200) || null });
  }
  function attach() {
    const r = findRoot();
    if (!r || r === root) return;
    root = r;
    const d = root.ownerDocument;
    d.addEventListener("beforeinput", onBeforeInput, true);
    d.addEventListener("keydown", onKeyDown, true);
    d.addEventListener("paste", onPasteDocs, true);
    d.addEventListener("blur", () => { flush(); send({ type: "event", kind: "focus", ts: Date.now(), data: { state: "blur" } }); }, true);
    d.addEventListener("focus", () => send({ type: "event", kind: "focus", ts: Date.now(), data: { state: "focus" } }), true);
  }
  attach();
  setInterval(attach, 3000);
  setInterval(() => { flush(); snapshot(false); }, 20_000);
  window.addEventListener("beforeunload", () => { flush(); snapshot(true); if (sessionOpen) send({ type: "session.end", reason: "unload" }); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { flush(); snapshot(true); } });
  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m.type === "status") reply({ recording: !!root, doc: docId, editor, chars: model.length, session: sessionOpen });
  });
})();
