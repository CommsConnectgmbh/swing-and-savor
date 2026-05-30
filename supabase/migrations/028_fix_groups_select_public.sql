-- ╭──────────────────────────────────────────────────────────────────────────╮
-- │ 028 — Fix: groups_select_public Self-Comparison-Bug + RLS-Rekursion        │
-- │                                                                            │
-- │ Bug 1: Der Mitglieds-Zweig prüfte `m.group_id = m.id` (immer falsch —      │
-- │   Member-FK gegen Member-PK) statt `m.group_id = community_groups.id`.     │
-- │   Folge: ein Mitglied konnte eine *private* Crew nicht lesen.              │
-- │ Bug 2 (latent, durch den Fix freigelegt): community_groups.SELECT liest    │
-- │   community_group_members, dessen SELECT-Policy wieder community_groups    │
-- │   liest -> 42P17 infinite recursion. Lösung: Mitgliedschaft über einen     │
-- │   SECURITY-DEFINER-Helper prüfen, der RLS umgeht und die Schleife bricht    │
-- │   (siehe Vorgabe: RLS-Helper auf geschützte Tabelle MÜSSEN definer sein).  │
-- ╰──────────────────────────────────────────────────────────────────────────╯

create or replace function is_community_member(g_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_group_members m
    where m.group_id = g_id and m.profile_id = auth.uid()
  );
$$;
grant execute on function is_community_member(uuid) to authenticated;

drop policy if exists groups_select_public on community_groups;
create policy groups_select_public on community_groups for select using (
  visibility = 'public'
  or owner_id = auth.uid()
  or is_community_member(id)
);
