# Swing & Savor — Social Layer Report
**Datum:** 2026-05-16

## Was die App jetzt kann

### Auth-Layer (Email OTP)
- Email eingeben → Code per Mail → 6-stelliger Code eingeben → eingeloggt
- Persistente Session (Supabase localStorage)
- Kein Passwort, kein Magic-Link (`feedback_8digit_code_login`)
- Onboarding-Flow nach Erst-Login: Anzeigename + Benutzername (@handle) + optional HC + Heimatclub

### Profile-System
- `/me` zeigt eigenes Profil mit Avatar-Initial, HC, Heimatclub
- `/u/:handle` zeigt fremdes Profil
- **Match-Play-Statistik pro Profil**: Matches, Win-Rate %, Löcher-gewonnen %, Siege/Halved/Niederlagen
- Sign-Out im Profil-Tab

### Freunde-System
- 3-Tabs: **Freunde** | **Anfragen (mit Counter)** | **Suchen**
- Suche nach `@handle` oder Anzeigename
- Anfrage → Pending → Accept/Decline-Flow
- Friend-List zeigt Display-Name + Handle + HC
- Klick auf Friend öffnet sein Profil mit Stats

### Tournament-Visibility
- **Öffentlich** — alle sehen es im Discover-Feed
- **Freunde** — nur Friends des Owners sehen es
- **Privat** — nur eingeladene Profile sehen es
- Jedes Turnier hat einen 8-Zeichen **Invite-Code** (autogeneriert, ohne verwechselbare Zeichen wie `0/o/1/l/i`)
- In der Tournament-Liste: Code anklicken → Clipboard

### Discover-Feed
- Listet alle sichtbaren Turniere (RLS sortiert automatisch nach Visibility)
- Active-Turniere immer oben + Pulse-Dot
- Visibility-Badge pro Row (Öffentlich/Freunde/Privat)
- **Join-by-Code**: 8-stelligen Invite-Code eingeben → Turnier-Invite wird angelegt → Board zeigt's

### Smart Logic: Auto-Pair
- Auf Matches-Screen ohne bestehende Matches taucht eine **"⚡ Faire Paarung"**-Card auf
- **Singles**: Spieler werden nach Handicap sortiert + paarweise gematcht (kleinste HC-Differenz)
- **Doubles**: Innerhalb jedes Teams High+Low gepaart → dann Team-Paare nach Durchschnitts-HC gematcht
- Ein-Klick-Erstellung aller Matches

### Empty-State CTA
- Board zeigt jetzt **"+ Turnier anlegen"**-Button direkt im Empty-State → routet zu `/cup?new=1` und öffnet Form

### Routing
| Path | Screen | In BottomNav |
|---|---|---|
| `/board` | Live-Leaderboard | ✓ |
| `/discover` | Public-Feed + Code-Join | ✓ |
| `/matches` | Matches-Liste + Auto-Pair | ✓ |
| `/friends` | Friends-System | ✓ |
| `/me` | Eigenes Profil | ✓ |
| `/u/:handle` | Fremdes Profil | – |
| `/cup` | Tournament-Verwaltung | über `/me` |
| `/teams` | Spieler-Listen | über `/me` |
| `/matches/:id` | Live-Scoring | über `/board` |

## Was Rainer NOCH machen muss

### 1× Migration ausführen (5 Minuten)
1. https://supabase.com/dashboard/project/atusckkhihgndfxtufsx/sql/new
2. Inhalt von `supabase/migrations/002_social_layer.sql` kopieren
3. **Run** klicken
4. Fertig — App ist live-kompatibel

Bis die Migration läuft funktioniert App-seitig:
- ❌ Sign-In schlägt fehl (kein `profiles`-Table)
- ❌ Friends-Tab leer
- ❌ Visibility-Pills im Cup-Form werden ignoriert

Nach der Migration:
- ✅ Sign-In + Onboarding läuft
- ✅ Alle bestehenden Turniere bleiben sichtbar (legacy-Compat: `owner_id IS NULL → public`)
- ✅ Neue Turniere kriegen automatisch `owner_id = aktueller User` + `invite_code`

### Supabase Auth-Konfiguration (1×)
Im Supabase Dashboard → Authentication → Providers → Email:
- **Confirm email**: AN
- **Email OTP**: AN (sollte default sein)
- **Magic Link**: KANN AUS sein
- Code-Länge: default 6 (kann auf 8 erhöht werden, siehe `feedback_8digit_code_login`)

→ Supabase-eigene SMTP funktioniert für Start (~30 mails/h). Später ggf. Resend SMTP konfigurieren (`reference_belegify_resend` als Vorlage).

## Was als nächstes sinnvoll wäre

### Phase 2 (wenn Profile/Friends genutzt werden)
- **profile_id auf `players`-Tabelle**: aktuell ist Player nur ein Name+HC. Wenn wir Player mit User-Account verknüpfen, werden Stats granular (pro-User statt nur pro-Owner-Sicht)
- **Push-Notifications** via Web-Push API + Service-Worker (z.B. "Dein Match ist live", "Anna hat dich befreundet")
- **Activity-Feed** im Discover (statt nur Turniere-Liste): "Anna hat Cup gestartet", "Bernd hat 7&6 gewonnen"
- **Tournament-Invite-Mail**: Eigene Edge-Function die `tournament_invites` + Resend SMTP nutzt um Einladungslinks zu mailen

### Phase 3 (nice-to-have)
- Avatar-Upload via Supabase Storage
- Live-Watch-Indicator ("3 schauen zu")
- Course-Database (Heimatclub auto-complete)
- Score-Anomalie-Detection (typo-protection bei strokes)

## Stand
- ✅ Code deployed auf https://app.swingandsavor.at
- ⏳ Supabase-Migration muss noch laufen (siehe oben)
