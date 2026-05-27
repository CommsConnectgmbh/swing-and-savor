# Apple Resubmit 1.0(4) — Swing & Savor — 2026-05-27

**Vorheriges Reject:** 2026-05-26 21:05 CET, Submission `b5f707ba-9de6-42b2-98e3-91c6d3e60b03`, Build 1.0(3), iPad Air 11" iPadOS 26.5, Guideline 2.1(a) Information Needed.

**Apple-Wortlaut (zweite Iteration):**
> "make sure the demo accounts you provide include pre-populated content so that we can verify all the features in the app, such as multiple users in chat in order to review safety mechanisms."

Apple hat den 1.0(3)-Build wegen leerem Demo-Account und fehlenden Safety-Mechanismen für UGC abgelehnt. Die App hat ein DM-Feature (`conversations` + `messages`), aber bisher weder Block/Report-UI noch reviewer-sichtbaren Chat.

## Was diese Iteration liefert

### 1. Safety-Mechanismen (Guideline 1.2 UGC)

**Migration 023** legt zwei Tabellen + drei RPCs an:

| Objekt | Zweck |
|---|---|
| `user_blocks(blocker_id, blocked_id, created_at)` | Blockierte Konten pro User |
| `message_reports(message_id, reporter_id, reason, created_at)` | Reports auf einzelne DM-Messages |
| `block_user(target)` / `unblock_user(target)` RPCs | Beidseitig idempotent, SECURITY DEFINER |
| `report_message(m_id, reason)` RPC | 3 unique Reports → `messages.hidden = true` |

**RLS-Filter** ergänzt auf `conversations`, `messages`, `match_comments` und `friendships`: alle SELECT-Policies prüfen jetzt `not exists (… user_blocks where blocker = auth.uid() …)` — geblockte Konten verschwinden komplett aus dem sozialen Graph des Blockers (DMs, Kommentare, Friend-Requests).

**UI:**

- `ConversationScreen` — Header-Overflow-Menü (`⋮`) mit "@handle blockieren". Pro Message vom Counter-Party: "Melden"-Link unten + Long-Press / Right-Click triggert denselben Report-Flow. Nach Report visuelle Bestätigung "Gemeldet · wird geprüft".
- `ProfileScreen` — neue Section "Blockierte Konten" (sichtbar nur wenn ≥1 Block existiert), Liste mit Avatar/Handle und Entsperren-Button.

`CommentsThread` hatte bereits `report_comment`-Flow (existing).

### 2. Reviewer-Bypass-Seed v9

`supabase/functions/reviewer-bypass/index.ts` seedet jetzt idempotent:

| Objekt | Anzahl | Detail |
|---|---|---|
| Auth-Users (Demo-Partner) | 3 | `lena.eagle@demo.swingandsavor.at`, `sam.birdie@demo.swingandsavor.at`, `tom.putter@demo.swingandsavor.at`, alle `email_confirm: true`, `user_metadata.demo = true` |
| `profiles` für Demo-Partner | 3 | handles `lena_eagle`, `sam_birdie`, `tom_putter` mit Display-Name + HCP + Home-Club |
| `friendships` | 3 | Reviewer ↔ jeder Demo-User, `status = 'accepted'` |
| `conversations` | 2 | Reviewer ↔ Lena, Reviewer ↔ Sam |
| `messages` | 10 | 5 je Conversation, **bidirektional** — Apple sieht "multiple users in chat" |
| `tournaments` | 1 | "🍃 Apple Review Demo Cup" (existiert weiter aus v8-Seed) |
| `matches` | 2 | finished singles + active doubles |
| `hole_results` | 27 | 18 + 9 |
| `match_comments` | 5 | Mixed authors (Reviewer + Sam + Lena + Tom) |
| `match_reactions` | 3 | gemischt |

Idempotenz pro Sub-Step: existiert ein Demo-Partner-User bereits → reuse. Existiert eine Conversation bereits mit Messages → skip. Existiert das Tournament → skip (Matches+Comments bleiben aus alter Seed).

### 3. call_send_push() Bug-Fix

Pre-existing Bug: `call_send_push()` deklarierte eine lokale Variable `key` und führte dann `select … from app_config where key = 'push_internal_key'` aus — Postgres warf `42702: column reference "key" is ambiguous`. Der `messages_push` AFTER-Insert-Trigger callt diese Function — jeder Message-Insert ist also **silently** gefailt. In Production fiel das nie auf, weil `push_url` in `app_config` `NULL` ist → Function returnt vor dem Bug. Sobald ein push_url-Wert gesetzt würde, wäre DMs komplett blockiert gewesen.

**Fix:** Variablen umbenannt zu `push_endpoint` + `internal_key`, alle Spalten-Refs explizit `app_config.key` qualifiziert. In Migration noch nicht abgelegt — wurde direkt via `apply_migration` deployed (`fix_call_send_push_ambiguous_key`).

### 4. iOS Build Bump

`native/ios/App/App.xcodeproj/project.pbxproj`: `CURRENT_PROJECT_VERSION = 3 → 4` (beide Configs, Watch-Target bleibt detached).

`MARKETING_VERSION` bleibt `1.0` → neuer Build `1.0(4)`.

### 5. ASC App Review Notes

`scripts/asc-submission.mjs` `META.reviewer.notes` komplett neu geschrieben:

- Demo-Account Login-Steps in 5 Schritten
- Liste der pre-populated Inhalte (inkl. "2 active DM conversations with 5 bidirectional messages each")
- Vier UGC-Safety-Mechanismen explizit benannt: Block / Report Messages / Report Comments / Content Filtering + Contact
- Was-ist-neu seit 1.0(3): Block, Report, Demo-Seed-Erweiterung, Camera-Plist behalten

## Pipeline

```bash
git push origin main                 # commit 920dc45
git tag -a ios-v1.0.3 -m "…"
git push origin ios-v1.0.3
```

CI Run **26506555301** (macos-26 / iOS 26 SDK) baut + uploaded TestFlight automatisch.

Nach TestFlight-Processing (~10–15 min):

```bash
node scripts/asc-submission.mjs          # patcht Notes + verlinkt Build 4
node scripts/asc-submission.mjs --submit # legt ReviewSubmission an, submitted automatically
```

## Was Apple beim Login sieht

1. **Home / Feed** — Match-Updates aus dem Demo Cup
2. **Cup** — "🍃 Apple Review Demo Cup", 4 Spieler, finished + active match
3. **MatchDetail** — komplettes 18-Loch-Scorecard, Comments, Reactions
4. **Discover / Freunde** — 3 akzeptierte Friendships
5. **Messages** — 2 aktive Konversationen mit Mehrnutzer-Chat, beidseitige Messages
6. **Profile / Me** — Stats, Heimatclub, Legal-Links, optionaler "Blockierte Konten"-Block
7. **Safety** — In jeder Conversation: Block-Menü + Per-Message-Report-Button; in MatchDetail-Comments: Report-Link

## Files

| File | Δ |
|---|---|
| `supabase/migrations/023_safety_blocks_and_reports.sql` | new (+131) |
| `supabase/functions/reviewer-bypass/index.ts` | rewrite (v8 → v9, +200 / -50) |
| `src/screens/ConversationScreen.jsx` | +60 (menu, report, blocked-confirm) |
| `src/screens/ProfileScreen.jsx` | +30 (blocked-users-section) |
| `native/ios/App/App.xcodeproj/project.pbxproj` | bump (2 sed reps) |
| `scripts/asc-submission.mjs` | notes rewrite (+30 / -10) |

Commit: `920dc45 main`, Tag: `ios-v1.0.3`.
