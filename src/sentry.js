import * as Sentry from "@sentry/react";

// Nur Fehlerberichte: kein Performance-Tracing (browserTracingIntegration) und
// kein Session-Tracking (BrowserSession sendet sonst bei jedem Seitenaufruf
// einen Ping). Damit geht vor einer Einwilligung nur dann etwas an Sentry,
// wenn tatsaechlich ein Fehler auftritt (siehe Datenschutzerklaerung, Ziffer 2a).
Sentry.init({
  dsn: "https://4ce1f09bfcdb2525763ce4466564c158@o4511507613089792.ingest.de.sentry.io/4511507636093008",
  integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
