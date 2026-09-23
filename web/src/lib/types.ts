// Shared contract between the data layer (lib/) and the pages (owned by design).
// Mirrors trail/analysis.py, document.py and pack.py exactly; do not change shapes here
// without changing the Python side and the parity fixtures.

export type TrailEvent = {
  v: 1;
  id: string;
  seq: number;
  session: string;
  doc: string;
  ts: string;
  kind: string;
  data: Record<string, any>;
  prev: string;
  hash: string;
};

export type Checkpoint = { body: Record<string, any>; signature: string; key_id: string; hash?: string };

export type Essay = {
  id: string;
  title: string | null;
  editor: string;
  lastSeen: string;
  firstSeen: string;
  typed: number;
  pasted: number;
  deleted: number;
  events: number;
  sessions: number;
  words: number;
};

export type AnalysisDocument = {
  doc: string | null;
  final_chars: number;
  final_words: number;
  final_lines: number;
  text_hash: string;
  typed_chars_surviving: number;
  typed_share: number | null;
  unobserved_chars: number;
  snapshot_checks: number;
  snapshot_mismatches: number;
  resyncs: number;
};

export type Cadence = {
  typed_chars: number;
  deleted_chars: number;
  correction_ratio: number | null;
  active_minutes: number;
  words_per_minute: number | null;
  inter_key_median_ms: number | null;
  inter_key_cv: number | null;
  pauses: number;
  longest_pause_s: number;
  keystrokes: number;
};

export type PasteItem = {
  paste_id: string;
  ts: string;
  chars: number;
  source_host: string | null;
  source_kind: string;
  from_self: boolean;
  surviving_chars: number;
  surviving_ratio: number;
  text_hash: string;
};

export type Pastes = {
  count: number;
  pasted_chars: number;
  pasted_chars_surviving: number;
  share_of_final_document: number;
  by_source_kind: Record<string, number>;
  ai_pastes: number;
  ai_chars_surviving: number;
  items: PasteItem[];
};

export type RegularitySignal = { signal: string; value: number; threshold: number; meaning: string };

export type Regularity = {
  score: number;
  flagged: boolean;
  signals: RegularitySignal[];
  inter_key_cv: number | null;
  inter_key_spread: number | null;
  keystrokes_analysed: number;
};

export type TimelineBucket = { bucket: number; minute: number; typed: number; deleted: number; pasted: number };

export type SourceDwell = { host: string; dwell_minutes: number };

export type SessionSummary = {
  session: string;
  start: string;
  end: string;
  editor: string | null;
  host: string | null;
  active_minutes: number;
  typed_chars: number;
  pasted_chars: number;
  deleted_chars: number;
  events: number;
};

export type AiNote = { ts: string; tool?: string; note?: string; [k: string]: any };

export type Analysis = {
  version: string;
  document: AnalysisDocument;
  line_labels: Record<string, number>;
  cadence: Cadence;
  pastes: Pastes;
  regularity: Regularity;
  timeline: TimelineBucket[];
  sources: SourceDwell[];
  sessions: SessionSummary[];
  ai_notes: AiNote[];
  first_event: string | null;
  last_event: string | null;
};

export type LineLabel = 'typed' | 'pasted' | 'pasted-edited' | 'mixed' | 'unobserved';

export type LineProvenance = {
  index: number;
  text: string;
  typed: number;
  pasted: number;
  unobserved: number;
  label: LineLabel;
};

export type Draft = { fraction: number; ts: string; chars: number; words: number; text: string };

export type Patterns = {
  documents: number;
  sessions: number;
  best_hours: number[];
  active_minutes_by_hour: number[];
  median_session_minutes: number | null;
  words_per_minute: number | null;
  correction_ratio: number | null;
  typed_share: number | null;
  total_words: number;
};

export type Plan = 'trial' | 'semester' | 'monthly' | 'expired' | 'free';

export type Me = {
  id: string;
  email: string;
  plan: Plan;
  entitled: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  referralCode: string;
  referrals: number;
  referralCredits: number;
  freeUntil: string | null;
  createdAt: string;
  billing: { configured: boolean; freeAccess: boolean; hasCustomer: boolean; refundable: boolean };
};

export type Referrals = {
  code: string;
  link: string;
  invited: number;
  activated: number;
  credits: number;
  progress: number;
  needed: number;
  maxCredits: number;
  freeUntil: string | null;
};

export type ServerDoc = { doc: string; first_seen: string; last_seen: string; last_checkpoint: string | null };

export type VerifyCheck = { status: 'PASS' | 'FAIL' | 'SKIP'; name: string; detail: string; plain?: string };
/** summary is optional so older callers keep working; the /verify page uses it for the verdict sentence. */
export type VerifySummary = {
  events: number;
  sessions: number;
  checkpoints: number;
  /** ISO timestamps of the signed checkpoints, oldest first */
  signedAt: string[];
  /** first event whose hash or link no longer holds, if any */
  brokenAt: { seq: number; index: number; session: string; ts: string | null } | null;
};
export type VerifyResult = { ok: boolean; checks: VerifyCheck[]; summary?: VerifySummary };

export type ExtensionStatus = { installed: boolean; connected: boolean; version?: string };

/** GET /v1/config: public, unauthenticated. Lets the marketing pages say the true thing about pricing. */
export type SiteConfig = { freeAccess: boolean; billingConfigured: boolean; trialDays: number; signupOpen: boolean; clerkPublishableKey: string | null };
