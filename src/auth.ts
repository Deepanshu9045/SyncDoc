import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            // Auto-registration on first login for user convenience
            user = await prisma.user.create({
              data: {
                email,
                password: hashPassword(password),
                name: email.split("@")[0],
              },
            });
          } else if (!user.password) {
            // Securely set password for placeholder/invited users on first login
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                password: hashPassword(password),
              },
            });
          } else if (!verifyPassword(password, user.password)) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          console.error("Auth authorize error:", error);
          return null;
        }
      },
    }),
  ],
});
