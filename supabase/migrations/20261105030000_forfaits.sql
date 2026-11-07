-- Forfaits : chaque forfait fixe un nombre de quiz par période (essai ou abonnement).
-- Prix, durée et limites sont des données, par pays. La base refuse un quiz
-- au-delà de la limite, quel que soit le client qui l'écrit (application ou worker).

create table public.plans (
  code text primary key,
  country_code text not null references public.countries (code),
  kind text not null check (kind in ('essai', 'abonnement')),
  label text not null,
  price_minor bigint not null check (price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  duration_days int not null check (duration_days > 0),
  -- null = sans limite
  quiz_limit int check (quiz_limit is null or quiz_limit >= 0),
  is_active boolean not null default false
);

-- Un seul essai par pays.
create unique index plans_un_essai_par_pays on public.plans (country_code) where kind = 'essai';

alter table public.plans enable row level security;
create policy "forfaits : lecture" on public.plans for select using (is_active);
revoke insert, update, delete on public.plans from anon, authenticated;

alter table public.subscriptions
  add constraint subscriptions_plan_fk foreign key (plan_code) references public.plans (code);

-- Essai : 24 h (décision V1). La limite de quiz est provisoire, à valider.
insert into public.plans (code, country_code, kind, label, price_minor, currency, duration_days, quiz_limit, is_active)
values ('sn-essai', 'SN', 'essai', 'Essai gratuit', 0, 'XOF', 1, 3, true);

-- Droit en cours d'un utilisateur : abonnement actif, sinon essai en cours.
create function public.current_entitlement(p_user uuid)
returns table (plan_code text, quiz_limit int, period_start timestamptz, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select s.plan_code, p.quiz_limit, s.starts_at, s.ends_at
    from public.subscriptions s
    join public.plans p on p.code = s.plan_code
    where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
    order by s.ends_at desc
    limit 1
  )
  union all
  (
    select p.code, p.quiz_limit, t.started_at, t.ends_at
    from public.trials t
    join public.profiles pr on pr.id = t.user_id
    join public.plans p on p.country_code = pr.country_code and p.kind = 'essai'
    where t.user_id = p_user and t.started_at is not null and now() < t.ends_at
      and not exists (
        select 1 from public.subscriptions s
        where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
      )
  )
  limit 1;
$$;

revoke execute on function public.current_entitlement(uuid) from public, anon, authenticated;

-- Quiz restants pour l'utilisateur connecté (null = sans limite, 0 = plus de quiz).
create function public.quiz_quota()
returns table (plan_code text, quiz_limit int, used int, remaining int, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code, e.quiz_limit, u.used,
         case when e.quiz_limit is null then null else greatest(e.quiz_limit - u.used, 0) end,
         e.period_end
  from public.current_entitlement(auth.uid()) e
  cross join lateral (
    select count(*)::int as used from public.quizzes q
    where q.user_id = auth.uid() and q.created_at >= e.period_start and q.created_at < e.period_end
  ) u;
$$;

revoke execute on function public.quiz_quota() from public, anon;
grant execute on function public.quiz_quota() to authenticated;

create function public.check_quiz_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_used int;
begin
  -- Sérialise les créations de quiz d'un même utilisateur pour un décompte exact.
  perform pg_advisory_xact_lock(hashtext('quiz:' || new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  if e.quiz_limit is not null then
    select count(*) into v_used from public.quizzes q
    where q.user_id = new.user_id and q.created_at >= e.period_start and q.created_at < e.period_end;
    if v_used >= e.quiz_limit then
      raise exception 'LULU_QUOTA_QUIZ_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_quiz_quota() from public, anon, authenticated;

create trigger quizzes_quota
  before insert on public.quizzes
  for each row execute function public.check_quiz_quota();
