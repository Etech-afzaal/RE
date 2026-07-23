import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export const authOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        if (!email || !credentials?.password) return null;

        const requestedRole = String(credentials?.role || "").toLowerCase();

        // Hardcoded single admin account via env vars. If you need multiple
        // admins later, move this into its own `admins` table.
        if (requestedRole === "admin") {
          const adminEmail = String(process.env.ADMIN_EMAIL || "")
            .trim()
            .toLowerCase();

          if (
            adminEmail &&
            email === adminEmail &&
            credentials.password === process.env.ADMIN_PASSWORD
          ) {
            return { id: "admin", name: "Admin", role: "admin" };
          }
          return null;
        }

        if (requestedRole === "agent") {
          const rows = await query("SELECT * FROM agents WHERE email = ?", [
            email,
          ]);
          const agent = rows[0];
          if (!agent) return null;

          if (agent.status !== "active") {
            throw new Error("ACCOUNT_REVOKED");
          }

          const valid = await bcrypt.compare(
            credentials.password,
            agent.password_hash,
          );
          if (!valid) return null;

          return {
            id: String(agent.id),
            name: agent.full_name,
            email: agent.email,
            role: "agent",
            estate_name: agent.estate_name,
            mustResetPassword: !!agent.must_reset_password,
            isActive: agent.status === "active",
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.estate_name = user.estate_name;
        token.mustResetPassword = user.mustResetPassword;
        token.isActive = user.isActive;
        token.sub = user.id;
      }

      if (token.role === "agent" && token.sub) {
        const rows = await query("SELECT status FROM agents WHERE id = ?", [
          token.sub,
        ]);
        token.isActive = rows[0]?.status === "active";
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.role = token.role;
      session.user.estate_name = token.estate_name;
      session.user.mustResetPassword = token.mustResetPassword;
      session.user.isActive = token.isActive;
      return session;
    },
  },
};
