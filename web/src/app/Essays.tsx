import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { data } from '../lib/data';
import type { Essay } from '../lib/types';
import { timeline } from '../lib/analysis';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Sparkline, ShareBar } from '../components/Sparkline';
import { ButtonLink, EmptyState, ErrorNote, Loading, Marginal, SectionHead, Skeleton } from '../components/ui';
import { editorName, num, relative } from '../components/format';
import { CHROME_STORE_URL } from './shared';

export default function Essays() {
  usePageTitle('Essays');
  const ext = useAsync(() => data.extensionStatus(), []);
  const essays = useAsync(() => data.essays(), []);

  if (ext.status === 'ready' && !ext.value.installed) {
    return (
      <div className="grid gap-8">
        <SectionHead kicker="Your essays" title="Nothing to show yet: the extension is not talking to this page." lede="Longhand reads your essays straight from the extension on this computer. Nothing is uploaded, so this page is empty without it." />
        <EmptyState
          title="Install the extension in Chrome on this computer"
          body={
            <>
              Then come back here, or open it from the extension popup. On a phone or another browser, your essays are only where the extension is. <Link to="/app/welcome" className="link">First time? Start here.</Link>
            </>
          }
          action={<ButtonLink to={CHROME_STORE_URL} external>Get Longhand for Chrome</ButtonLink>}
        />
      </div>
    );
  }

  if (essays.status === 'loading' || ext.status === 'loading') return <Loading label="Reading your essays from the extension" />;
  if (essays.status === 'error') return <ErrorNote error={essays.error} retry={essays.reload} />;
  const list = [...essays.value].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  if (!list.length) return <Navigate to="/app/welcome" replace />;

  return (
    <div className="grid gap-8">
      <SectionHead kicker="Your essays" title="Every essay you have written with Longhand on." lede="Open one to replay it, see your sessions, and copy an honest AI-use statement." />
      <ol className="grid divide-y divide-rule border-t border-b border-rule">
        {list.map((e) => (
          <EssayRow key={e.id} essay={e} />
        ))}
      </ol>
      <p className="text-xs text-ink-faint">Read from this computer's extension. Nothing here is stored on Longhand's servers.</p>
    </div>
  );
}

function EssayRow({ essay }: { essay: Essay }) {
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
  return (
    <li>
      <Link to={`/app/essays/${encodeURIComponent(essay.id)}`} className="grid sm:grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2 items-center py-4 hover:bg-sheet transition-colors duration-150 -mx-2 px-2 rounded">
        <div className="min-w-0 grid gap-1">
          <span className="display text-lg leading-tight truncate">{essay.title || `Untitled ${editorName(essay.editor)} document`}</span>
          <span className="text-xs text-ink-soft tabular">
            {editorName(essay.editor)} · {num(essay.words)} words · {essay.sessions} session{essay.sessions === 1 ? '' : 's'} · last {relative(essay.lastSeen)}
          </span>
          <ShareBar typed={typedShare} className="max-w-[12rem]" />
        </div>
        <div className="text-typed">{tl ? <Sparkline timeline={tl} /> : <Skeleton className="w-24 h-6" />}</div>
        <Marginal className="hidden sm:block">Replay →</Marginal>
      </Link>
    </li>
  );
}
