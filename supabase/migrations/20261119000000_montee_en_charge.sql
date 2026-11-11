-- Montée en charge (conseils Supabase, 2026-11-11) — aucune règle d'accès
-- ne change de sens.
--
-- 1. Règles RLS : `auth.uid()` devient `(select auth.uid())`, évalué une fois
--    par requête au lieu d'une fois par ligne (ALTER POLICY, sans DROP).
-- 2. Index sur les clés étrangères (suppressions en cascade et jointures).
-- 3. research_quota() n'est plus appelable sans compte (hygiène).

-- 1. Règles d'accès
alter policy "propriétaire : lecture" on public.admins using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.agenda_events using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.ai_usage using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.chapter_mastery using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.chapters using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.consents using (user_id = (select auth.uid()));
alter policy "contestation : création" on public.contestations with check (user_id = (select auth.uid()));
alter policy "contestation : lecture" on public.contestations using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.document_chunks using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.documents using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire" on public.exercise_attempts using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : avis" on public.help_questions using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.help_questions using (user_id = (select auth.uid()));
alter policy "propriétaire : ajout" on public.library_books with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.library_books using (user_id = (select auth.uid()));
alter policy "propriétaire : suppression" on public.library_books using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.modules using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : envoi" on public.payment_requests with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.payment_requests using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.plan_credits using (user_id = (select auth.uid()));
alter policy "profil : lecture" on public.profiles using (id = (select auth.uid()));
alter policy "profil : modification" on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quiz_answers using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quiz_attempts using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quiz_challenge_plays using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quiz_challenges using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quizzes using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.quota_consumptions using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.research_questions using (user_id = (select auth.uid()));
alter policy "propriétaire : suppression" on public.research_questions using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.shared_texts using (user_id = (select auth.uid()));
alter policy "propriétaire : suppression" on public.shared_texts using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.subscriptions using (user_id = (select auth.uid()));
alter policy "propriétaire : envoi" on public.support_requests with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.support_requests using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.syntheses using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.timetable_slots using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.trials using (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.tutor_calls using (user_id = (select auth.uid()));
alter policy "propriétaire" on public.tutor_conversations using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "propriétaire : lecture" on public.tutor_messages using (user_id = (select auth.uid()));

-- 2. Index des clés étrangères
create index if not exists admin_actions_target_user_id_fk_idx on public.admin_actions (target_user_id);
create index if not exists admin_actions_user_id_fk_idx on public.admin_actions (user_id);
create index if not exists agenda_events_module_id_user_id_fk_idx on public.agenda_events (module_id, user_id);
create index if not exists ai_usage_country_code_fk_idx on public.ai_usage (country_code);
create index if not exists chapters_module_id_user_id_fk_idx on public.chapters (module_id, user_id);
create index if not exists consents_user_id_fk_idx on public.consents (user_id);
create index if not exists contestations_answer_id_user_id_fk_idx on public.contestations (answer_id, user_id);
create index if not exists document_chunks_document_id_user_id_fk_idx on public.document_chunks (document_id, user_id);
create index if not exists documents_chapter_id_user_id_fk_idx on public.documents (chapter_id, user_id);
create index if not exists documents_module_id_user_id_fk_idx on public.documents (module_id, user_id);
create index if not exists documents_user_id_fk_idx on public.documents (user_id);
create index if not exists exercise_attempts_conversation_id_user_id_fk_idx on public.exercise_attempts (conversation_id, user_id);
create index if not exists modules_user_id_fk_idx on public.modules (user_id);
create index if not exists payment_requests_credit_id_fk_idx on public.payment_requests (credit_id);
create index if not exists payment_requests_plan_code_fk_idx on public.payment_requests (plan_code);
create index if not exists payment_requests_subscription_id_fk_idx on public.payment_requests (subscription_id);
create index if not exists plan_credits_plan_code_fk_idx on public.plan_credits (plan_code);
create index if not exists profiles_country_code_fk_idx on public.profiles (country_code);
create index if not exists profiles_education_level_id_fk_idx on public.profiles (education_level_id);
create index if not exists quiz_answers_attempt_id_user_id_fk_idx on public.quiz_answers (attempt_id, user_id);
create index if not exists quiz_answers_question_id_user_id_fk_idx on public.quiz_answers (question_id, user_id);
create index if not exists quiz_attempts_quiz_id_user_id_fk_idx on public.quiz_attempts (quiz_id, user_id);
create index if not exists quiz_challenge_plays_challenge_id_user_id_fk_idx on public.quiz_challenge_plays (challenge_id, user_id);
create index if not exists quiz_challenge_plays_user_id_fk_idx on public.quiz_challenge_plays (user_id);
create index if not exists quiz_challenges_quiz_id_user_id_fk_idx on public.quiz_challenges (quiz_id, user_id);
create index if not exists quiz_challenges_user_id_fk_idx on public.quiz_challenges (user_id);
create index if not exists quiz_questions_quiz_id_user_id_fk_idx on public.quiz_questions (quiz_id, user_id);
create index if not exists quizzes_chapter_id_user_id_fk_idx on public.quizzes (chapter_id, user_id);
create index if not exists quizzes_module_id_user_id_fk_idx on public.quizzes (module_id, user_id);
create index if not exists subscriptions_plan_code_fk_idx on public.subscriptions (plan_code);
create index if not exists subscriptions_user_id_fk_idx on public.subscriptions (user_id);
create index if not exists syntheses_chapter_id_user_id_fk_idx on public.syntheses (chapter_id, user_id);
create index if not exists timetable_slots_module_id_user_id_fk_idx on public.timetable_slots (module_id, user_id);
create index if not exists tutor_calls_conversation_id_user_id_fk_idx on public.tutor_calls (conversation_id, user_id);
create index if not exists tutor_conversations_chapter_id_user_id_fk_idx on public.tutor_conversations (chapter_id, user_id);
create index if not exists tutor_conversations_module_id_user_id_fk_idx on public.tutor_conversations (module_id, user_id);
create index if not exists tutor_conversations_user_id_fk_idx on public.tutor_conversations (user_id);
create index if not exists tutor_messages_conversation_id_user_id_fk_idx on public.tutor_messages (conversation_id, user_id);

-- 3. Hygiène des droits
revoke execute on function public.research_quota() from public, anon;
grant execute on function public.research_quota() to authenticated;
