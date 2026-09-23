// Single data layer for the pages. With VITE_MOCK=1 every function returns fixtures from
// ./mock.ts (real simulated events). Otherwise: essays/events come from the extension bridge,
// account/billing/checkpoints/pack from the API (same origin, httpOnly session cookie).
import type { Checkpoint, Essay, ExtensionStatus, Me, Referrals, ServerDoc, TrailEvent, VerifyResult } from './types';
import * as ext from './extension';
import { verifyRecordFile, type TrustAnchor } from './verify';

export const MOCK = (import.meta as any).env?.VITE_MOCK === '1';
export const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined) || '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API_BASE + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Could not reach Trail. Check your connection and try again.');
  }
  if (!r.ok) {
    let detail = r.statusText || `HTTP ${r.status}`;
    try {
      const j = await r.json();
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* not json */
    }
    throw new ApiError(r.status, detail);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

let mockModule: typeof import('./mock') | null = null;
async function mock() {
  if (!mockModule) mockModule = await import('./mock');
  return mockModule;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Trigger a browser download of a Blob. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const safeName = (id: string) => id.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'essay';

export const data = {
  async me(): Promise<Me | null> {
    if (MOCK) return (await mock()).mockMe;
    try {
      return await api<Me>('/v1/me');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  async requestMagicLink(email: string, referral?: string): Promise<{ sent: boolean; created: boolean }> {
    if (MOCK) {
      await sleep(300);
      return { sent: true, created: false };
    }
    return api('/v1/auth/request', { method: 'POST', body: JSON.stringify({ email, referral: referral || null }) });
  },

  async joinWaitlist(email: string, source: string): Promise<{ joined: boolean; new: boolean }> {
    if (MOCK) return { joined: true, new: true };
    return api('/v1/waitlist', { method: 'POST', body: JSON.stringify({ email, source }) });
  },

  /** Clerk: exchange Clerk's session token for our httpOnly session cookie. */
  async clerkSignIn(token: string, referral?: string): Promise<{ user: string; first: boolean }> {
    if (MOCK) return { user: 'mock', first: false };
    return api('/v1/auth/clerk', { method: 'POST', body: JSON.stringify({ token, referral: referral || null }) });
  },

  async logout(): Promise<void> {
    if (MOCK) return;
    await api('/v1/auth/logout', { method: 'POST' });
    try {
      await (window as any).Clerk?.signOut?.();
    } catch {
      /* Clerk not loaded */
    }
  },

  /** First replay shown: start the 14-day clock (idempotent). */
  async startTrial(): Promise<Me> {
    if (MOCK) return (await mock()).mockMe;
    return api<Me>('/v1/me/trial-start', { method: 'POST' });
  },

  async essays(): Promise<Essay[]> {
    if (MOCK) return (await mock()).mockEssays;
    return ext.getEssays();
  },

  async essayEvents(id: string): Promise<TrailEvent[]> {
    if (MOCK) return (await mock()).mockEvents.get(id) || [];
    return ext.getEvents(id);
  },

  /** Checkpoints kept by the extension, falling back to the server's copies. */
  async checkpoints(id: string): Promise<Checkpoint[]> {
    if (MOCK) return (await mock()).mockCheckpoints(id);
    try {
      const local = await ext.getCheckpoints(id);
      if (local.length) return local;
    } catch {
      /* extension unavailable: use the server copies */
    }
    return api<Checkpoint[]>(`/v1/docs/${encodeURIComponent(id)}/checkpoints`);
  },

  async serverDocs(): Promise<ServerDoc[]> {
    if (MOCK) return [];
    return api<ServerDoc[]>('/v1/me/docs');
  },

  async signCheckpoint(id: string): Promise<{ created: boolean }> {
    if (MOCK) return { created: true };
    return ext.checkpointNow(id);
  },

  /** Evidence pack. The events are posted to the server for this one request, signed, and returned;
   *  the UI says so before the click (DECISIONS §2). Requires an active trial or plan. */
  async buildPack(id: string, format: 'html' | 'record', meta: { title?: string; student?: string; course?: string } = {}): Promise<Blob> {
    const events = await data.essayEvents(id);
    if (MOCK) {
      const { analyse, declaration } = await import('./analysis');
      const a = analyse(events);
      const body = format === 'html' ? `<!doctype html><pre>${declaration(a, meta)}</pre>` : JSON.stringify({ mock: true, events: events.length });
      return new Blob([body], { type: format === 'html' ? 'text/html' : 'application/gzip' });
    }
    let checkpoints: Checkpoint[] = [];
    try {
      checkpoints = await ext.getCheckpoints(id);
    } catch {
      /* server copies are used when the extension has none */
    }
    let r: Response;
    try {
      r = await fetch(API_BASE + '/v1/pack', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, checkpoints, format, title: meta.title ?? null, student: meta.student ?? null, course: meta.course ?? null }),
      });
    } catch {
      throw new ApiError(0, 'Could not reach Trail to sign the pack. Check your connection and try again.');
    }
    if (!r.ok) {
      let detail = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
      } catch {
        /* not json */
      }
      throw new ApiError(r.status, detail);
    }
    return r.blob();
  },

  /** Raw export, built entirely in the browser: events.jsonl (+ checkpoints). Never locked. */
  async exportJson(id: string): Promise<Blob> {
    const events = await data.essayEvents(id);
    let cps: Checkpoint[] = [];
    try {
      cps = await data.checkpoints(id);
    } catch {
      /* none */
    }
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    const cpLines = cps.length ? cps.map((c) => JSON.stringify(c)).join('\n') + '\n' : '';
    return new Blob([lines + (cpLines ? '\n# checkpoints\n' + cpLines : '')], { type: 'application/x-ndjson' });
  },

  async addAiNote(id: string, tool: string, note: string): Promise<void> {
    if (MOCK) return;
    await ext.addAiNote(id, tool, note);
  },

  async referrals(): Promise<Referrals> {
    if (MOCK) {
      const me = (await mock()).mockMe;
      return { code: me.referralCode, link: `${location.origin}/login?ref=${me.referralCode}`, invited: 2, activated: 1, credits: 0, progress: 1, needed: 3, maxCredits: 3, freeUntil: null };
    }
    return api<Referrals>('/v1/referrals');
  },

  async startCheckout(plan: 'semester' | 'monthly'): Promise<{ url: string }> {
    if (MOCK) return { url: '#mock-checkout-' + plan };
    return api<{ url: string }>('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
  },

  async openBillingPortal(): Promise<{ url: string }> {
    if (MOCK) return { url: '#mock-portal' };
    return api<{ url: string }>('/v1/billing/portal', { method: 'POST' });
  },

  async requestRefund(): Promise<{ refunded: boolean }> {
    if (MOCK) return { refunded: true };
    return api<{ refunded: boolean }>('/v1/billing/refund', { method: 'POST' });
  },

  async deleteAccount(): Promise<void> {
    if (MOCK) return;
    await api('/v1/me', { method: 'DELETE' });
  },

  async clearLocalData(): Promise<void> {
    if (MOCK) return;
    await ext.clearLocal();
  },

  async extensionStatus(): Promise<ExtensionStatus> {
    if (MOCK) return { installed: true, connected: true, version: '0.2.0' };
    return ext.status();
  },

  /** After login, give the extension its API token so it can sign checkpoints. */
  async connectExtension(): Promise<boolean> {
    if (MOCK) return true;
    try {
      const { token, server } = await api<{ token: string; server: string }>('/v1/auth/extension-token', { method: 'POST' });
      await ext.setToken(token, server || location.origin);
      return true;
    } catch {
      return false;
    }
  },

  /** Trail's published public key and transparency log, so /verify never trusts the key inside an archive. */
  async trustAnchor(): Promise<TrustAnchor | undefined> {
    if (MOCK) return undefined;
    const anchor: TrustAnchor = { origin: location.origin, publicKeyPem: null, transparency: null };
    try {
      const r = await fetch(API_BASE + '/v1/public-key');
      if (r.ok) anchor.publicKeyPem = await r.text();
    } catch {
      /* reported as SKIP by the verifier */
    }
    try {
      const r = await fetch(API_BASE + '/v1/transparency');
      if (r.ok) anchor.transparency = await r.json();
    } catch {
      /* reported as SKIP by the verifier */
    }
    return anchor;
  },

  async verifyRecord(file: File): Promise<VerifyResult> {
    return verifyRecordFile(file, await data.trustAnchor());
  },
};

export type Data = typeof data;
