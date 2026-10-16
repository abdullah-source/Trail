// Remembers what was last copied (host + SHA-256 of the text, never the text itself), so a later
// paste into a recorded document can say where it came from.
// Runs on the supported editor and LMS sites (manifest content_scripts) and, only when the student
// turns on "Know where pastes come from" in the popup and grants the optional all-sites permission,
// on every site (registered at runtime by background.js). Nothing is sent before recording consent.
(() => {
  if (window.__trailCopytrack) return;   // the static and the runtime registration may both match
  window.__trailCopytrack = true;
  async function digest(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function consented() {
    try { return !!(await chrome.storage.local.get("consent")).consent; } catch { return false; }
  }
  async function onCopy() {
    let text = "";
    try { text = (document.getSelection() || "").toString(); } catch {}
    if (!text || !(await consented())) return;
    const h = await digest(text);
    try { chrome.runtime.sendMessage({ type: "copy", host: location.host, hash: h, len: text.length, ts: Date.now() }, () => void chrome.runtime.lastError); } catch {}
  }
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("cut", onCopy, true);
})();
