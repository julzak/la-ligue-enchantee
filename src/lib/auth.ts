import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

// Parse trophies from USER.NAME HTML
function parseUserName(raw: string): { cleanName: string } {
  const cleanName = raw.replace(/<[^>]*>/g, "").trim();
  return { cleanName };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "La Ligue Enchantée",
      credentials: {
        login: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        // Find user by clean name (case-insensitive)
        const users = await prisma.user.findMany();
        const user = users.find((u) => {
          const { cleanName } = parseUserName(u.name);
          return cleanName.toLowerCase() === credentials.login.toLowerCase();
        });

        if (!user) return null;

        // Password stored in plain text. Some users have it as their name,
        // others as name without spaces, others as something custom.
        const inputPwd = credentials.password.toLowerCase();
        const storedPwd = user.password.toLowerCase();
        const inputNoSpaces = inputPwd.replace(/\s+/g, "");

        if (storedPwd !== inputPwd && storedPwd !== inputNoSpaces) {
          return null;
        }

        const { cleanName } = parseUserName(user.name);

        return {
          id: String(user.id),
          name: cleanName,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { userId?: number }).userId = token.userId as number;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
