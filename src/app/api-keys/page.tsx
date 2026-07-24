import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ApiKeysApp from "@/components/api-keys-app";

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <ApiKeysApp />;
}
