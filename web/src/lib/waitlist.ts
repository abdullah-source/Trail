// Referral waitlist helpers: the ?ref= code a visitor arrived with, the visitor's own share code,
// and the words on the share card. Pure functions are tested in waitlist.test.ts.

export const REF_KEY = 'trail_ref';
export const SRC_KEY = 'trail_src';
export const CODE_KEY = 'trail_waitlist_code';
export const PLACES_PER_REFERRAL = 5;

/** Share codes are 8 characters of base32 without I, O, 0 or 1. Returns null for anything else. */
export function normalizeCode(raw: string | null | undefined): string | null {
  const c = (raw || '').trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(c) ? c : null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the page still works, it just forgets */
  }
}

/** Keep a ?ref= code from the URL so it survives navigation to /install or /login. */
export function captureRef(search: string): string | null {
  const fromUrl = normalizeCode(new URLSearchParams(search).get('ref'));
  if (fromUrl) write(REF_KEY, fromUrl);
  return fromUrl ?? normalizeCode(read(REF_KEY));
}

export const storedRef = (): string | null => normalizeCode(read(REF_KEY));

/** Channel tag from ?src= (e.g. tiktok, reddit, flyer-pomona): lowercase letters, digits and dashes, at most 24. */
export function normalizeSrc(raw: string | null | undefined): string | null {
  const s = (raw || '').trim().toLowerCase();
  return /^[a-z0-9-]{1,24}$/.test(s) ? s : null;
}

/** Keep the first ?src= a visitor arrived with, so a sign-up on another page still credits the channel. */
export function captureSrc(search: string): string | null {
  const fromUrl = normalizeSrc(new URLSearchParams(search).get('src'));
  if (fromUrl && !normalizeSrc(read(SRC_KEY))) write(SRC_KEY, fromUrl);
  return normalizeSrc(read(SRC_KEY)) ?? fromUrl;
}

/** The source sent with a join: "<page>" or "<page>:<channel>", within the server's 40 characters. */
export const sourceFor = (page: string, channel: string | null): string => (channel ? `${page}:${channel}` : page).slice(0, 40);
export const storedCode = (): string | null => normalizeCode(read(CODE_KEY));
export const saveCode = (code: string | null): void => write(CODE_KEY, code);

export const positionText = (position: number): string => `You're #${position.toLocaleString('en-US')} in line.`;

export const waitingText = (total: number): string => `${total.toLocaleString('en-US')} ${total === 1 ? 'person' : 'people'} waiting`;

export function referralsText(referrals: number): string | null {
  if (referrals <= 0) return null;
  return `${referrals} ${referrals === 1 ? 'friend has' : 'friends have'} confirmed, ${referrals * PLACES_PER_REFERRAL} places up.`;
}

export const shareText = (url: string): string =>
  `I'm on the waitlist for Trail, the writing record that shows your essay is your own work. Join with my link and I move up the line: ${url}`;

export const instagramText = (url: string): string => `Proof I wrote it myself. Trail waitlist, link to join: ${url}`;

export const whatsappUrl = (url: string): string => `https://wa.me/?text=${encodeURIComponent(shareText(url))}`;

export const xUrl = (url: string): string => `https://x.com/intent/post?text=${encodeURIComponent(shareText(url))}`;
