import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/useAsync';
import { PublicShell } from './shared';

export default function NotFound() {
  usePageTitle('Not found');
  return (
    <PublicShell>
      <div className="text-center grid gap-3 py-16">
        <span className="display text-5xl text-ink-faint" aria-hidden>
          ¶
        </span>
        <h1 className="text-2xl">There is no page here.</h1>
        <p className="text-ink-soft">
          <Link to="/" className="link">
            Home
          </Link>{' '}
          ·{' '}
          <Link to="/app" className="link">
            Your essays
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
