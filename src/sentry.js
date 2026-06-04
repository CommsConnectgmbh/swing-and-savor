import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://4ce1f09bfcdb2525763ce4466564c158@o4511507613089792.ingest.de.sentry.io/4511507636093008",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
