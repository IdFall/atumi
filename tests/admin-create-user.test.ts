import { beforeEach, describe, expect, it, vi } from "vitest";

/** Création d'un compte par un administrateur : rôle vérifié, règles de l'inscription, rôle admin. */

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enqueue = vi.fn();
vi.mock("@/server/jobs/client", () => ({ enqueue: (...args: unknown[]) => enqueue(...args) }));

let isAdmin = true;
const createUser = vi.fn();
const inserts: { table: string; row: Record<string, unknown> }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createUserClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "admin-1" } } }) },
    rpc: async () => ({ data: isAdmin }),
  }),
  createServiceClient: () => ({
    auth: { admin: { createUser } },
    from: (table: string) => ({
      // Identifiant libre : aucun profil ne le porte encore.
      select: () => ({ eq: async () => ({ count: 0, error: null }) }),
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return { error: null };
      },
    }),
  }),
}));

const { createUserAction } = await import("@/server/admin/create-user");

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const teacher = { role: "enseignant", fullName: "Awa Diop", email: "awa@example.com", cycle: "lycee", age: "34", password: "provisoire1" };

beforeEach(() => {
  isAdmin = true;
  inserts.length = 0;
  createUser.mockReset();
  createUser.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
  enqueue.mockReset();
});

describe("back office : créer un utilisateur", () => {
  it("refuse un compte qui n'est pas administrateur", async () => {
    isAdmin = false;
    expect(await createUserAction({}, form(teacher))).toEqual({ formError: "forbidden" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("crée un enseignant confirmé, avec son rôle et au journal", async () => {
    const result = await createUserAction({}, form(teacher));
    expect(result.created).toMatchObject({ fullName: "Awa Diop", email: "awa@example.com", role: "enseignant" });
    const call = createUser.mock.calls[0][0];
    expect(call.email_confirm).toBe(true);
    expect(call.user_metadata).toMatchObject({ role: "enseignant", cycle: "lycee", full_name: "Awa Diop", username: "awa.diop" });
    expect(inserts.map((i) => i.table)).toEqual(["admin_actions"]);
  });

  it("un administrateur est inscrit dans admins et doit être majeur", async () => {
    await createUserAction({}, form({ ...teacher, role: "admin" }));
    expect(inserts.map((i) => i.table)).toEqual(["admins", "admin_actions"]);
    expect(inserts[0].row).toEqual({ user_id: "new-1" });

    const minor = await createUserAction({}, form({ ...teacher, role: "admin", age: "16" }));
    expect(minor.errors?.age).toBe("teacherMinor");
  });

  it("élève mineur : numéro du parent exigé, puis avis au parent", async () => {
    const student = { role: "eleve", fullName: "Moussa Ndiaye", email: "moussa@example.com", cycle: "lycee", age: "16", password: "provisoire1" };
    expect((await createUserAction({}, form(student))).errors?.guardianPhone).toBe("guardianPhoneRequired");
    await createUserAction({}, form({ ...student, guardianPhone: "77 123 45 67" }));
    expect(createUser.mock.calls[0][0].user_metadata.guardian_phone).toBe("+221771234567");
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("refuse un téléphone à la place de l'e-mail et une adresse déjà prise", async () => {
    expect((await createUserAction({}, form({ ...teacher, email: "771234567" }))).errors?.email).toBeDefined();
    createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    expect((await createUserAction({}, form(teacher))).errors?.email).toBe("identifierTaken");
  });
});
