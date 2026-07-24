import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ChatApp from "@/components/chat-app";

export default async function ChatPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <ChatApp />;
}
