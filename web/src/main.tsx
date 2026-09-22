import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DEFAULT_CONFIG, loadSiteConfig } from "./lib/config";
import type { SiteConfig } from "./lib/types";
import "./index.css";

/** When the server has Clerk keys, the whole app runs inside ClerkProvider (loaded lazily so
 *  servers without Clerk never ship its code). Otherwise the app renders straight away. */
function Root() {
  const [cfg, setCfg] = useState<SiteConfig | null>(null);
  const [Provider, setProvider] = useState<null | ((p: { children: React.ReactNode }) => JSX.Element)>(null);
  useEffect(() => {
    loadSiteConfig().then(async (c) => {
      if (c.clerkPublishableKey) {
        const { ClerkProvider } = await import("@clerk/clerk-react");
        const key = c.clerkPublishableKey;
        setProvider(() => ({ children }: { children: React.ReactNode }) => (
          <ClerkProvider publishableKey={key} afterSignOutUrl="/">
            {children}
          </ClerkProvider>
        ));
      }
      setCfg(c);
    }).catch(() => setCfg(DEFAULT_CONFIG));
  }, []);
  if (!cfg) return null;
  const tree = (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
  return Provider ? <Provider>{tree}</Provider> : tree;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
