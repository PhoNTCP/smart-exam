import { compare } from "bcryptjs";
import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

type AppUser = {
  id: string;
  name: string | null;
  email: string;
  role: "student" | "teacher";
};

// Central NextAuth options for credentials-based login
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Reject when credentials missing
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Resolve user record by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user?.passwordHash) {
          return null;
        }

        // Validate password hash
        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Return limited user payload for the JWT
        const appUser: AppUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };

        return appUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist role in JWT token
      if (user) {
        token.role = (user as AppUser).role ?? "student";
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role to client session
      if (session.user) {
        session.user.role = (token.role as "student" | "teacher" | undefined) ?? "student";
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
};

// Helper to fetch the server session
export const auth = () => getServerSession(authOptions);
