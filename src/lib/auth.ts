import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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

        const inputPwd = credentials.password;
        const storedPwd = user.password;

        // Check if stored password is a bcrypt hash
        if (storedPwd.startsWith("$2a$") || storedPwd.startsWith("$2b$")) {
          // Compare with bcrypt
          const match = await bcrypt.compare(inputPwd, storedPwd);
          if (!match) return null;
        } else {
          // Legacy plain text comparison (case-insensitive)
          const inputLower = inputPwd.toLowerCase();
          const storedLower = storedPwd.toLowerCase();
          const inputNoSpaces = inputLower.replace(/\s+/g, "");
          if (storedLower !== inputLower && storedLower !== inputNoSpaces) {
            return null;
          }
          // Auto-migrate: hash the plain text password on successful login
          const hashed = await bcrypt.hash(inputPwd, 10);
          await prisma.$executeRawUnsafe(
            "UPDATE USER SET PASSWORD = ? WHERE ID_USER = ?",
            hashed, user.id
          );
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
  // Allow HTTP cookies when not on HTTPS (testing on VPS without SSL)
  ...(process.env.NEXTAUTH_URL?.startsWith("http://") ? {
    cookies: {
      sessionToken: {
        name: "next-auth.session-token",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
      callbackUrl: {
        name: "next-auth.callback-url",
        options: { sameSite: "lax" as const, path: "/", secure: false },
      },
      csrfToken: {
        name: "next-auth.csrf-token",
        options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
      },
    },
  } : {}),
};
