# Swing & Savor — Social-Layer v2 (2026-05-17)

**Trigger:** Rainer: „zieh durch".

Schritte 3–6 + Team-Templates aus dem Home-Pivot-Plan komplett ausgerollt.

## Was jetzt drin ist

### Schema (Migration 005 + Storage)

`matches`:
- `visibility text` — Override über `tournaments.visibility`. NULL = erbt vom Cup.
- `photo_url text` — Cover-Foto im `match-photos` Storage-Bucket.
- `can_view_match()` Helper kombiniert Match- + Turnier-Visibility für künftige RLS.

`team_templates`:
- Pro User gespeicherte Spielerlisten (jsonb members), RLS owner-only.

`profiles`:
- `elo_rating int default 1500`, `games_played int`, `wins int`, `country_code text`.
- Index `profiles_elo_idx` für Rangliste.

`players`:
- `profile_id uuid` (optional) für künftiges Cross-Tournament-Player-Tracking.

`conversations` + `messages`:
- 1:1 DM, canonical-ordered (`user_a < user_b`), unique pair.
- Friends-only via RLS (`are_friends(user_a, user_b)` als Insert-Check).
- Trigger `bump_conv_last_message` rollt `last_message_at` hoch.
- Realtime auf beide Tabellen aktiv.
- RPC `get_or_create_conversation(other_user uuid)` — idempotent, throws bei „not friends".

ELO:
- `update_elo_for_challenge(c_id)` — Standard-ELO K=32 für 1v1 Singles-Challenges.
- Trigger `challenges_finish_elo` feuert auf `status` → `finished`.
- Brücken-Trigger `matches_finish_propagate`: wenn ein challenge-verlinkter Match auf `finished` geht, wird die Challenge automatisch finalisiert (`match.winner A/B/halved` → `winner_side challenger/opponent/halved`). Heißt: User tippt „Match beenden" und ELO updated sich ohne Extra-Klick.
- View `leaderboard_global` (top 200 nach ELO, only `games_played > 0`), `grant select` an anon + authenticated.

Storage:
- Bucket `match-photos`, public read, authed write/update/delete (Owner only).

### UI

**HomeScreen** — Cover-Foto:
- Wenn `m.photo_url` gesetzt, 16:9-Hero über der Card.
- Bei Live: kleine `● Live`-Pille oben links.

**MatchesScreen Create-Form** — 4 neue Zeilen unten:
1. **Visibility-Toggle** (4 Buttons): Turnier · Öffentlich · Freunde · Privat. Default „Turnier" (erbt).
2. **Gespeicherte Flights** — Liste der `team_templates` als Pills, jeweils mit `↑A`/`↑B`-Buttons zum Laden (legt fehlende Spieler automatisch in `players` an) und `×` zum Löschen.
3. **„★ Team A als Template / ★ Team B als Template"** Buttons aktivieren ein Inline-Save-Form (Name + „Speichern").

**MatchDetailScreen** — Foto:
- Optionales Cover-Foto oben (16:9).
- `+ Foto`-Button im Course-Banner mit `capture="environment"` (Smartphone-Kamera) und max-8 MB-Check.
- „Foto entfernen"-Button im Cover wenn Match nicht finished/locked.

**BrandHeader** — zwei neue Icons rechts:
- **Rangliste** (Pokal) → `/leaderboard`
- **Nachrichten** (Bubble) → `/messages`, mit Unread-Badge in Accent, Realtime-Subscription auf `messages`-Table für instant Update

**Neue Screens:**
- `/messages` (MessagesScreen) — Conversation-Liste mit Avatar, letzter Message, Zeitstempel (rel.), Unread-Pill, sortiert nach `last_message_at`.
- `/messages/:conversationId` (ConversationScreen) — Chat-Thread, Bubble-Layout (Brand-Grün für eigene, Surface für andere), Auto-Scroll-Bottom, Realtime-INSERT-Sub, Auto-Mark-Read beim Öffnen.
- `/leaderboard` (LeaderboardScreen) — Filter `Welt`/`Freunde`, „Mein Stand"-Karte (Rang/ELO/Matches/Siege), Top-200-Liste mit Gold/Silber/Bronze für die ersten drei, Tap-Through nach `/u/:handle`.

