// Runs on every page: remembers what was last copied (host + hash of text), never the text itself.
(() => {
  async function digest(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function onCopy(e) {
    let text = "";
    try { text = (document.getSelection() || "").toString(); } catch {}
    if (!text) return;
    const h = await digest(text);
    try { chrome.runtime.sendMessage({ type: "copy", host: location.host, hash: h, len: text.length, ts: Date.now() }); } catch {}
  }
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("cut", onCopy, true);
})();
