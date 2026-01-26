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
        try {
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
          
          // Logic for organization selection:
          // - If user has a saved organizationId, use it
          // - If user has exactly one membership, auto-select it
          // - If user has multiple memberships, leave empty to trigger org selection
          if (!organizationId && user.memberships.length === 1) {
              // Only auto-select if there's exactly one organization
              organizationId = user.memberships[0].organizationId;
              organizationName = user.memberships[0].organization.name;
          } else if (!organizationId && user.memberships.length > 1) {
              // Multiple organizations - leave empty to trigger switch-organization page
              organizationId = "";
              organizationName = "";
          }

          const returnedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
            role: user.role, 
            organizationId: organizationId || "", 
            organizationName: organizationName || "",
            permissions: user.permissions.map((p) => p.permission),
            isSuperAdmin: user.isSuperAdmin,
          };
          console.log("Authorize returning user:", returnedUser.email, returnedUser.id);
          return returnedUser;
        } catch (error) {
          console.error("Authorize error:", error);
          throw error; 
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        // For OAuth providers (like Google)
        if (account?.provider === "google") {
          const email = user.email!;
          const isUplifterEmail = email.endsWith("@uplifterinc.com");
          
          let existingUser = await db.user.findUnique({
            where: { email },
          });

          // Auto-create super admin users for @uplifterinc.com emails
          if (!existingUser && isUplifterEmail) {
            console.log(`Creating super admin for Uplifter email: ${email}`);
            existingUser = await db.user.create({
              data: {
                email,
                name: user.name || email.split("@")[0],
                avatar: user.image,
                role: "ADMIN",
                status: "ACTIVE",
                isSuperAdmin: true,
              },
            });
            
            // Create wildcard permission for super admins
            await db.userPermission.create({
              data: {
                userId: existingUser.id,
                permission: "*",
              },
            });
          } else if (!existingUser) {
            // Non-uplifter emails must have an existing account
            return "/login?error=NoAccount";
          } else if (isUplifterEmail && !existingUser.isSuperAdmin) {
            // Ensure existing uplifter users are marked as super admins
            await db.user.update({
              where: { id: existingUser.id },
              data: { isSuperAdmin: true },
            });
            
            // Ensure they have wildcard permission
            await db.userPermission.upsert({
              where: {
                userId_permission: {
                  userId: existingUser.id,
                  permission: "*",
                },
              },
              create: {
                userId: existingUser.id,
                permission: "*",
              },
              update: {},
            });
          }

          await db.user.update({
            where: { id: existingUser.id },
            data: { lastActiveAt: new Date() },
          });
        }

        return true;
      } catch (error) {
        console.error("SignIn error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      try {
        // Initial sign in with credentials provider
        if (user && account?.provider === "credentials") {
          console.log("JWT callback: Credentials sign in for user:", user.email, user.id);
          token.id = user.id;
          token.role = user.role;
          token.organizationId = user.organizationId;
          token.organizationName = user.organizationName;
          token.permissions = user.permissions;
          token.isSuperAdmin = user.isSuperAdmin;
        }
        
        // OAuth sign-in - fetch user data from database
        if (account?.provider === "google" && user?.email) {
          console.log("JWT callback: Google sign in for user:", user.email);
          
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
            
            // Super admins don't need a specific organization - they can access all
            // But we can default to their saved org if they have one
            let organizationId = dbUser.organizationId;
            let organizationName = dbUser.organization?.name;
            
            if (!organizationId && dbUser.memberships.length === 1) {
              organizationId = dbUser.memberships[0].organizationId;
              organizationName = dbUser.memberships[0].organization.name;
            } else if (!organizationId && dbUser.memberships.length > 1) {
              organizationId = "";
              organizationName = "";
            }
            
            // Super admins can proceed without organization - they'll select one
            token.organizationId = organizationId || "";
            token.organizationName = organizationName || "";
          }
        }

        // Handle session updates (e.g., switching organizations)
        if (trigger === "update" && session) {
          console.log("JWT callback: Session update", session);
          token.organizationId = session.organizationId;
          token.organizationName = session.organizationName;
        }

        // console.log("JWT callback returning token:", JSON.stringify(token, null, 2));
        return token;
      } catch (error) {
        console.error("JWT error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token && session.user) {
          // console.log("Session callback: Token has id:", token.id, "sub:", token.sub);
          session.user.id = (token.id as string) || (token.sub as string);
          session.user.role = token.role as string;
          session.user.organizationId = token.organizationId as string;
          session.user.organizationName = token.organizationName as string;
          session.user.permissions = token.permissions as string[];
          session.user.isSuperAdmin = token.isSuperAdmin as boolean;
        }
        return session;
      } catch (error) {
        console.error("Session error:", error);
        return session;
      }
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
