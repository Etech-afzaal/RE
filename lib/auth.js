import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { isAgentBlocked, isAgentDisabled, isAgentLive } from "@/lib/status";
import {
  isAgentRole,
  normalizeRole,
  resolveLoginHint,
  ROLES,
} from "@/lib/roles";

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
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        if (!email || !credentials?.password) return null;

        const loginHint = resolveLoginHint(credentials?.role);

        // Hardcoded single SUPER_ADMIN via env vars (unchanged login UX).
        if (loginHint === "admin") {
          const adminEmail = String(process.env.ADMIN_EMAIL || "")
            .trim()
            .toLowerCase();

          if (
            adminEmail &&
            email === adminEmail &&
            credentials.password === process.env.ADMIN_PASSWORD
          ) {
            return {
              id: "admin",
              name: "Admin",
              email: adminEmail,
              role: ROLES.SUPER_ADMIN,
            };
          }
          return null;
        }

        if (loginHint === "agent") {
          const rows = await query(
            `SELECT id, estate_name, username, full_name, email, status,
                    password_hash, must_reset_password
             FROM agents WHERE email = ?`,
            [email],
          );
          const agent = rows[0];
          if (!agent) return null;

          // Only approved agents may sign in. Distinguish disable vs block so
          // the login page can show the right message (and block reason).
          if (!isAgentLive(agent.status)) {
            if (isAgentBlocked(agent.status)) {
              throw new Error("ACCOUNT_BLOCKED");
            }
            if (isAgentDisabled(agent.status)) {
              throw new Error("ACCOUNT_DISABLED");
            }
            throw new Error("ACCOUNT_REVOKED");
          }

          const valid = await bcrypt.compare(
            credentials.password,
            agent.password_hash,
          );
          if (!valid) return null;

          const username = agent.username || agent.estate_name;

          return {
            id: String(agent.id),
            name: agent.full_name,
            email: agent.email,
            role: ROLES.AGENT,
            username,
            agent_id: Number(agent.id),
            status: agent.status,
            estate_name: agent.estate_name,
            mustResetPassword: !!agent.must_reset_password,
            isActive: true,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = normalizeRole(user.role) || user.role;
        token.email = user.email;
        token.username = user.username || null;
        token.agent_id = user.agent_id ?? null;
        token.status = user.status || null;
        token.estate_name = user.estate_name || null;
        token.mustResetPassword = user.mustResetPassword;
        token.isActive = user.isActive;
        token.sub = user.id;
      }

      // Normalize legacy JWT roles from sessions created before Phase 2.
      token.role = normalizeRole(token.role) || token.role;

      if (isAgentRole(token.role) && token.sub) {
        const rows = await query(
          `SELECT id, status, username, estate_name, must_reset_password
           FROM agents WHERE id = ?`,
          [token.sub],
        );
        const agent = rows[0];
        if (!agent) {
          token.isActive = false;
          token.status = "disabled";
        } else {
          token.agent_id = Number(agent.id);
          token.status = agent.status;
          token.username = agent.username || agent.estate_name;
          token.estate_name = agent.estate_name;
          token.mustResetPassword = !!agent.must_reset_password;
          token.isActive = isAgentLive(agent.status);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Never put password hashes or secrets on the session.
      session.user.id = token.sub;
      session.user.email = token.email || session.user.email;
      session.user.role = normalizeRole(token.role) || token.role;

      if (isAgentRole(token.role)) {
        session.user.username = token.username || token.estate_name || null;
        session.user.agent_id = token.agent_id ?? (Number(token.sub) || null);
        session.user.status = token.status || null;
        // Kept for existing agent pages that read estate_name / mustResetPassword.
        session.user.estate_name = token.estate_name || null;
        session.user.mustResetPassword = token.mustResetPassword;
        session.user.isActive = token.isActive;
      } else {
        session.user.username = undefined;
        session.user.agent_id = undefined;
        session.user.status = undefined;
      }

      return session;
    },
  },
};
