// The essays list is a register: one ledger row per essay with its serial (from the doc id), the
// title, editor, words, sessions, typed / pasted share, growth and last edit, under a faint guilloche
// header engraved from the essays' own word counts (DESIGN-document.md §9, "Essays").
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { data } from '../lib/data';
import type { Essay } from '../lib/types';
import { timeline } from '../lib/analysis';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Sparkline, ShareBar } from '../components/Sparkline';
import { ButtonLink, Caption, Chip, ErrorNote, Guilloche, Icon, Loading, Note, ScrollArea, SectionHead, Skeleton, TABLE, TD, TH, cx, serialOf } from '../components/ui';
import { editorName, num, pct, relative } from '../components/format';
import { CHROME_STORE_URL } from './shared';

export default function Essays() {
  usePageTitle('Essays');
  const ext = useAsync(() => data.extensionStatus(), []);
  const essays = useAsync(() => data.essays(), []);

  if (ext.status === 'ready' && !ext.value.installed) {
    return (
      <Note
        as="section"
        label={
          <span className="inline-flex items-center gap-2">
            <Icon name="upload" size={16} /> Trail installer
          </span>
        }
        className="max-w-2xl"
      >
        <h1 className="note-title">Nothing to show yet: the extension is not talking to this page.</h1>
        <p className="text-sm text-ink-soft max-w-prose">
          Trail reads your essays straight from the extension on this computer. Nothing is uploaded, so this page is empty without it. Install it in Chrome on this computer, then come back here or open it from the extension popup. On a phone or another browser, your essays are only where the extension is.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink to={CHROME_STORE_URL} external ring variant="primary" arrow>
            Get Trail for Chrome
          </ButtonLink>
          <ButtonLink to="/app/welcome" variant="quiet">
            First time? Start here
          </ButtonLink>
        </div>
      </Note>
    );
  }

  if (essays.status === 'loading' || ext.status === 'loading') return <Loading label="Reading your essays from the extension" />;
  if (essays.status === 'error') return <ErrorNote error={essays.error} retry={essays.reload} />;
  const list = [...essays.value].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  if (!list.length) return <Navigate to="/app/welcome" replace />;
  const words = list.reduce((n, e) => n + e.words, 0);

  return (
    <section className="grid gap-8 min-w-0" aria-labelledby="essays-title">
      <SectionHead
        as="h1"
        kicker="Register"
        index="Nº 01"
        title={<span id="essays-title">Essays</span>}
        lede={`${list.length} essay${list.length === 1 ? '' : 's'}, ${num(words)} words, each with its own record. Open one to replay it.`}
      />
      <Note crop watermark={false} className="p-0 gap-0">
        {/* the register's head: a faint wave field engraved from the essays' word counts */}
        <div className="relative isolate flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-5 border-b border-rule">
          <Guilloche seed="register" variant="waves" intensity="faint" data={list.map((e) => e.words)} fill />
          <span className="eyebrow">Register of essays</span>
          <Chip kind="neutral">
            {list.length} entr{list.length === 1 ? 'y' : 'ies'}
          </Chip>
        </div>
        <ScrollArea label="Essays">
          <table className={cx(TABLE, 'text-sm')}>
            <thead>
              <tr>
                <th className={cx(TH, 'pl-6 sm:pl-8')}>Entry</th>
                <th className={cx(TH, 'hide-phone text-right')}>Words</th>
                <th className={cx(TH, 'hide-phone text-right')}>Sessions</th>
                <th className={cx(TH, 'hide-phone')}>Typed / pasted</th>
                <th className={cx(TH, 'hide-phone')}>Growth</th>
                <th className={cx(TH, 'hide-phone pr-6 sm:pr-8 text-right')}>Last edit</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <EssayRow key={e.id} essay={e} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
        <Caption className="px-6 sm:px-8 py-4 border-t border-rule">
          Typed is the typed share (green) against the pasted share (sepia) of the final text; Growth is how the essay grew over time. The serial is the start of each essay's record id. Read from this computer's extension; nothing here is stored on Trail's servers.
        </Caption>
      </Note>
    </section>
  );
}

function EssayRow({ essay }: { essay: Essay }) {
  const nav = useNavigate();
  const to = `/app/essays/${encodeURIComponent(essay.id)}`;
  const [tl, setTl] = useState<ReturnType<typeof timeline> | null>(null);
  useEffect(() => {
    let alive = true;
    data
      .essayEvents(essay.id)
      .then((evs) => alive && setTl(timeline(evs)))
      .catch(() => alive && setTl([]));
    return () => {
      alive = false;
    };
  }, [essay.id]);
  const typedShare = essay.typed + essay.pasted ? essay.typed / (essay.typed + essay.pasted) : null;
  const title = essay.title || `Untitled ${editorName(essay.editor)} document`;
  return (
    <tr className="border-t border-rule first:border-t-0 cursor-pointer transition-colors hover:bg-well" onClick={() => nav(to)}>
      <td className={cx(TD, 'pl-6 pr-6 sm:pl-8 min-[701px]:pr-3 py-4 min-[701px]:max-w-[30rem] whitespace-normal!')}>
        <span className="grid gap-1 min-w-0">
          <Link to={to} className="font-sans text-base font-medium text-ink break-words underline-offset-[0.2em] hover:underline focus-visible:underline" title={title} onClick={(ev) => ev.stopPropagation()}>
            {title}
          </Link>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
            <span className="serial">
              <span aria-hidden="true">Nº </span>
              <span className="sr-only">Serial </span>
              {serialOf(essay.id)}
            </span>
            <span aria-hidden>·</span>
            <span>{editorName(essay.editor)}</span>
          </span>
          {/* phones: the share bar and last edit fold under the title */}
          <span className="min-[701px]:hidden flex items-center justify-between gap-3 pt-1 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <ShareBar typed={typedShare} width={72} label={typedShare === null ? 'No text yet' : `${pct(typedShare)} typed, ${pct(1 - typedShare)} pasted`} />
              <span className="text-typed">{pct(typedShare)} typed</span>
            </span>
            <span>{relative(essay.lastSeen)}</span>
          </span>
        </span>
      </td>
      <td className={cx(TD, 'hide-phone text-right')}>{num(essay.words)}</td>
      <td className={cx(TD, 'hide-phone text-right text-ink-soft')}>{essay.sessions}</td>
      <td className={cx(TD, 'hide-phone')}>
        <span className="inline-flex items-center gap-2">
          <ShareBar typed={typedShare} width={64} label={typedShare === null ? 'No text yet' : `${pct(typedShare)} typed, ${pct(1 - typedShare)} pasted`} />
          <span className="text-xs text-typed">{pct(typedShare)}</span>
        </span>
      </td>
      <td className={cx(TD, 'hide-phone text-typed')} title="How the essay grew over time">
        {tl ? <Sparkline timeline={tl} /> : <Skeleton className="w-24 h-6" />}
      </td>
      <td className={cx(TD, 'hide-phone pr-6 sm:pr-8 text-right text-ink-soft')}>{relative(essay.lastSeen)}</td>
    </tr>
  );
}
