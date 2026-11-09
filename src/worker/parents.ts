/**
 * Avis au parent d'un lycéen mineur (choix d'Idrissa : « parent prévenu, peut
 * refuser »). L'avis est préparé par la base à l'inscription ; il part ici par
 * WhatsApp, avec un lien personnel pour refuser l'inscription. Sans réglages,
 * il reste en attente et l'équipe le voit dans l'administration.
 */

export interface ParentNotice {
  userId: string;
  username: string;
  guardianPhone: string;
  token: string;
  sentAt: string | null;
  refusedAt: string | null;
}

export interface ParentStore {
  getNotice(userId: string): Promise<ParentNotice | null>;
  listUnsent(limit: number): Promise<string[]>;
  markSent(userId: string): Promise<void>;
}

export type ParentSender = (notice: ParentNotice, refuseUrl: string) => Promise<void>;

export type ParentResult = "sent" | "already_sent" | "refused" | "not_configured" | "missing";

/** Lien que le parent ouvre pour refuser (page publique /accord-parental/<jeton>). */
export function refuseUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/accord-parental/${token}`;
}

export async function notifyParent(
  store: ParentStore,
  sender: ParentSender | null,
  appUrl: string | undefined,
  userId: string,
): Promise<ParentResult> {
  const notice = await store.getNotice(userId);
  if (!notice) return "missing";
  if (notice.refusedAt) return "refused";
  if (notice.sentAt) return "already_sent";
  if (!sender || !appUrl) return "not_configured";
  await sender(notice, refuseUrl(appUrl, notice.token));
  await store.markSent(userId);
  return "sent";
}

/**
 * WhatsApp Business (API Cloud de Meta) : modèle approuvé par Meta, à deux
 * variables (nom d'utilisateur de l'élève, lien pour refuser).
 */
export function parentWhatsappSender(config: {
  accessToken: string;
  phoneNumberId: string;
  template: string;
  language: string;
}): ParentSender {
  return async (notice, url) => {
    const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: notice.guardianPhone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: config.template,
          language: { code: config.language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: notice.username },
                { type: "text", text: url },
              ],
            },
          ],
        },
      }),
    });
    if (!response.ok) throw new Error(`WhatsApp refusé (${response.status})`);
  };
}

export function parentSenderFromEnv(env: Record<string, string | undefined>): ParentSender | null {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.PARENT_WHATSAPP_TEMPLATE) return null;
  return parentWhatsappSender({
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    template: env.PARENT_WHATSAPP_TEMPLATE,
    language: env.PARENT_WHATSAPP_LANGUAGE ?? "fr",
  });
}