**ProfileScreen** — zwei kleine Erweiterungen:
- „Nachricht"-Button neben „Herausfordern" bei akzeptierten Freunden — ruft `get_or_create_conversation` RPC und navigiert direkt in den Thread.
- ELO-Badge in der Identity-Card (Cyan-Accent, klickbar → `/leaderboard`), nur sichtbar wenn `games_played > 0`.

### Wie ELO praktisch funktioniert

1. Rainer und Hans sind Freunde, Rainer fordert Hans heraus → Challenge `pending`.
2. Hans akzeptiert → Challenge `accepted`, parallel wird ein Tournament + Match angelegt.
3. Im Match Detail wird gescort → bei „Match beenden" geht `matches.status = 'finished'`.
4. Trigger `matches_finish_propagate` setzt Challenge automatisch auf `finished` + `winner_side`.
5. Trigger `challenges_finish_elo` ruft `update_elo_for_challenge` → ELO beider Profile wird angepasst (K-Faktor 32, Standard-Erwartungsformel).
6. Auf `/leaderboard` ist die neue Position sichtbar, im Profile-Header steht das neue ELO.

Für Tournament-Matches ohne Challenge-Verknüpfung passiert noch nichts an ELO — das käme als nächster Schritt, sobald `players.profile_id` flächendeckend genutzt wird (z.B. beim Onboarding eines bestehenden Spielers in ein Tournament den Profile-Match anbieten).

### Privacy / Anti-Spam

- DMs nur zwischen Freunden — RLS-Check auf `conv_insert` UND `msg_insert`. Auch bei manueller SQL-Manipulation kommen keine Nachrichten von Fremden durch.
- Match-Visibility kann pro Match strenger sein als der Cup (z.B. „Cup public" + „mein bisheriges Match aber friends-only").
- Globale Rangliste zeigt nur User mit `games_played > 0` — wer noch nie gespielt hat, taucht nicht auf.

### Bewusst noch nicht drin

- **Web-Push-Notifications** — Browser/Native-Notifications für neue DMs. Braucht eigene Pipeline (Service Worker + Push-Endpoint + OneSignal o.ä.).
- **Group-DMs / Match-Threads** — Schema steht für 1:1; Gruppen-Chats wären `conversation_members` als Join-Table.
- **ELO für Tournament-Matches** — wartet auf flächendeckendes `players.profile_id`-Mapping.
- **Country-Code Erfassung** — Spalte da, UI noch nicht. Default `null` reicht, bis ein Country-Filter auf der Rangliste kommt.
- **Foto-Lightbox** — Tap-to-Fullscreen auf Cover-Fotos.

## Verifikation

- `npm test -- --run` → 14/14 grün
- `npm run build` → 10.1 s sauber, 3 neue Chunks (Messages/Conversation/Leaderboard ~5–8 kB gzip jeder)
- Migration 005 applied (Status: success)
- Storage-Bucket `match-photos` provisioniert + Policies gesetzt
- Commits: `ed6326b` (Home-Pivot) → `b02c59d` (Social v2) auf `main`, gepusht
- Vercel-Deploy läuft, Live-Bundle-Check im Hintergrund

## Smoke-Test (8 Schritte)

1. App neu öffnen → landet auf `/home`, Header rechts hat zwei neue Icons (Rangliste + Nachrichten).
2. Auf `/me` → bei sich selbst ELO-Badge `1500` neben HC sichtbar (sobald ein Match beendet wurde, ändert sich der Wert).
3. Auf ein Freund-Profil (`/u/handle`) → „Nachricht"-Button erscheint neben „Herausfordern". Tappen → öffnet `/messages/<id>`, Thread leer.
4. Nachricht senden → erscheint sofort als grüne Bubble; im zweiten Browser/Tab des Empfängers ploppt sie via Realtime auf, Unread-Badge im Header zeigt `1`.
5. Auf `/leaderboard` → eigene Position in der „Mein Stand"-Karte, ggf. leere Liste solange noch niemand gespielt hat.
6. Auf `/matches` → `+ Match` → ganz unten neue **Sichtbarkeit**-Zeile (4 Optionen) und **„★ Team A als Template"**.
7. Match mit 2 Spielern anlegen → Template speichern → in einem neuen Match Template als Team B laden → Spieler werden automatisch angelegt.
8. Auf MatchDetail → `+ Foto` im Course-Banner → Kamera auf Mobile / File-Picker auf Desktop → 16:9-Cover erscheint, Foto erscheint auch in der HomeScreen-Card.

— Claude Opus 4.7 (1M)
