import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './icons';
import { mountProvenancePath } from './provenance-engine';

export type ProvenanceKind = 'doc' | 'session' | 'paste' | 'signature' | 'log' | 'check';
export type ProvenanceTone = 'ink' | 'typed' | 'paste' | 'signed' | 'guilloche' | 'seal';

export type ProvenanceNode = {
  id: string;
  kind: ProvenanceKind;
  /** the line people read, e.g. "Hamlet and the cost of waiting" */
  label: ReactNode;
  /** mono caps above the label; defaults to "01 · Document" etc. */
  kicker?: ReactNode;
  /** mono line under the label: a hash, a time range, a domain */
  detail?: ReactNode;
  /** the colour the checkpoint lights in; defaults by kind */
  tone?: ProvenanceTone;
  icon?: IconName;
};

export type ProvenancePathProps = {
  nodes: ProvenanceNode[];
  /** dots travelling at once (default 3) */
  dots?: number;
  /** ms for one dot to cross the whole path (default 6400) */
  duration?: number;
  /** names the list for screen readers */
  label?: string;
  className?: string;
};

const KIND: Record<ProvenanceKind, { name: string; tone: ProvenanceTone; icon: IconName }> = {
  doc: { name: 'Document', tone: 'ink', icon: 'document' },
  session: { name: 'Session', tone: 'typed', icon: 'session' },
  paste: { name: 'Paste source', tone: 'paste', icon: 'paste' },
  signature: { name: 'Signature', tone: 'signed', icon: 'signature' },
  log: { name: 'Public log', tone: 'guilloche', icon: 'log' },
  check: { name: 'Check', tone: 'typed', icon: 'check' },
};

/** The record's chain as a diagram: checkpoints on an engraved line, lit by travelling dots. */
export function ProvenancePath({ nodes, dots = 3, duration = 6400, label = 'How this record was made', className }: ProvenancePathProps) {
  const ref = useRef<HTMLDivElement>(null);
  const key = nodes.map((n) => n.id).join('|');
  useEffect(() => {
    if (!ref.current) return;
    return mountProvenancePath(ref.current, { dots, duration });
  }, [key, dots, duration]);
  return (
    <div ref={ref} className={cx('ppath', className)} data-ppath="" data-dots={dots} data-duration={duration}>
      <svg className="ppath-svg" aria-hidden="true" />
      <ol className="ppath-list" aria-label={label}>
        {nodes.map((n, i) => {
          const k = KIND[n.kind];
          return (
            <li key={n.id} className="ppath-node" data-tone={n.tone ?? k.tone}>
              <span className="ppath-pin" data-ppath-pin="" aria-hidden="true">
                <Icon name={n.icon ?? k.icon} size={20} />
              </span>
              <span className="ppath-kicker">{n.kicker ?? `${String(i + 1).padStart(2, '0')} · ${k.name}`}</span>
              <span className="ppath-label">{n.label}</span>
              {n.detail != null && <span className="ppath-detail">{n.detail}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
