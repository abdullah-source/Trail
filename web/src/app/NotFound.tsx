import { usePageTitle } from '../components/useAsync';
import { ButtonLink } from '../design/components';
import { Guilloche, Note } from '../design/document';
import { PublicShell } from './shared';

export default function NotFound() {
  usePageTitle('Not found');
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
        <div className="w-[min(560px,90vw)] aspect-square">
          <Guilloche seed="404" intensity="faint" />
        </div>
      </div>
      <PublicShell>
        <Note frame serial="404·0000" label="Not found" className="relative">
          <h1 className="note-title">There is no page here.</h1>
          <p className="text-ink-soft">Nothing is filed at this address. The links below go somewhere that exists.</p>
          <div className="mk-btns">
            <ButtonLink to="/" variant="secondary" arrow>
              Back to Trail
            </ButtonLink>
            <ButtonLink to="/app" variant="quiet">
              Your essays
            </ButtonLink>
          </div>
        </Note>
      </PublicShell>
    </div>
  );
}
