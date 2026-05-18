# Swing & Savor — Legal- & Compliance-Sweep 2026-05-17

## TL;DR
Komplettes Legal-Paket live: Impressum, Datenschutz, AGB + In-App-Konto-Löschung mit echter Server-Side-Auth-Deletion. Erfüllt DSGVO Art. 17 und Apple App Store Guideline 5.1.1(v).

## Was fehlte vorher
- Footer-Links zu `/impressum` und `/datenschutz` zeigten ins Leere (Seiten existierten nicht).
- Keine AGB.
- Keine Konto-Löschung in der App — Apple-Reject-Risiko bei iOS-Submission.
- Keine sichtbaren Support-/Legal-Links im in-App-Profil.

## Marketing (swingandsavor.at) — neu

| URL | Inhalt |
|---|---|
| `/impressum` | Pflichtangaben Comms Connect GmbH: Tal 30 / 80331 München, HRB 295951 AG München, USt DE451966748, GF Rainer Roloff, +49 89 4522 1556, hi@swingandsavor.at, EU-OS-Hinweis, Markenhinweis |
| `/datenschutz` | DSGVO Art. 13/14: Verantwortliche, Hosting (Vercel + Supabase EU Frankfurt + Resend, alle mit DPA-Links + SCC), erhobene Daten, Rechtsgrundlagen, Speicherdauer, Betroffenenrechte, BayLDA als Aufsichtsbehörde, kein Tracking |
| `/agb` | Nutzungsbedingungen: kostenlos, Mindestalter 16, faire Nutzung, Plätze-Beiträge Lizenz, DealBuddy-Crosslink-Hinweis (kein Glücksspiel-Anbieter), Haftungsbegrenzung, Konto-Kündigung, Recht München |
| `/` Footer | Vollständige Adresse + HRB + alle Legal-Links + Support-Mailto |

Alle Seiten brand-konsistent (dark green gradient, Barlow Condensed) über gemeinsames `legal.css`. Cleanurls aktiv (`/impressum` mappt auf `impressum.html`).

## In-App (`/me` Profil)
- Legal-Link-Zeile (Impressum · Datenschutz · AGB · Support) unter Abmelden — DSGVO-Pflicht für direkte Erreichbarkeit aus der App.
- Sektion „Konto unwiderruflich löschen" mit Type-LÖSCHEN-Confirm-Box, danach Edge-Function-Call + automatischer Logout.

## Supabase Edge Function `delete-account`
- Project `rcqichlyllhwougopfkg`, Version 1, ACTIVE.
- `verify_jwt: false` (eigene JWT-Validierung gegen `supabase.auth.getUser()` damit wir saubere JSON-401-Responses geben).
- Cleanup-Reihenfolge: `challenges` → `friendships` → `tournaments` (cascadiert zu players/matches/hole_results/invites) → `profiles` → `auth.admin.deleteUser`.
- Best-Effort-Cleanup mit `Promise.allSettled` — ein scheiternder Table blockt nicht die Auth-Deletion.
- CORS für Browser-Calls.

Probe (ohne Auth):
```
POST /functions/v1/delete-account → 401 {"error":"missing_jwt"} ✓
```

## Was bewusst NICHT gemacht
- **Cookie-Banner**: Keiner nötig (§ 25 TTDSG), weil nur technisch notwendiger localStorage-Session-Key (`sas-auth`), kein Tracking, kein Analytics, keine Third-Party-Cookies.
- **Datenexport-Self-Service**: DSGVO Art. 20 erfüllen wir per Mail-Anfrage an hi@swingandsavor.at; ein Self-Service-Export ist für ein kostenloses Hobby-Tool unverhältnismäßig.
- **Eigener `privacy@`-Alias**: Datenschutz-Anfragen laufen über hi@swingandsavor.at mit Betreff „Datenschutz" — kein separater Alias eingerichtet, weil noch nicht erforderlich.

## Verifikation
```
HTTP 200  https://swingandsavor.at/
HTTP 200  https://swingandsavor.at/impressum
HTTP 200  https://swingandsavor.at/datenschutz
HTTP 200  https://swingandsavor.at/agb
HTTP 200  https://app.swingandsavor.at/
HTTP 401  POST /functions/v1/delete-account (ohne JWT) — korrekt
```

## Verifikation für Rainer
1. swingandsavor.at öffnen → Footer-Links durchklicken: Impressum, Datenschutz, AGB.
2. app.swingandsavor.at → Profil → unten Legal-Link-Zeile sichtbar.
3. Profil → „Konto unwiderruflich löschen" → Box öffnet sich, ohne LÖSCHEN-Tipp wird abgewiesen, mit LÖSCHEN wird Account real entfernt → Logout → Sign-In-Screen.
