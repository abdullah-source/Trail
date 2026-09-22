import { useEffect, useState, type DependencyList } from 'react';

export type Async<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: Error };

/** Minimal async state for pages: no cache, no library. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): Async<T> & { reload: () => void } {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fn().then(
      (value) => alive && setState({ status: 'ready', value }),
      (error) => alive && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · Trail` : 'Trail — See how you write.';
    return () => {
      document.title = prev;
    };
  }, [title]);
}
