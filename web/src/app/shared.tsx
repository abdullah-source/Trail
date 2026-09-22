// Small pieces shared by the app pages: a public page shell (login, verify, 404), the essay
// analysis hook, and the Chrome Web Store link.
import { useMemo, type ReactNode } from 'react';
import { analyse, declaration, drafts, lines } from '../lib/analysis';
import type { TrailEvent } from '../lib/types';

import { CHROME_STORE_URL as DESIGN_STORE_URL } from '../design/components';

export const CHROME_STORE_URL = ((import.meta as any).env?.VITE_CHROME_STORE_URL as string | undefined) || DESIGN_STORE_URL;

/** Everything a page needs from one essay's events, computed once per event list. */
export function useEssayAnalysis(events: TrailEvent[] | null, meta: { student?: string; course?: string } = {}) {
  return useMemo(() => {
    if (!events || !events.length) return null;
    const a = analyse(events);
    return { analysis: a, lines: lines(events), drafts: drafts(events), declaration: declaration(a, meta) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, meta.student, meta.course]);
}

/** Content container for pages mounted inside the design's <MarketingLayout/> (login, verify, 404). */
export function PublicShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`w-full mx-auto px-4 sm:px-6 py-12 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>{children}</div>;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
