# Legal & Tax Review — Golf Cup PWA — 2026-05-03

> Master-Report: `C:\Claude Code\Legal-Tax-Agents\REVIEW_2026-05-03.md`
> Disclaimer: keine Rechts-/Steuerberatung i.S.d. § 2 RDG / § 2 StBerG.

**Anbieter:** Klärungsbedarf (Comms Connect GmbH oder Roloff Holding GmbH? — kein Impressum/DSE im Code)
**Stack:** React 18 + Vite + Tailwind + Supabase

---

## ⚠️ KRITISCH — wenn die PWA öffentlich erreichbar ist

### [K1] Kein Impressum, keine Datenschutzerklärung

Sofern die PWA öffentlich zugänglich ist (nicht passwortgeschützt/intern), bestehen Pflichten:

**Norm:** § 5 DDG; Art. 13 DSGVO

**Maßnahme:** Impressum + DSE ergänzen ODER Login-Schutz einführen.

---

## HOCH

### [H1] RLS-Policies offen für anonymen Vollzugriff

`public_all using (true)` erlaubt anonymen Zugriff auf alle Tabellen inklusive Spielernamen und Handicaps.

**Norm:** Art. 32 DSGVO (Zugangskontrolle)

**Maßnahme:** Auth einbauen oder RLS-Policies auf authentifizierte User beschränken.

### [H2] Personenbezug Spielernamen + Handicap

Handicap = sportliche Leistungsangabe, KEIN Gesundheitsdatum i.S.d. Art. 9 DSGVO (h.M.). Aber Rechtsgrundlage Art. 6 DSGVO unklar.

**Maßnahme:** Wenn für Verein: Einwilligung Mitglieder oder Vereinsvertrag. Sonst Art. 6 Abs. 1 lit. b/f DSGVO begründen.

### [H3] Verantwortlichkeitsfrage Comms Connect vs. Verein

Wenn Comms Connect Betreiber + Verein gibt Daten ein:
- Comms Connect = Verantwortlicher (eigenes Betreiberinteresse), oder
- Verein = Verantwortlicher und Comms Connect = Auftragsverarbeiter → AVV nach Art. 28 Abs. 3 DSGVO

**Maßnahme:** RA-Klärung + ggf. AVV-Vorlage.

---

## MITTEL

**[M1]** Supabase EU-Region (Frankfurt) verifizieren (Art. 44 DSGVO).

---

## Sofort-Aktionen

| # | Aktion | Frist |
|---|---|---|
| 1 | **Wenn online: Login-Schutz oder Compliance-Rollout** | sofort |
| 2 | RLS-Policies verschärfen | sofort |
| 3 | Impressum + DSE ergänzen | 2 Wochen |
| 4 | Rollenklärung Comms Connect vs. Verein (RA) | 4 Wochen |
| 5 | Supabase EU-Region verifizieren | 1 Woche |

Detail: Master-Report Cluster E → 5.2.
