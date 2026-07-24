import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AgentBuilder from "@/components/agent-builder";

export default async function AgentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <AgentBuilder />;
}
