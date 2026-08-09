import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { THEME_COOKIE } from "@/lib/theme-cookie";
import { LANGUAGE_COOKIE } from "@/lib/language-cookie";

export const metadata: Metadata = {
  title: "Zales — AI Workflow Automation",
  description: "A minimal, agentic, node-based automation canvas powered by custom AI models.",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/favicon-180.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Default to dark to match the store's own default — this is the value
  // that gets baked into the very first HTML response, so there's no
  // flash of the wrong theme before client JS runs.
  const theme = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
  // Same trick for language: bake the saved choice into the first HTML
  // response so a refresh never flashes back to the default language
  // (README §12.1 — "Refresh browser tidak mengembalikan bahasa default").
  const language = cookieStore.get(LANGUAGE_COOKIE)?.value === "en" ? "en" : "id";

  return (
    <html lang={language} className={`h-full antialiased ${theme === "dark" ? "dark" : ""}`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
