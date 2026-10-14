import { usePageTitle } from '../components/useAsync';
import { ButtonLink } from '../design/components';
import { Dialog } from '../design/desktop';
import { PublicShell } from './shared';

export default function NotFound() {
  usePageTitle('Not found');
  return (
    <PublicShell>
      <div className="w-full max-w-md mx-auto">
        <Dialog
          title="There is no page here."
          icon="warning"
          iconFill={{ w: 'var(--paste)' }}
          className="win-open"
          actions={
            <>
              <ButtonLink to="/app">Your essays</ButtonLink>
              <ButtonLink to="/" ring>
                Home
              </ButtonLink>
            </>
          }
        >
          <p className="text-sm text-ink-soft">Nothing is filed at this address. The links below go somewhere that exists.</p>
        </Dialog>
      </div>
    </PublicShell>
  );
}
