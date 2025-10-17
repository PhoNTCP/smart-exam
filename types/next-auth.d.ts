import { DefaultSession } from "next-auth";

declare module "next-auth" {
  // Extend default user shape with role and id
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "student" | "teacher";
    };
  }

  interface User {
    role?: "student" | "teacher";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "student" | "teacher";
  }
}
