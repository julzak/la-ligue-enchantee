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

        // Find user by clean name (case-insensitive).
        // Pre-filter in SQL using the first word of the login (before any / or space)
        // to reduce rows loaded, then exact-match after stripping HTML tags in JS.
        // Some pseudos have legacy duplicates in USER (old seasons). Prefer the
        // one that is currently registered in a league; fallback to max id.
        const firstWord = credentials.login.split(/[\s/]/)[0].trim();
        const candidates = await prisma.user.findMany({
          where: firstWord.length >= 2 ? { name: { contains: firstWord } } : undefined,
        });
        const matches = candidates.filter((u) => {
          const { cleanName } = parseUserName(u.name);
          // Normalize whitespace for comparison (HTML stripping can leave double spaces)
          const normalizedClean = cleanName.replace(/\s+/g, " ").toLowerCase();
          const normalizedLogin = credentials.login.replace(/\s+/g, " ").toLowerCase();
          return normalizedClean === normalizedLogin;
        });

        if (matches.length === 0) return null;

        let user = matches[0];
        if (matches.length > 1) {
          const activeIds = await prisma.leagueUser.findMany({
            where: { userId: { in: matches.map((m) => m.id) } },
            select: { userId: true },
          });
          const activeSet = new Set(activeIds.map((r) => r.userId));
          const active = matches.filter((m) => activeSet.has(m.id));
          const pool = active.length > 0 ? active : matches;
          user = pool.reduce((best, m) => (m.id > best.id ? m : best), pool[0]);
        }

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
          try {
            const hashed = await bcrypt.hash(inputPwd, 10);
            await prisma.$executeRawUnsafe(
              "UPDATE USER SET PASSWORD = ? WHERE ID_USER = ?",
              hashed, user.id
            );
          } catch {
            // Migration failed (e.g. column too short) — login still valid
          }
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
