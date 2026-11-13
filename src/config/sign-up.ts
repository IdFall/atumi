/**
 * Inscription par numéro de téléphone : en pause (Idrissa, 2026-11-13) tant
 * qu'aucun service d'envoi de code (SMS ou WhatsApp) n'est branché dans
 * Supabase Auth. Seule l'adresse e-mail est acceptée à l'inscription ; la
 * connexion accepte toujours un numéro pour les comptes qui en auraient un.
 */
export const PHONE_SIGN_UP_OPEN = false;
