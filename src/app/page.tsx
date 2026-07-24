import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CanvasApp from "@/components/canvas-app";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  return <CanvasApp />;
}
