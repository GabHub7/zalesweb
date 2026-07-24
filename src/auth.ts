import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { query } from "@/lib/db/pool";
import { recordLoginEvent } from "@/lib/db/users";

interface DbUser {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  image: string | null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string || "").toLowerCase().trim();
        const password = (credentials?.password as string) || "";
        if (!email || !password) return null;

        const rows = await query<DbUser>("select * from users where email = $1", [email]);
        const user = rows[0];
        if (!user || !user.password_hash) return null; // no such user, or Google-only account

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          await query(
            "INSERT INTO users (id, email, name, image) VALUES (gen_random_uuid()::text, $1, $2, $3) ON CONFLICT (email) DO NOTHING",
            [user.email, user.name ?? null, user.image ?? null]
          );
        } catch {
          // Ignore race condition errors
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email && !token.userId) {
        const rows = await query<DbUser>("select id from users where email = $1", [user.email]);
        if (rows[0]) {
          token.userId = rows[0].id;
          try {
            const h = await headers();
            const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
            const userAgent = h.get("user-agent");
            await recordLoginEvent(rows[0].id, ip, userAgent);
          } catch {
            // headers() can be unavailable in some edge contexts — login still succeeds.
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
});
