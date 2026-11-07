-- Forfait « testeur » : accès complet sans limites, réservé à l'équipe ATUMI
-- pour essayer toutes les pages et fonctions. Jamais proposé à l'achat
-- (is_active = false). Il est attribué à la main par une ligne dans
-- `subscriptions` (payment_provider = 'interne'), par exemple :
--
--   insert into public.subscriptions (user_id, plan_code, status, amount_minor, currency, payment_provider, payment_reference, starts_at, ends_at)
--   select id, 'sn-testeur', 'active', 0, 'XOF', 'interne', 'testeur-equipe-' || username, now(), now() + interval '365 days'
--   from public.profiles where username = '<nom d''utilisateur>';

insert into public.plans (
  code, country_code, kind, label, price_minor, currency, duration_days,
  quiz_limit, call_minutes_limit, document_limit, tutor_message_limit, quiz_question_limit, is_active
) values (
  'sn-testeur', 'SN', 'abonnement', 'Accès testeur (équipe ATUMI)', 0, 'XOF', 365,
  null, null, null, null, 10, false
)
on conflict (code) do nothing;
