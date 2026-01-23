import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  providers: [
    // Only add Google provider if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: "consent",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            organization: true,
            permissions: true,
            memberships: {
              include: {
                organization: true
              }
            }
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          throw new Error("Invalid email or password");
        }

        // Update last active
        await db.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        // Determine organization to use
        let organizationId = user.organizationId;
        let organizationName = user.organization?.name;
        
        // Logic for organization selection
        // If user has memberships but current organizationId is invalid or user needs to choose
        // We will default to the first one IF there's only one.
        // If there are multiple, we might want to force selection, but for now let's keep the legacy behavior 
        // if organizationId is set.
        
        // If user has no current organizationId, try to set one from memberships
        if (!organizationId && user.memberships.length > 0) {
            organizationId = user.memberships[0].organizationId;
            organizationName = user.memberships[0].organization.name;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role, // This should probably be the role in the organization, but for now keep platform role
          organizationId: organizationId || "", // Handle null
          organizationName: organizationName || "",
          permissions: user.permissions.map((p) => p.permission),
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers (like Google), only allow existing users
      if (account?.provider === "google") {
        const existingUser = await db.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          // User doesn't exist - reject sign-in
          return "/login?error=NoAccount";
        }

        // Update last active for OAuth users
        await db.user.update({
          where: { id: existingUser.id },
          data: { lastActiveAt: new Date() },
        });
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // For OAuth sign-in, fetch full user data from database
      if (account?.provider === "google" && user?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          include: {
            organization: true,
            permissions: true,
            memberships: {
                include: {
                    organization: true
                }
            }
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.isSuperAdmin = dbUser.isSuperAdmin;
          token.permissions = dbUser.permissions.map((p) => p.permission);
          
          // Org Logic
          if (dbUser.organizationId) {
             token.organizationId = dbUser.organizationId;
             token.organizationName = dbUser.organization?.name || "";
          } else if (dbUser.memberships.length > 0) {
             // If only 1, default to it. If > 1, leaving empty might trigger selection
             if (dbUser.memberships.length === 1) {
                 token.organizationId = dbUser.memberships[0].organizationId;
                 token.organizationName = dbUser.memberships[0].organization.name;
             } else {
                 // Multiple memberships and no default -> Force selection
                 token.organizationId = "";
                 token.organizationName = "";
             }
          }
        }
      } else if (user) {
        // For credentials sign-in, user object already has all data
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.permissions = user.permissions;
        token.isSuperAdmin = user.isSuperAdmin;
      }

      // Handle session updates (e.g., switching organizations)
      if (trigger === "update" && session) {
        token.organizationId = session.organizationId;
        token.organizationName = session.organizationName;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationName = token.organizationName as string;
        session.user.permissions = token.permissions as string[];
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      }
      return session;
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions);

// Helper to check if user has a specific permission
export function hasPermission(
  permissions: string[] | undefined,
  requiredPermission: string
): boolean {
  if (!permissions) return false;
  return permissions.includes(requiredPermission) || permissions.includes("*");
}

// Helper to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Helper to verify passwords
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
