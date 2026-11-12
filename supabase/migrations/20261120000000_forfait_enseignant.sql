-- Forfait Enseignant (Idrissa, 2026-11-12) : tout le Premium, plus le « défi
-- classe ». Dans un défi classe, les élèves ne voient ni le score du
-- professeur ni la correction : seulement leur propre score, jusqu'à ce que
-- le professeur publie la correction (le défi est alors fermé et le même lien
-- montre la correction). 300 parties gardées par défi au lieu de 100.
--
-- Le mode classe vient du forfait (`plans.class_mode`), pas du rôle choisi à
-- l'inscription. Il est figé dans le défi à sa création ou à sa relance.

alter table public.plans
  add column class_mode boolean not null default false,
  add column challenge_play_limit int not null default 100 check (challenge_play_limit between 1 and 1000);

insert into public.plans (
  code, country_code, kind, label, price_minor, currency, duration_days,
  quiz_limit, quiz_question_limit, document_limit, tutor_message_limit,
  research_daily_limit, call_minutes_limit, library_bytes_limit, library_upload,
  class_mode, challenge_play_limit, is_active
) values
  ('sn-enseignant',    'SN', 'abonnement', 'Enseignant',          12000, 'XOF', 30, null, 20,  40,  600, 15,  90, 10737418240, true, true, 300, true),
  ('sn-enseignant-3m', 'SN', 'abonnement', 'Enseignant · 3 mois', 32000, 'XOF', 90, null, 20, 120, 1800, 15, 270, 10737418240, true, true, 300, true)
on conflict (code) do nothing;

alter table public.quiz_challenges
  add column class_mode boolean not null default false,
  add column play_limit int not null default 100 check (play_limit between 1 and 1000),
  add column correction_published_at timestamptz;

-- Réglages de défi du forfait en cours (essai compris), pour le serveur.
create function public.challenge_settings(p_user uuid)
returns table (class_mode boolean, play_limit int)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.class_mode, false), coalesce(p.challenge_play_limit, 100)
  from (select 1) one
  left join public.current_entitlement(p_user) e on true
  left join public.plans p on p.code = e.plan_code;
$$;

revoke execute on function public.challenge_settings(uuid) from public, anon, authenticated;

-- Une partie d'ami, seulement sur un défi ouvert ; `play_limit` parties gardées
-- au plus par défi (au-delà, l'ami joue mais rien n'est enregistré).
create or replace function public.record_challenge_play(p_challenge_id uuid, p_player_name text, p_correct int, p_total int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select id, user_id, play_limit into c from public.quiz_challenges
  where id = p_challenge_id and closed_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'ATUMI_DEFI_TERMINE';
  end if;
  if (select count(*) from public.quiz_challenge_plays p where p.challenge_id = c.id) >= c.play_limit then
    return;
  end if;
  insert into public.quiz_challenge_plays (user_id, challenge_id, player_name, correct, total)
  values (c.user_id, c.id, p_player_name, p_correct, p_total);
end;
$$;

revoke execute on function public.record_challenge_play(uuid, text, int, int) from public, anon, authenticated;
