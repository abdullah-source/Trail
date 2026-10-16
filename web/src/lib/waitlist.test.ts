import { describe, expect, it } from 'vitest';
import { instagramText, normalizeCode, positionText, referralsText, shareText, waitingText, whatsappUrl, xUrl } from './waitlist';

describe('waitlist helpers', () => {
  it('accepts only real share codes', () => {
    expect(normalizeCode(' abcd2345 ')).toBe('ABCD2345');
    expect(normalizeCode('ABCD0123')).toBeNull(); // 0 and 1 are never used
    expect(normalizeCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });

  it('says the position and the counter in plain words', () => {
    expect(positionText(1)).toBe("You're #1 in line.");
    expect(positionText(1234)).toBe("You're #1,234 in line.");
    expect(waitingText(1)).toBe('1 person waiting');
    expect(waitingText(2500)).toBe('2,500 people waiting');
    expect(referralsText(0)).toBeNull();
    expect(referralsText(1)).toBe('1 friend has confirmed, 5 places up.');
    expect(referralsText(3)).toBe('3 friends have confirmed, 15 places up.');
  });

  it('builds share text and intent links around the share URL', () => {
    const url = 'https://trail.example/?ref=ABCD2345';
    expect(shareText(url)).toContain(url);
    expect(instagramText(url)).toContain(url);
    expect(whatsappUrl(url)).toBe(`https://wa.me/?text=${encodeURIComponent(shareText(url))}`);
    expect(xUrl(url).startsWith('https://x.com/intent/post?text=')).toBe(true);
    expect(decodeURIComponent(xUrl(url).split('text=')[1])).toBe(shareText(url));
  });
});


import { normalizeSrc, sourceFor } from './waitlist';
describe('channel tags', () => {
  it('accepts simple tags and rejects the rest', () => {
    expect(normalizeSrc('TikTok')).toBe('tiktok');
    expect(normalizeSrc('flyer-pomona')).toBe('flyer-pomona');
    expect(normalizeSrc('<script>')).toBeNull();
    expect(normalizeSrc('x'.repeat(25))).toBeNull();
  });
  it('combines page and channel within 40 characters', () => {
    expect(sourceFor('home', null)).toBe('home');
    expect(sourceFor('home', 'reddit')).toBe('home:reddit');
    expect(sourceFor('install', 'y'.repeat(24)).length).toBeLessThanOrEqual(40);
  });
});
