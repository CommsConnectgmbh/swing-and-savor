-- ╭──────────────────────────────────────────────────────────────────────────╮
-- │ 025 — Fix: Empfänger kann Freundschaftsanfrage nicht annehmen             │
-- │                                                                            │
-- │ Bug: `friendships_rw` (for all) hatte `with check (... requested_by =      │
-- │ auth.uid())`. Da WITH CHECK auch bei UPDATE greift, konnte nur der         │
-- │ Anfragende die Zeile ändern — der Empfänger (requested_by != auth.uid())   │
-- │ wurde beim Setzen von status='accepted' von RLS geblockt. Decline (DELETE) │
-- │ ging, weil DELETE nur USING auswertet.                                     │
-- │                                                                            │
-- │ Fix: requested_by = auth.uid() nur noch beim INSERT erzwingen. UPDATE/     │
-- │ DELETE erlauben beide Beteiligten. SELECT bleibt bei friendships_read.     │
-- ╰──────────────────────────────────────────────────────────────────────────╯

drop policy if exists friendships_rw on friendships;

-- INSERT: nur der Anfragende selbst legt die Zeile an
drop policy if exists friendships_insert on friendships;
create policy friendships_insert on friendships for insert
  with check (auth.uid() in (user_a, user_b) and requested_by = auth.uid());

-- UPDATE: beide Beteiligten dürfen ändern (z.B. Empfänger -> status='accepted')
drop policy if exists friendships_update on friendships;
create policy friendships_update on friendships for update
  using (auth.uid() in (user_a, user_b))
  with check (auth.uid() in (user_a, user_b));

-- DELETE: beide Beteiligten dürfen löschen (Ablehnen / Entfreunden)
drop policy if exists friendships_delete on friendships;
create policy friendships_delete on friendships for delete
  using (auth.uid() in (user_a, user_b));
