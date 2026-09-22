// IndexedDB: everything stays on the device. Stores: events, sessions, docs, snapshots, checkpoints.
// docs are keyed by a random id the extension mints; the editor's own id lives only in docs.editorId.
const NAME = "trail";
const VERSION = 2;
let dbp = null;

export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        const ev = db.createObjectStore("events", { keyPath: ["session", "seq"] });
        ev.createIndex("doc", "doc");
        ev.createIndex("session", "session");
        db.createObjectStore("sessions", { keyPath: "id" }).createIndex("doc", "doc");
        db.createObjectStore("docs", { keyPath: "id" });
        db.createObjectStore("snapshots", { keyPath: ["doc", "ts"] }).createIndex("doc", "doc");
        db.createObjectStore("checkpoints", { keyPath: ["doc", "seq"] }).createIndex("doc", "doc");
      }
      if (e.oldVersion < 2) req.transaction.objectStore("docs").createIndex("editorId", "editorId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : r);
    t.onerror = () => reject(t.error);
  });
}

export async function put(store, value) { return tx(await open(), store, "readwrite", (s) => s.put(value)); }
export async function get(store, key) {
  const db = await open();
  return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function all(store) {
  const db = await open();
  return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function byIndex(store, index, key) {
  const db = await open();
  return new Promise((res, rej) => { const r = db.transaction(store).objectStore(store).index(index).getAll(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function clearAll() {
  const db = await open();
  for (const s of ["events", "sessions", "docs", "snapshots", "checkpoints"]) await tx(db, s, "readwrite", (st) => st.clear());
}
