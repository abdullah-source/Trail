// The essays list is a folder window in list view: one row per essay with the document icon,
// title, editor, words, sessions, typed share and growth, last seen (DESIGN-desktop.md §4).
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { data } from '../lib/data';
import type { Essay } from '../lib/types';
import { timeline } from '../lib/analysis';
import { useAsync, usePageTitle } from '../components/useAsync';
import { Sparkline, ShareBar } from '../components/Sparkline';
import { ButtonLink, Caption, Dialog, ErrorNote, Icon, Loading, ScrollArea, Skeleton, Window, cx } from '../components/ui';
import { editorName, num, pct, relative } from '../components/format';
import { CHROME_STORE_URL } from './shared';

const TH = 'marginal font-normal text-left px-2 py-1.5 whitespace-nowrap';
const TD = 'px-2 py-2 whitespace-nowrap align-middle';

export default function Essays() {
  usePageTitle('Essays');
  const ext = useAsync(() => data.extensionStatus(), []);
  const essays = useAsync(() => data.essays(), []);

  if (ext.status === 'ready' && !ext.value.installed) {
    return (
      <Dialog
        title="Trail Installer"
        icon="disk"
        className="max-w-xl win-open"
        actions={
          <>
            <ButtonLink to="/app/welcome" variant="quiet">
              First time? Start here
            </ButtonLink>
            <ButtonLink to={CHROME_STORE_URL} external ring variant="primary">
              Get Trail for Chrome
            </ButtonLink>
          </>
        }
      >
        <p className="text-sm">Nothing to show yet: the extension is not talking to this page.</p>
        <p className="text-sm text-ink-soft">Trail reads your essays straight from the extension on this computer. Nothing is uploaded, so this page is empty without it. Install it in Chrome on this computer, then come back here or open it from the extension popup. On a phone or another browser, your essays are only where the extension is.</p>
      </Dialog>
    );
  }

  if (essays.status === 'loading' || ext.status === 'loading') return <Loading label="Reading your essays from the extension" />;
  if (essays.status === 'error') return <ErrorNote error={essays.error} retry={essays.reload} />;
  const list = [...essays.value].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  if (!list.length) return <Navigate to="/app/welcome" replace />;

  return (
    <Window as="section" titleAs="h1" title="Essays" icon="folder" right={`${list.length} item${list.length === 1 ? '' : 's'}`} open bodyClassName="p-0">
      <ScrollArea label="Essays" maxHeight="70vh" className="bg-sheet border-x-0 border-t-0">
        <table className="w-full font-mono text-sm tabular border-collapse">
          <thead>
            <tr>
              <th className={TH}>Title</th>
              <th className={cx(TH, 'hide-phone')}>Editor</th>
              <th className={cx(TH, 'hide-phone text-right')}>Words</th>
              <th className={cx(TH, 'hide-phone text-right')}>Sessions</th>
              <th className={TH}>Typed</th>
              <th className={cx(TH, 'hide-phone')}>Growth</th>
              <th className={TH}>Last edit</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <EssayRow key={e.id} essay={e} />
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <Caption className="px-4 py-3 border-t border-rule">
        Typed is the typed share (green) against the pasted share (amber) of the final text; Growth is how the essay grew over time. Read from this computer's extension; nothing here is stored on Trail's servers.
      </Caption>
    </Window>
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
    <tr className="border-t border-rule cursor-pointer hover:bg-well" onClick={() => nav(to)}>
      <td className={cx(TD, 'max-w-[9rem] sm:max-w-[28rem]')}>
        <span className="inline-flex items-center gap-2 max-w-full">
          <Icon name="document" />
          <Link to={to} className="text-ink truncate underline-offset-[0.18em] hover:underline focus-visible:underline" title={title} onClick={(ev) => ev.stopPropagation()}>
            {title}
          </Link>
        </span>
      </td>
      <td className={cx(TD, 'hide-phone text-ink-soft')}>{editorName(essay.editor)}</td>
      <td className={cx(TD, 'hide-phone text-right')}>{num(essay.words)}</td>
      <td className={cx(TD, 'hide-phone text-right')}>{essay.sessions}</td>
      <td className={TD}>
        <span className="inline-flex items-center gap-2">
          <ShareBar typed={typedShare} label={typedShare === null ? 'No text yet' : `${pct(typedShare)} typed, ${pct(1 - typedShare)} pasted`} />
          <span className="text-xs text-ink-soft hide-phone">{pct(typedShare)}</span>
        </span>
      </td>
      <td className={cx(TD, 'hide-phone text-typed')} title="How the essay grew over time">
        {tl ? <Sparkline timeline={tl} /> : <Skeleton className="w-24 h-6" />}
      </td>
      <td className={cx(TD, 'text-ink-soft')}>{relative(essay.lastSeen)}</td>
    </tr>
  );
}
