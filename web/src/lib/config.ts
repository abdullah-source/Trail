// Public site configuration from the server (FREE_ACCESS etc.). One fetch per page load, shared.
// Until the answer arrives (and if it never does) the pages assume free access, which is the
// server's own default while Stripe is unset.
import { useEffect, useState } from 'react';
import type { SiteConfig } from './types';
import { API_BASE, MOCK } from './data';

export const DEFAULT_CONFIG: SiteConfig = { freeAccess: true, billingConfigured: false, trialDays: 14, signupOpen: true, clerkPublishableKey: null };

let cached: SiteConfig | null = null;
let pending: Promise<SiteConfig> | null = null;

export function loadSiteConfig(): Promise<SiteConfig> {
  if (cached) return Promise.resolve(cached);
  if (MOCK) return Promise.resolve((cached = { ...DEFAULT_CONFIG, freeAccess: false, billingConfigured: true }));
  if (!pending) {
    pending = fetch(API_BASE + '/v1/config', { credentials: 'omit' })
      .then((r) => (r.ok ? (r.json() as Promise<SiteConfig>) : DEFAULT_CONFIG))
      .catch(() => DEFAULT_CONFIG)
      .then((c) => (cached = { ...DEFAULT_CONFIG, ...c }));
  }
  return pending;
}

export function useSiteConfig(): SiteConfig {
  const [cfg, setCfg] = useState<SiteConfig>(cached ?? DEFAULT_CONFIG);
  useEffect(() => {
    let live = true;
    loadSiteConfig().then((c) => live && setCfg(c));
    return () => {
      live = false;
    };
  }, []);
  return cfg;
}
