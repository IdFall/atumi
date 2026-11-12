import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTeamNotification,
  notifyTeam,
  sendersFromEnv,
  whatsappParam,
  type Sender,
  type SupportChannel,
  type SupportRequest,
  type SupportStore,
} from "@/worker/support";

function request(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    id: 12,
    userId: "6f1f3c1e-1d2b-4c3a-9e8f-0a1b2c3d4e5f",
    username: "awa",
    contact: "awa@exemple.sn",
    message: "Je n'arrive pas à payer.\nMerci",
    createdAt: "2026-11-07T10:30:00Z",
    notifiedEmailAt: null,
    notifiedWhatsappAt: null,
    ...overrides,
  };
}

function memoryStore(initial: SupportRequest | null): SupportStore & { marked: SupportChannel[] } {
  const marked: SupportChannel[] = [];
  return {
    marked,
    async getRequest() {
      return initial;
    },
    async markNotified(_id, channel) {
      marked.push(channel);
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("envoi des demandes d'aide à l'équipe", () => {
  it("le message à l'équipe contient l'utilisateur, son contact et le texte", () => {
    const n = buildTeamNotification(request());
    expect(n.subject).toBe("[AtumiNeo] Demande d'aide n° 12 de awa");
    expect(n.text).toContain("Contact : awa@exemple.sn");
    expect(n.text).toContain("2026-11-07 10:30 UTC");
    expect(n.text).toContain("Je n'arrive pas à payer.\nMerci");
  });

  it("envoie sur chaque canal configuré et le note", async () => {
    const store = memoryStore(request());
    const email = vi.fn<Sender>(async () => {});
    const whatsapp = vi.fn<Sender>(async () => {});
    expect(await notifyTeam(store, { email, whatsapp }, 12)).toBe("sent");
    expect(email).toHaveBeenCalledOnce();
    expect(whatsapp).toHaveBeenCalledOnce();
    expect(store.marked).toEqual(["email", "whatsapp"]);
  });

  it("à la reprise, ne renvoie pas un canal déjà servi", async () => {
    const store = memoryStore(request({ notifiedEmailAt: "2026-11-07T10:31:00Z" }));
    const email = vi.fn<Sender>(async () => {});
    const whatsapp = vi.fn<Sender>(async () => {});
    await notifyTeam(store, { email, whatsapp }, 12);
    expect(email).not.toHaveBeenCalled();
    expect(store.marked).toEqual(["whatsapp"]);
  });

  it("un canal en échec fait réessayer sans bloquer l'autre", async () => {
    const store = memoryStore(request());
    const email = vi.fn<Sender>(async () => {
      throw new Error("refusé");
    });
    const whatsapp = vi.fn<Sender>(async () => {});
    await expect(notifyTeam(store, { email, whatsapp }, 12)).rejects.toThrow("Envoi à l'équipe incomplet");
    expect(store.marked).toEqual(["whatsapp"]);
  });

  it("sans canal configuré ou sans demande, rien n'est envoyé", async () => {
    expect(await notifyTeam(memoryStore(request()), {}, 12)).toBe("not_configured");
    expect(await notifyTeam(memoryStore(null), { email: async () => {} }, 12)).toBe("missing");
  });

  it("les canaux ne sont actifs qu'avec tous leurs réglages", () => {
    expect(Object.keys(sendersFromEnv({}))).toEqual([]);
    expect(Object.keys(sendersFromEnv({ RESEND_API_KEY: "k", SUPPORT_EMAIL_FROM: "a@b.c" }))).toEqual([]);
    expect(
      Object.keys(
        sendersFromEnv({
          RESEND_API_KEY: "k",
          SUPPORT_EMAIL_FROM: "a@b.c",
          SUPPORT_EMAIL_TO: "x@y.z",
          WHATSAPP_ACCESS_TOKEN: "t",
          WHATSAPP_PHONE_NUMBER_ID: "1",
          SUPPORT_WHATSAPP_TO: "+221770000000, +221780000000",
        }),
      ),
    ).toEqual(["email", "whatsapp"]);
  });

  it("WhatsApp : modèle approuvé, variables sans retour à la ligne, un envoi par destinataire", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const senders = sendersFromEnv({
      WHATSAPP_ACCESS_TOKEN: "t",
      WHATSAPP_PHONE_NUMBER_ID: "123",
      SUPPORT_WHATSAPP_TO: "+221770000000,+221780000000",
    });
    const r = request();
    await senders.whatsapp!(buildTeamNotification(r), r);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/123/messages");
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("221770000000");
    expect(body.template.name).toBe("atumi_demande_aide");
    const params = body.template.components[0].parameters.map((p: { text: string }) => p.text);
    expect(params).toEqual(["12", "awa (awa@exemple.sn)", "Je n'arrive pas à payer. · Merci"]);
    expect(whatsappParam("a".repeat(2000)).length).toBe(900);
  });
});

describe("avis au parent", () => {
  const notice = {
    userId: "u1",
    username: "aminata",
    guardianPhone: "+221770000099",
    token: "00000000-0000-4000-8000-000000000001",
    sentAt: null as string | null,
    refusedAt: null as string | null,
  };

  function store(initial = notice) {
    let current = { ...initial };
    return {
      sent: () => current.sentAt,
      store: {
        getNotice: async () => current,
        listUnsent: async () => [],
        markSent: async () => {
          current = { ...current, sentAt: "now" };
        },
      },
    };
  }

  it("envoie le lien pour refuser, une seule fois", async () => {
    const { notifyParent } = await import("../src/worker/parents");
    const s = store();
    const urls: string[] = [];
    const sender = async (_n: unknown, url: string) => {
      urls.push(url);
    };
    expect(await notifyParent(s.store, sender, "https://atumi.vercel.app/", "u1")).toBe("sent");
    expect(urls).toEqual(["https://atumi.vercel.app/accord-parental/00000000-0000-4000-8000-000000000001"]);
    expect(await notifyParent(s.store, sender, "https://atumi.vercel.app", "u1")).toBe("already_sent");
    expect(urls).toHaveLength(1);
  });

  it("attend la configuration et n'écrit pas après un refus", async () => {
    const { notifyParent } = await import("../src/worker/parents");
    expect(await notifyParent(store().store, null, "https://atumi.vercel.app", "u1")).toBe("not_configured");
    expect(await notifyParent(store({ ...notice, refusedAt: "x" }).store, async () => {}, "https://a", "u1")).toBe("refused");
  });
});
