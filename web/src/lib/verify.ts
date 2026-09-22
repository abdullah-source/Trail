// Browser-side port of trail/verify.py for the public /verify page: unpacks a .trail.tar.gz
// (or .trail.tar.gz) and checks manifest hashes, event hashes, chain links, checkpoint heads
// and Ed25519 signatures (WebCrypto when the browser supports Ed25519; SKIP otherwise).
//
// The key inside the archive is never trusted on its own: with a TrustAnchor (Trail's
// published public key and transparency log, fetched by the page from the same origin) the
// verifier also checks that the archive was signed by Trail's key and that every checkpoint
// is in the public log. Without an anchor those checks are reported as SKIP, never PASS.
import type { VerifyCheck, VerifyResult } from './types';
import { canonical, GENESIS_HASH } from './canonical';
import { sha256Bytes, sha256Hex, sha256HexBytes } from './sha256';

class Report {
  checks: VerifyCheck[] = [];
  failed = 0;
  ok(name: string, detail = '') { this.checks.push({ status: 'PASS', name, detail }); }
  fail(name: string, detail = '') { this.failed += 1; this.checks.push({ status: 'FAIL', name, detail }); }
  skip(name: string, detail = '') { this.checks.push({ status: 'SKIP', name, detail }); }
}

// ---- gzip + tar ------------------------------------------------------------------------------------

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot decompress gzip');
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function untar(buf: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    let name = dec.decode(header.subarray(0, 100)).replace(/\0.*$/s, '');
    const size = parseInt(dec.decode(header.subarray(124, 136)).replace(/\0.*$/s, '').trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    const magic = dec.decode(header.subarray(257, 263));
    if (magic.startsWith('ustar')) {
      const prefix = dec.decode(header.subarray(345, 500)).replace(/\0.*$/s, '');
      if (prefix) name = prefix + '/' + name;
    }
    off += 512;
    const body = buf.subarray(off, off + size);
    if (type === '0' || type === '\0' || type === '') files.set(name, body);
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

function readJsonl(bytes: Uint8Array): any[] {
  return new TextDecoder().decode(bytes).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
}

// ---- Ed25519 ---------------------------------------------------------------------------------------------

type Verifier = { keyId: string; verify: (body: any, sigB64: string) => Promise<boolean> } | null;

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function loadVerifier(pem: string): Promise<Verifier> {
  const der = pemToDer(pem);
  // SPKI for Ed25519 is 44 bytes: 12-byte header + 32-byte raw key.
  if (der.length !== 44) return null;
  const raw = der.subarray(12);
  const keyId = sha256HexBytes(raw).slice(0, 16);
  try {
    const key = await crypto.subtle.importKey('spki', der as BufferSource, { name: 'Ed25519' } as any, false, ['verify']);
    return {
      keyId,
      verify: async (body, sigB64) => {
        try {
          const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
          const digest = sha256Bytes(new TextEncoder().encode(canonical(body)));
          return await crypto.subtle.verify({ name: 'Ed25519' } as any, key, sig as BufferSource, digest as BufferSource);
        } catch {
          return false;
        }
      },
    };
  } catch {
    return { keyId, verify: null as any };
  }
}

// ---- trust anchor --------------------------------------------------------------------------------------------

export type TrustAnchor = {
  origin: string; // where the key and log came from, for the messages
  publicKeyPem: string | null; // GET /v1/public-key, or null when it could not be fetched
  transparency: { checkpoint_hash: string }[] | null; // GET /v1/transparency, or null
};

function normalisePem(pem: string): string {
  return pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
}

// ---- verify ---------------------------------------------------------------------------------------------------

export async function verifyRecordBytes(data: Uint8Array, trust?: TrustAnchor): Promise<VerifyResult> {
  const r = new Report();
  let files: Map<string, Uint8Array>;
  try {
    const isGzip = data[0] === 0x1f && data[1] === 0x8b;
    files = untar(isGzip ? await gunzip(data) : data);
  } catch (e) {
    r.fail('archive', `could not read archive: ${(e as Error).message}`);
    return { ok: false, checks: r.checks };
  }
  // Strip the single top-level directory.
  const names = [...files.keys()];
  const roots = new Set(names.map((n) => n.split('/')[0]));
  const root = roots.size === 1 && names.every((n) => n.includes('/')) ? [...roots][0] + '/' : '';
  const get = (rel: string) => files.get(root + rel);
  const dec = new TextDecoder();

  const manifestBytes = get('manifest.json');
  if (!manifestBytes) {
    r.fail('manifest', 'manifest.json missing');
    return { ok: false, checks: r.checks };
  }
  const manifest = JSON.parse(dec.decode(manifestBytes));

  // 1. file hashes
  const bad: string[] = [];
  const listed = Object.keys(manifest.files || {}).sort();
  for (const rel of listed) {
    const f = get(rel);
    if (!f) { bad.push(`${rel} missing`); continue; }
    if (sha256HexBytes(f) !== manifest.files[rel]) bad.push(`${rel} hash mismatch`);
  }
  if (bad.length) r.fail('manifest file hashes', bad.slice(0, 5).join('; '));
  else r.ok('manifest file hashes', `${listed.length} files`);

  // 2 + 3. events and chains
  const evBytes = get(manifest.events_file || 'events.jsonl');
  const events: any[] = evBytes ? readJsonl(evBytes) : [];
  const bySession = new Map<string, any[]>();
  let hashErrors = 0;
  for (const ev of events) {
    const { hash, ...body } = ev;
    if (sha256Hex(canonical(body)) !== hash) hashErrors += 1;
    if (!bySession.has(ev.session)) bySession.set(ev.session, []);
    bySession.get(ev.session)!.push(ev);
  }
  if (hashErrors) r.fail('event hashes', `${hashErrors} of ${events.length} events do not match their contents`);
  else r.ok('event hashes', `${events.length} events`);

  const chainErrors: string[] = [];
  for (const [session, evs] of [...bySession.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    evs.sort((a, b) => a.seq - b.seq);
    let prev = GENESIS_HASH;
    evs.forEach((ev, i) => {
      if (ev.seq !== i) chainErrors.push(`session ${session}: seq gap at ${i}`);
      if (ev.prev !== prev) chainErrors.push(`session ${session} seq ${ev.seq}: prev mismatch`);
      prev = ev.hash;
    });
  }
  if (chainErrors.length) r.fail('chain linkage', chainErrors.slice(0, 5).join('; '));
  else r.ok('chain linkage', `${bySession.size} sessions`);
  if (manifest.event_count != null && manifest.event_count !== events.length) {
    r.fail('event count', `manifest says ${manifest.event_count}, archive has ${events.length}`);
  }

  // 4. checkpoints
  const cpBytes = get(manifest.checkpoints_file || 'checkpoints.jsonl');
  const checkpoints: any[] = cpBytes ? readJsonl(cpBytes) : [];
  const pkBytes = get(manifest.public_key_file || 'keys/signer.pub.pem');
  const archivePem = pkBytes ? dec.decode(pkBytes) : null;
  const verifier = archivePem ? await loadVerifier(archivePem) : null;
  const canSign = !!(verifier && verifier.verify);
  const sigBytes = get('manifest.sig.json');

  // Is the key in the archive Trail's key? Anyone can generate a key and sign a fabricated
  // record with it, so this check decides what "Verified" means.
  if (trust) {
    if (!checkpoints.length && !sigBytes) {
      r.fail("signed by Trail's key", 'nothing in this archive carries a signature');
    } else if (!archivePem || !verifier) {
      r.fail("signed by Trail's key", 'the archive carries no usable public key');
    } else if (trust.publicKeyPem === null) {
      r.skip("signed by Trail's key", `could not fetch Trail's public key from ${trust.origin}; compare key id ${verifier.keyId} with ${trust.origin}/v1/public-key yourself`);
    } else {
      const trusted = await loadVerifier(trust.publicKeyPem);
      if (trusted && trusted.keyId === verifier.keyId && normalisePem(trust.publicKeyPem) === normalisePem(archivePem)) {
        r.ok("signed by Trail's key", `key id ${verifier.keyId} matches ${trust.origin}/v1/public-key`);
      } else {
        r.fail("signed by Trail's key", `the archive is signed by an unknown key (${verifier.keyId}); Trail's key is ${trusted?.keyId ?? 'unavailable'}. Hashes and chains below may still be internally consistent, but this pack could have been made by anyone`);
      }
    }
  }

  if (!checkpoints.length) {
    r.skip('checkpoints', 'none in archive');
  } else {
    const cpErrors: string[] = [];
    checkpoints.sort((a, b) => a.body.seq - b.body.seq);
    const firstSeq = checkpoints[0].body.seq;
    let prevHash: string | null = firstSeq === 0 ? GENESIS_HASH : null;
    const covered = new Set<string>();
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const body = cp.body;
      const bodyHash = sha256Hex(canonical(body));
      if ((cp.hash ?? bodyHash) !== bodyHash) cpErrors.push(`checkpoint ${body.seq}: hash mismatch`);
      if (body.seq !== firstSeq + i) cpErrors.push(`checkpoint ${body.seq}: expected seq ${firstSeq + i}`);
      if (prevHash !== null && body.prev_checkpoint !== prevHash) cpErrors.push(`checkpoint ${body.seq}: prev_checkpoint mismatch`);
      prevHash = bodyHash;
      for (const [session, head] of Object.entries<any>(body.heads || {})) {
        const evs = bySession.get(session);
        if (!evs) { cpErrors.push(`checkpoint ${body.seq}: session ${session} is named but missing from the record`); continue; }
        covered.add(session);
        if (head.seq >= evs.length || evs[head.seq].hash !== head.hash) cpErrors.push(`checkpoint ${body.seq}: head of ${session} does not match archive`);
        else if (head.first_ts != null && evs[0].ts !== head.first_ts) cpErrors.push(`checkpoint ${body.seq}: first_ts of ${session} does not match archive`);
      }
      if (canSign) {
        if (cp.key_id !== verifier!.keyId) cpErrors.push(`checkpoint ${body.seq}: signed by a different key (${cp.key_id})`);
        else if (!(await verifier!.verify(body, cp.signature))) cpErrors.push(`checkpoint ${body.seq}: bad signature`);
      }
    }
    if (cpErrors.length) r.fail('checkpoints', cpErrors.slice(0, 5).join('; '));
    else r.ok('checkpoint linkage and heads', `${checkpoints.length} checkpoints, ${covered.size} of ${bySession.size} sessions covered`);
    const uncovered = bySession.size - covered.size;
    if (uncovered) r.skip('checkpoint coverage', `${uncovered} session(s) not yet named by any checkpoint in this archive`);
    if (!canSign) r.skip('checkpoint signatures', 'this browser cannot verify Ed25519 signatures; run verify.py to check them');
    else r.ok('checkpoint signatures', `key ${verifier!.keyId}`);

    // public log: every checkpoint we signed is appended to /v1/transparency
    if (trust) {
      if (trust.transparency === null) {
        r.skip('checkpoints in the public log', `could not fetch ${trust.origin}/v1/transparency`);
      } else {
        const logged = new Set(trust.transparency.map((e) => e.checkpoint_hash));
        const missing = checkpoints.filter((cp) => !logged.has(cp.hash ?? sha256Hex(canonical(cp.body))));
        if (missing.length) r.fail('checkpoints in the public log', `${missing.length} of ${checkpoints.length} checkpoints are not in Trail's transparency log`);
        else r.ok('checkpoints in the public log', `all ${checkpoints.length} found in ${trust.origin}/v1/transparency`);
      }
    }
  }

  // 5. manifest signature
  if (sigBytes) {
    const sig = JSON.parse(dec.decode(sigBytes));
    if (!canSign) r.skip('manifest signature', 'no public key or Ed25519 unavailable in this browser');
    else if (sig.key_id !== verifier!.keyId) r.fail('manifest signature', 'signed by a different key');
    else if (sig.manifest_hash !== sha256Hex(canonical(manifest))) r.fail('manifest signature', 'manifest hash in signature does not match manifest.json');
    else if (!(await verifier!.verify({ manifest_hash: sig.manifest_hash }, sig.signature))) r.fail('manifest signature', 'bad signature');
    else r.ok('manifest signature', `key ${verifier!.keyId}`);
  } else {
    r.skip('manifest signature', 'manifest.sig.json not present');
  }
  return { ok: r.failed === 0, checks: r.checks };
}

/** A bare events.jsonl (raw export): event hashes and chain links only; no checkpoints to check. */
export function verifyEventsJsonl(bytes: Uint8Array): VerifyResult {
  const r = new Report();
  let events: any[];
  try {
    events = readJsonl(bytes);
  } catch (e) {
    r.fail('events', `could not parse events.jsonl: ${(e as Error).message}`);
    return { ok: false, checks: r.checks };
  }
  if (!events.length) {
    r.fail('events', 'the file has no events');
    return { ok: false, checks: r.checks };
  }
  const bySession = new Map<string, any[]>();
  let hashErrors = 0;
  for (const ev of events) {
    const { hash, ...body } = ev;
    if (sha256Hex(canonical(body)) !== hash) hashErrors += 1;
    if (!bySession.has(ev.session)) bySession.set(ev.session, []);
    bySession.get(ev.session)!.push(ev);
  }
  if (hashErrors) r.fail('event hashes', `${hashErrors} of ${events.length} events do not match their contents`);
  else r.ok('event hashes', `${events.length} events`);
  const chainErrors: string[] = [];
  for (const [session, evs] of bySession) {
    evs.sort((a, b) => a.seq - b.seq);
    let prev = GENESIS_HASH;
    evs.forEach((ev, i) => {
      if (ev.seq !== i) chainErrors.push(`session ${session}: seq gap at ${i}`);
      if (ev.prev !== prev) chainErrors.push(`session ${session} seq ${ev.seq}: prev mismatch`);
      prev = ev.hash;
    });
  }
  if (chainErrors.length) r.fail('chain linkage', chainErrors.slice(0, 5).join('; '));
  else r.ok('chain linkage', `${bySession.size} sessions`);
  r.skip('checkpoints', 'a raw events file carries no signed checkpoints; export a record (.tar.gz) to check signatures');
  return { ok: r.failed === 0, checks: r.checks };
}

export async function verifyRecordFile(file: File, trust?: TrustAnchor): Promise<VerifyResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip && (file.name.endsWith('.jsonl') || file.name.endsWith('.json') || bytes[0] === 0x7b)) return verifyEventsJsonl(bytes);
  return verifyRecordBytes(bytes, trust);
}
