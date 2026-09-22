// Bridge to the Trail Chrome extension over chrome.runtime.sendMessage(EXTENSION_ID, ...)
// (externally_connectable). Events never touch the server: the app reads them here.
import type { Checkpoint, Essay, ExtensionStatus, TrailEvent } from './types';

declare global {
  interface Window {
    chrome?: any;
  }
}

/** Extension id: set VITE_EXTENSION_ID at build time (Chrome Web Store id). For unpacked
 *  dev builds the popup opens the app with `?ext=<id>`, which is remembered in
 *  `localStorage.trail_extension_id` (settable by hand too). */
// Capture ?ext=<id> the moment the app loads, before the router can redirect (e.g. to /login)
// and drop the query string.
(() => {
  try {
    const fromUrl = new URLSearchParams(location.search).get('ext');
    if (fromUrl && /^[a-p]{32}$/.test(fromUrl)) localStorage.setItem('trail_extension_id', fromUrl);
  } catch {
    /* storage may be unavailable */
  }
})();

export function extensionId(): string | null {
  try {
    const local = localStorage.getItem('trail_extension_id');
    if (local) return local;
  } catch {
    /* storage may be unavailable */
  }
  const env = (import.meta as any).env?.VITE_EXTENSION_ID as string | undefined;
  return env || null;
}

export function bridgeAvailable(): boolean {
  const c = (globalThis as any).chrome;
  return !!(c && c.runtime && typeof c.runtime.sendMessage === 'function' && extensionId());
}

type Msg = { type: string; [k: string]: any };

function send<T>(msg: Msg, timeoutMs = 4000): Promise<T> {
  const id = extensionId();
  const c = (globalThis as any).chrome;
  if (!id || !c?.runtime?.sendMessage) return Promise.reject(new Error('extension bridge unavailable'));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('extension did not answer')), timeoutMs);
    try {
      c.runtime.sendMessage(id, msg, (resp: any) => {
        clearTimeout(timer);
        const err = c.runtime.lastError;
        if (err) return reject(new Error(err.message || String(err)));
        if (!resp) return reject(new Error('empty reply from extension'));
        if (resp.ok === false) return reject(new Error(resp.error || 'extension error'));
        resolve((resp.result !== undefined ? resp.result : resp) as T);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

export async function status(): Promise<ExtensionStatus> {
  if (!bridgeAvailable()) return { installed: false, connected: false };
  try {
    const r = await send<{ version: string; connected: boolean }>({ type: 'status' }, 1500);
    return { installed: true, connected: !!r.connected, version: r.version };
  } catch {
    return { installed: false, connected: false };
  }
}

export function getEssays(): Promise<Essay[]> {
  return send<Essay[]>({ type: 'listDocs' });
}

export function getEvents(id: string): Promise<TrailEvent[]> {
  return send<TrailEvent[]>({ type: 'getEvents', doc: id }, 15000);
}

export function getCheckpoints(id: string): Promise<Checkpoint[]> {
  return send<Checkpoint[]>({ type: 'getCheckpoints', doc: id });
}

export function addAiNote(id: string, tool: string, note: string): Promise<void> {
  return send<void>({ type: 'addAiNote', doc: id, tool, note });
}

/** Hand the extension a scoped API token after login (DECISIONS §4). */
export function setToken(token: string | null, server: string): Promise<void> {
  return send<void>({ type: 'setToken', token, server });
}

/** Ask the extension to sign a checkpoint for one doc now (chain heads only). */
export function checkpointNow(id: string): Promise<{ created: boolean }> {
  return send<{ created: boolean }>({ type: 'checkpoint', doc: id }, 15000);
}

/** Wipe every recorded document on this device (extension IndexedDB). */
export function clearLocal(): Promise<void> {
  return send<void>({ type: 'clearAll' }, 15000);
}
