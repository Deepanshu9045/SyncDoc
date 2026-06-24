import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Apply middleware to all routes except public files and internal next/api routes
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|register|$).*)",
  ],
};
