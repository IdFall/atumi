-- Demandes de paiement (lancement, 2026-11-09) : l'élève paie par mobile money
-- (Wave, Orange Money…) au numéro de l'équipe, puis déclare son paiement dans
-- l'application (forfait, moyen, référence). L'administrateur vérifie la
-- réception et valide en un clic : le forfait est alors attribué.

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  provider text not null check (provider ~ '^[a-z_]{2,30}$'),
  reference text not null check (char_length(reference) between 3 and 80),
  status text not null default 'en_attente' check (status in ('en_attente', 'validee', 'refusee')),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  -- Une référence de paiement ne sert qu'une fois.
  unique (provider, reference)
);

create index payment_requests_status_created_idx on public.payment_requests (status, created_at);
create index payment_requests_user_created_idx on public.payment_requests (user_id, created_at desc);

alter table public.payment_requests enable row level security;
create policy "propriétaire : lecture" on public.payment_requests for select using (user_id = auth.uid());
create policy "propriétaire : envoi" on public.payment_requests for insert with check (user_id = auth.uid());

-- L'élève déclare un paiement ; seul l'administrateur change son état.
revoke insert, update, delete on public.payment_requests from anon, authenticated;
grant insert (user_id, plan_code, provider, reference) on public.payment_requests to authenticated;

-- Forfait proposé à l'achat dans le pays de l'élève, et pas plus de 3 demandes
-- en attente à la fois (évite les abus).
create function public.check_payment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'en_attente';
  new.subscription_id := null;
  new.handled_at := null;
  new.reference := trim(new.reference);

  perform pg_advisory_xact_lock(hashtext('atumi_paiement'), hashtext(new.user_id::text));

  if not exists (
    select 1 from public.plans p
    join public.profiles pr on pr.country_code = p.country_code
    where p.code = new.plan_code and p.kind = 'abonnement' and p.is_active and pr.id = new.user_id
  ) then
    raise exception 'ATUMI_FORFAIT_INCONNU';
  end if;

  if (select count(*) from public.payment_requests r
      where r.user_id = new.user_id and r.status = 'en_attente') >= 3 then
    raise exception 'ATUMI_TROP_DE_DEMANDES';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_payment_request() from public, anon, authenticated;

create trigger payment_requests_check
  before insert on public.payment_requests
  for each row execute function public.check_payment_request();

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

create function public.admin_payment_requests(p_status text default 'en_attente', p_limit int default 100)
returns table (
  id uuid, user_id uuid, username text, contact text, plan_code text, plan_label text,
  price_minor bigint, currency text, provider text, reference text, status text,
  handled_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select r.id, r.user_id, p.username, public.mask_contact(u.email, u.phone), r.plan_code, pl.label,
         pl.price_minor, pl.currency, r.provider, r.reference, r.status, r.handled_at, r.created_at
  from public.payment_requests r
  left join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  left join public.plans pl on pl.code = r.plan_code
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit greatest(least(p_limit, 500), 1);
end;
$$;

-- Valide : attribue le forfait au prix du forfait (journalisé par admin_grant_plan).
create function public.admin_confirm_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.payment_requests;
  v_subscription uuid;
begin
  perform public.require_admin();
  select * into r from public.payment_requests where id = p_id and status = 'en_attente' for update;
  if not found then
    raise exception 'ATUMI_DEMANDE_INCONNUE';
  end if;
  v_subscription := public.admin_grant_plan(r.user_id, r.plan_code, r.provider, r.reference, null);
  update public.payment_requests
    set status = 'validee', subscription_id = v_subscription, handled_at = now()
    where id = p_id;
end;
$$;

-- Refuse : paiement introuvable ou montant incorrect.
create function public.admin_reject_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform public.require_admin();
  update public.payment_requests set status = 'refusee', handled_at = now()
  where id = p_id and status = 'en_attente'
  returning user_id into v_user;
  if v_user is null then
    raise exception 'ATUMI_DEMANDE_INCONNUE';
  end if;
  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'paiement_refuse', v_user, jsonb_build_object('payment_request', p_id));
end;
$$;

revoke execute on function public.admin_payment_requests(text, int) from public, anon;
revoke execute on function public.admin_confirm_payment_request(uuid) from public, anon;
revoke execute on function public.admin_reject_payment_request(uuid) from public, anon;
grant execute on function public.admin_payment_requests(text, int) to authenticated;
grant execute on function public.admin_confirm_payment_request(uuid) to authenticated;
grant execute on function public.admin_reject_payment_request(uuid) to authenticated;
