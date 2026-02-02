import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";

/**
 * Creates a signed bridge token for cross-domain session transfer
 * Used when OAuth completes on localhost:3000 but session needs to be on uplifterinc.localhost
 */
function createBridgeToken(email: string, secret: string): string {
  const exp = Date.now() + 60 * 1000; // 60 seconds
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${email}:${exp}`)
    .digest("base64url");

  const tokenData = { email, exp, signature };
  return Buffer.from(JSON.stringify(tokenData)).toString("base64url");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Production: Share cookies across all uplifterinc.com subdomains
        // Development: Don't set a domain - this allows the cookie to be set on
        // localhost:3000 when OAuth completes, then session-bridge transfers the
        // session to uplifterinc.localhost subdomains with the correct domain.
        // Setting domain to ".uplifterinc.localhost" would prevent cookies from
        // being set/read on localhost:3000 (required for Google OAuth).
        domain: process.env.NODE_ENV === "production" 
          ? ".uplifterinc.com" 
          : undefined
      }
    }
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
            // SECURITY NOTE: Email account linking
            // This setting allows linking OAuth accounts to existing accounts with the same email.
            // While convenient, it can be a security risk if an attacker controls a Google account
            // with the same email as an existing user.
            // 
            // Mitigations in place:
            // 1. signIn callback verifies user exists in our database
            // 2. Only @uplifterinc.com emails can be auto-created
            // 3. External users must be pre-created by an admin
            //
            // Set ALLOW_OAUTH_ACCOUNT_LINKING=false to disable this behavior
            allowDangerousEmailAccountLinking: 
              process.env.ALLOW_OAUTH_ACCOUNT_LINKING !== "false",
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
            include: {
              accounts: true, // Include linked OAuth accounts
            },
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
              include: {
                accounts: true,
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
          } else {
            // Security check: If user exists with a password but no OAuth link,
            // and ALLOW_OAUTH_ACCOUNT_LINKING is disabled, reject the login
            const hasPassword = !!existingUser.passwordHash;
            const hasGoogleLink = existingUser.accounts.some(
              (acc) => acc.provider === "google"
            );
            
            if (hasPassword && !hasGoogleLink && process.env.ALLOW_OAUTH_ACCOUNT_LINKING === "false") {
              console.warn(
                `OAuth linking blocked for ${email}: User has password but no Google link`
              );
              return "/login?error=AccountNotLinked";
            }
            
            // For uplifter emails, ensure super admin status
            if (isUplifterEmail && !existingUser.isSuperAdmin) {
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

        // Handle session updates (e.g., switching organizations or impersonation)
        if (trigger === "update" && session) {
          console.log("JWT callback: Session update", session);
          
          // Handle organization switching
          if (session.organizationId !== undefined) {
            token.organizationId = session.organizationId;
            token.organizationName = session.organizationName;
          }
          
          // Handle impersonation (superadmin "view as coach" feature)
          // Only allow if user is a superadmin
          if (token.isSuperAdmin && session.viewingAsCoachId !== undefined) {
            token.viewingAsCoachId = session.viewingAsCoachId || undefined;
            token.viewingAsCoachName = session.viewingAsCoachName || undefined;
            token.viewingAsOrganizationId = session.viewingAsOrganizationId || undefined;
            token.viewingAsOrganizationName = session.viewingAsOrganizationName || undefined;
          }
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
          
          // Include impersonation fields
          session.user.viewingAsCoachId = token.viewingAsCoachId as string | undefined;
          session.user.viewingAsCoachName = token.viewingAsCoachName as string | undefined;
          session.user.viewingAsOrganizationId = token.viewingAsOrganizationId as string | undefined;
          session.user.viewingAsOrganizationName = token.viewingAsOrganizationName as string | undefined;
        }
        return session;
      } catch (error) {
        console.error("Session error:", error);
        return session;
      }
    },
    async redirect({ url, baseUrl }) {
      // Handle cross-domain OAuth redirect
      // When OAuth completes on localhost:3000 but the callbackUrl is for uplifterinc.localhost,
      // we need to redirect through the session bridge to set the cookie on the correct domain
      
      const isLocalhost = baseUrl.includes("localhost:3000") && !baseUrl.includes("uplifterinc.localhost");
      const callbackIsUplifterSubdomain = url.includes("uplifterinc.localhost");
      
      if (isLocalhost && callbackIsUplifterSubdomain) {
        // Extract the original callback URL
        // The URL might be the full callback URL or contain a callbackUrl param
        let finalCallback = url;
        
        try {
          const urlObj = new URL(url);
          // If there's a nested callbackUrl param, use that as the final destination
          const nestedCallback = urlObj.searchParams.get("callbackUrl");
          if (nestedCallback) {
            finalCallback = nestedCallback;
          }
        } catch {
          // URL parsing failed, use as-is
        }
        
        // Prevent redirect loop: if callback is the login portal, redirect to admin instead
        // This can happen if someone directly navigates to the login portal and logs in
        try {
          const callbackUrlObj = new URL(finalCallback);
          const callbackHost = callbackUrlObj.hostname;
          if (callbackHost.startsWith("login.")) {
            // Replace login subdomain with admin subdomain
            const isLocal = callbackHost.includes("localhost");
            finalCallback = isLocal 
              ? "http://admin.uplifterinc.localhost:3000/"
              : "https://admin.uplifterinc.com/";
            console.log("Redirect callback: Callback was login portal, redirecting to admin instead");
          }
        } catch {
          // URL parsing failed, continue with original
        }
        
        console.log("Redirect callback: Detected cross-domain OAuth, redirecting to bridge");
        console.log("Redirect callback: baseUrl=", baseUrl, "url=", url, "finalCallback=", finalCallback);
        
        // Redirect to oauth-bridge which will get the session and transfer it
        const bridgeUrl = new URL("/api/auth/oauth-bridge", "http://localhost:3000");
        bridgeUrl.searchParams.set("callbackUrl", finalCallback);
        return bridgeUrl.toString();
      }
      
      // Default redirect behavior
      // Allows relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Allow callback URLs to uplifterinc.localhost subdomains (trusted)
      else if (url.includes("uplifterinc.localhost") || url.includes("uplifterinc.com")) {
        return url;
      }
      return baseUrl;
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
