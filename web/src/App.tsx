import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui';
import Login, { ClerkDone } from './app/Login';
import Verify from './app/Verify';
import NotFound from './app/NotFound';

// The authenticated app (replay engine, analysis, pages) is one lazy chunk so the marketing
// pages ship only what they need (DECISIONS §7 budget).
const AppShell = lazy(() => import('./components/AppShell').then((m) => ({ default: m.AppShell })));
const Essays = lazy(() => import('./app/Essays'));
const EssayPage = lazy(() => import('./app/Essay'));
const Patterns = lazy(() => import('./app/Patterns'));
const Invite = lazy(() => import('./app/Invite'));
const Settings = lazy(() => import('./app/Settings'));
const Welcome = lazy(() => import('./app/Welcome'));
// The public demo shares the app's replay engine, so it is lazy too: the marketing bundle stays small.
const Demo = lazy(() => import('./marketing/pages/Demo'));

// Marketing pages and layout are owned by the design agent (src/marketing/pages, src/design).
import { Home, HowItWorks, Pricing, Privacy, Terms, MarketingLayout } from './marketing/pages';
import Install from './marketing/pages/Install';

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh grid place-items-center">
          <Loading />
        </div>
      }
    >
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/install" element={<Install />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/done" element={<ClerkDone />} />
          <Route path="/invite/:code" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Essays />} />
          <Route path="essays/:id" element={<EssayPage />} />
          <Route path="patterns" element={<Patterns />} />
          <Route path="invite" element={<Invite />} />
          <Route path="settings" element={<Settings />} />
          <Route path="welcome" element={<Welcome />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
