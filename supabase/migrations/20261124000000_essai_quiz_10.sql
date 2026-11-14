-- Essai gratuit : quiz de 10 questions au lieu de 5 (décision d'Idrissa, 2026-11-14).
update public.plans set quiz_question_limit = 10 where kind = 'essai';
