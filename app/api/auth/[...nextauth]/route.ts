import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth handler for both GET and POST requests
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
