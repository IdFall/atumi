import { CreateUserForm } from "@/components/admin/create-user-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { defaultCountry } from "@/config/countries";
import { getT } from "@/i18n/server";

/** Back office : créer un compte élève, enseignant ou administrateur. */
export default async function AdminCreateUserPage() {
  const t = await getT();
  const country = defaultCountry();
  return (
    <>
      <PageHeader title={t.admin.create.title} intro={t.admin.create.intro} />
      <Card title={t.admin.create.title}>
        <CreateUserForm studentCycles={country.openCycles} teacherCycles={country.teacherCycles} adultAge={country.adultAge} />
      </Card>
    </>
  );
}
