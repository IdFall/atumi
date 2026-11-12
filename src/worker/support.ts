/**
 * Envoi à l'équipe des messages écrits depuis le centre d'aide, par e-mail et
 * par WhatsApp. Chaque canal est facultatif : sans réglages, il est ignoré et
 * le message reste consultable dans `support_requests`.
 */

export interface SupportRequest {
  id: number;
  userId: string;
  username: string;
  /** E-mail ou téléphone du compte, pour que l'équipe puisse répondre. */
  contact: string | null;
  message: string;
  createdAt: string;
  notifiedEmailAt: string | null;
  notifiedWhatsappAt: string | null;
}

export type SupportChannel = "email" | "whatsapp";

export interface SupportStore {
  getRequest(requestId: number): Promise<SupportRequest | null>;
  markNotified(requestId: number, channel: SupportChannel): Promise<void>;
}

export interface TeamNotification {
  subject: string;
  text: string;
}

export type Sender = (notification: TeamNotification, request: SupportRequest) => Promise<void>;

export type SupportResult = "sent" | "already_sent" | "not_configured" | "missing";

export function buildTeamNotification(request: SupportRequest): TeamNotification {
  const date = new Date(request.createdAt).toISOString().slice(0, 16).replace("T", " ");
  return {
    subject: `[AtumiNeo] Demande d'aide n° ${request.id} de ${request.username}`,
    text: [
      `Demande n° ${request.id} — ${date} UTC`,
      `Utilisateur : ${request.username}`,
      `Contact : ${request.contact ?? "non renseigné"}`,
      "",
      request.message,
    ].join("\n"),
  };
}

/**
 * Envoie la demande sur chaque canal configuré qui ne l'a pas encore reçue.
 * Une erreur d'envoi remonte pour que la file de tâches réessaie plus tard ;
 * les canaux déjà servis ne sont pas renvoyés.
 */
export async function notifyTeam(
  store: SupportStore,
  senders: Partial<Record<SupportChannel, Sender>>,
  requestId: number,
): Promise<SupportResult> {
  const request = await store.getRequest(requestId);
  if (!request) return "missing";

  const configured = (Object.keys(senders) as SupportChannel[]).filter((c) => senders[c]);
  if (configured.length === 0) return "not_configured";

  const pending = configured.filter((c) =>
    c === "email" ? request.notifiedEmailAt === null : request.notifiedWhatsappAt === null,
  );
  if (pending.length === 0) return "already_sent";

  const notification = buildTeamNotification(request);
  const failures: unknown[] = [];
  for (const channel of pending) {
    try {
      await senders[channel]!(notification, request);
      await store.markNotified(request.id, channel);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "Envoi à l'équipe incomplet");
  return "sent";
}

/** E-mail par l'API HTTP de Resend. */
export function emailSender(config: { apiKey: string; from: string; to: string[] }): Sender {
  return async (notification) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: config.to, subject: notification.subject, text: notification.text }),
    });
    if (!response.ok) throw new Error(`E-mail refusé (${response.status})`);
  };
}

/**
 * Paramètre de modèle WhatsApp : ni retour à la ligne, ni tabulation, ni plus
 * de quatre espaces de suite, longueur limitée.
 */
export function whatsappParam(text: string, max = 900): string {
  const flat = text.replace(/[\n\r\t]+/g, " · ").replace(/ {2,}/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * WhatsApp Business (API Cloud de Meta). Un message envoyé à l'initiative
 * d'ATUMI doit utiliser un modèle approuvé par Meta, à trois variables :
 * numéro de la demande, utilisateur et contact, message.
 */
export function whatsappSender(config: {
  accessToken: string;
  phoneNumberId: string;
  to: string[];
  template: string;
  language: string;
}): Sender {
  return async (_notification, request) => {
    for (const to of config.to) {
      const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "template",
          template: {
            name: config.template,
            language: { code: config.language },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: String(request.id) },
                  { type: "text", text: whatsappParam(`${request.username} (${request.contact ?? "contact non renseigné"})`, 200) },
                  { type: "text", text: whatsappParam(request.message) },
                ],
              },
            ],
          },
        }),
      });
      if (!response.ok) throw new Error(`WhatsApp refusé (${response.status})`);
    }
  };
}

function list(value: string | undefined): string[] {
  return (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** Canaux configurés par les variables d'environnement du worker. */
export function sendersFromEnv(env: Record<string, string | undefined>): Partial<Record<SupportChannel, Sender>> {
  const senders: Partial<Record<SupportChannel, Sender>> = {};
  const emailTo = list(env.SUPPORT_EMAIL_TO);
  if (env.RESEND_API_KEY && env.SUPPORT_EMAIL_FROM && emailTo.length > 0) {
    senders.email = emailSender({ apiKey: env.RESEND_API_KEY, from: env.SUPPORT_EMAIL_FROM, to: emailTo });
  }
  const whatsappTo = list(env.SUPPORT_WHATSAPP_TO);
  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && whatsappTo.length > 0) {
    senders.whatsapp = whatsappSender({
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      to: whatsappTo,
      template: env.SUPPORT_WHATSAPP_TEMPLATE ?? "atumi_demande_aide",
      language: env.SUPPORT_WHATSAPP_LANGUAGE ?? "fr",
    });
  }
  return senders;
}
