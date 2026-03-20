import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { ROLE_PERMISSIONS } from "./permissions";
import { getEnvConfig, getCurrentEnvironment, getSubdomainUrl } from "./env-domains";
import { getAuthCookies } from "./auth-cookies";
import { shouldRequireMfa, validateVerificationCode, verifyVerifiedToken } from "./mfa";

/**
 * Creates a signed bridge token for cross-domain session transfer
 * Used when OAuth completes on localhost:3000 but session needs to be on the local subdomain
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

/**
 * Resolve the organization context and permissions for a user.
 * Permissions are now org-scoped via OrgMemberPermission on OrganizationMember.
 */
async function buildAuthorizedUser(userId: string, targetOrgId?: string | null) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true,
          permissions: true,
        },
      },
    },
  });

  if (!user) return null;

  const activeMemberships = user.isSuperAdmin
    ? user.memberships
    : user.memberships.filter((m) => m.organization.isActive);

  let organizationId = targetOrgId || "";
  let organizationName = "";
  let membership: (typeof activeMemberships)[number] | undefined;

  if (targetOrgId) {
    membership = activeMemberships.find((m) => m.organizationId === targetOrgId);
    if (membership) {
      organizationName = membership.organization.name;
    } else if (user.isSuperAdmin) {
      // Superadmins can select any org, fetch its name
      const targetOrg = await db.organization.findUnique({
        where: { id: targetOrgId },
        select: { name: true }
      });
      if (targetOrg) {
        organizationName = targetOrg.name;
      } else {
        organizationId = "";
      }
    } else {
      organizationId = "";
    }
  }

  if (!organizationId && activeMemberships.length >= 1) {
    membership = activeMemberships[0];
    organizationId = membership.organizationId;
    organizationName = membership.organization.name;
  }

  // Resolve permissions from the org membership
  let permissions: string[];
  const role = membership?.role || user.role;

  if (user.isSuperAdmin) {
    permissions = ["*"];
  } else if (membership) {
    const memberPerms = membership.permissions.map((p) => p.permission);
    permissions =
      memberPerms.length > 0
        ? memberPerms
        : ROLE_PERMISSIONS[(membership.role || "").toUpperCase()] ?? [];
  } else {
    permissions = ROLE_PERMISSIONS[(user.role || "").toUpperCase()] ?? [];
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatar,
    role,
    organizationId: organizationId || "",
    organizationName: organizationName || "",
    permissions,
    isSuperAdmin: user.isSuperAdmin,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as NextAuthOptions["adapter"],
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  // Use centralized cookie configuration that includes ALL OAuth-required cookies
  // (sessionToken, callbackUrl, csrfToken, pkceCodeVerifier, state, nonce)
  // This ensures proper cross-subdomain OAuth flows in staging/production
  cookies: getAuthCookies(),
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
            // While convenient, it can be a security risk if an attacker controls an OAuth account
            // with the same email as an existing user.
            // 
            // Mitigations in place:
            // 1. signIn callback verifies user exists in our database
            // 2. Only Uplifter staff domain emails can be auto-created
            // 3. External users must be pre-created by an admin
            //
            // Set ALLOW_OAUTH_ACCOUNT_LINKING=false to disable this behavior
            allowDangerousEmailAccountLinking: 
              process.env.ALLOW_OAUTH_ACCOUNT_LINKING !== "false",
            authorization: {
              params: {
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    // Only add Azure AD provider if credentials are configured
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID,
            allowDangerousEmailAccountLinking:
              process.env.ALLOW_OAUTH_ACCOUNT_LINKING !== "false",
            authorization: {
              params: {
                scope: "openid profile email User.Read",
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
        mfaCode: { label: "MFA Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required");
          }

          const user = await db.user.findUnique({
            where: { email: credentials.email },
            select: { id: true, passwordHash: true, lastActiveAt: true },
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

          // MFA check: if the user is inactive, require a valid MFA code
          if (shouldRequireMfa(user.lastActiveAt)) {
            if (!credentials.mfaCode) {
              return null;
            }

            // Accept either a signed proof token (from magic link) or a DB code
            const proofResult = verifyVerifiedToken(credentials.mfaCode, "MFA_CHALLENGE");
            const isProofValid = proofResult && proofResult.email === credentials.email;

            if (!isProofValid) {
              const mfaValid = await validateVerificationCode(
                credentials.email,
                credentials.mfaCode,
                "MFA_CHALLENGE"
              );
              if (!mfaValid) {
                throw new Error("Invalid or expired verification code");
              }
            }
          }

          // Update last active
          await db.user.update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
          });

          const returnedUser = await buildAuthorizedUser(user.id);
          if (!returnedUser) throw new Error("User not found");
          console.log("Authorize returning user:", returnedUser.email, returnedUser.id);
          return returnedUser;
        } catch (error) {
          console.error("Authorize error:", error);
          throw error; 
        }
      },
    }),
    CredentialsProvider({
      id: "email-code",
      name: "Email Code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.code) {
            throw new Error("Email and code are required");
          }

          const email = credentials.email.toLowerCase().trim();

          // Accept either a signed proof token (from magic link) or a DB code
          const proofResult = verifyVerifiedToken(credentials.code, "EMAIL_LOGIN");
          const isProofValid = proofResult && proofResult.email === email;

          if (!isProofValid) {
            const isValid = await validateVerificationCode(
              email,
              credentials.code,
              "EMAIL_LOGIN"
            );
            if (!isValid) {
              throw new Error("Invalid or expired code");
            }
          }

          const user = await db.user.findUnique({
            where: { email },
            select: { id: true, status: true },
          });

          if (!user || user.status !== "ACTIVE") {
            throw new Error("Account not found or inactive");
          }

          await db.user.update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
          });

          const returnedUser = await buildAuthorizedUser(user.id);
          if (!returnedUser) throw new Error("User not found");
          console.log("Email-code authorize returning user:", returnedUser.email, returnedUser.id);
          return returnedUser;
        } catch (error) {
          console.error("Email-code authorize error:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        const provider = account?.provider;
        const isOAuthProvider = provider === "google" || provider === "azure-ad";

        if (isOAuthProvider) {
          const email = user.email!;
          const isStaffEmail = isUplifterEmail(email);
          
          let existingUser = await db.user.findUnique({
            where: { email },
            include: {
              accounts: true,
            },
          });

          if (!existingUser && isStaffEmail) {
            console.log(`Creating super admin for Uplifter email: ${email} (via ${provider})`);
            const displayName = user.name || "Uplifter User";
            existingUser = await db.user.create({
              data: {
                email,
                name: displayName,
                avatar: user.image,
                role: "ADMIN",
                status: "ACTIVE",
                isSuperAdmin: true,
              },
              include: {
                accounts: true,
              },
            });
          } else if (!existingUser) {
            return "/login?error=NoAccount";
          } else {
            const hasPassword = !!existingUser.passwordHash;
            const hasProviderLink = existingUser.accounts.some(
              (acc) => acc.provider === provider
            );
            
            if (hasPassword && !hasProviderLink && process.env.ALLOW_OAUTH_ACCOUNT_LINKING === "false") {
              console.warn(
                `OAuth linking blocked for ${email}: User has password but no ${provider} link`
              );
              return "/login?error=AccountNotLinked";
            }
            
            if (isStaffEmail && !existingUser.isSuperAdmin) {
              await db.user.update({
                where: { id: existingUser.id },
                data: { isSuperAdmin: true },
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
        // Initial sign in with credentials or email-code provider
        if (user && (account?.provider === "credentials" || account?.provider === "email-code")) {
          console.log(`JWT callback: ${account.provider} sign in for user:`, user.email, user.id);
          token.id = user.id;
          token.role = user.role;
          token.organizationId = user.organizationId;
          token.organizationName = user.organizationName;
          token.permissions = user.permissions;
          token.isSuperAdmin = user.isSuperAdmin;
        }
        
        // OAuth sign-in - fetch user data from database
        if ((account?.provider === "google" || account?.provider === "azure-ad") && user?.email) {
          console.log(`JWT callback: ${account.provider} sign in for user:`, user.email);
          
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          
          if (dbUser) {
            const authUser = await buildAuthorizedUser(dbUser.id);
            if (authUser) {
              token.id = authUser.id;
              token.role = authUser.role;
              token.isSuperAdmin = authUser.isSuperAdmin;
              token.permissions = authUser.permissions;
              token.organizationId = authUser.organizationId;
              token.organizationName = authUser.organizationName;
            }
          }
        }

        // Handle session updates (e.g., switching organizations or impersonation)
        if (trigger === "update" && session) {
          console.log("JWT callback: Session update", session);
          
          // Handle organization switching -- re-resolve permissions for the new org
          if (session.organizationId !== undefined) {
            const authUser = await buildAuthorizedUser(
              token.id as string,
              session.organizationId || null
            );
            if (authUser) {
              token.organizationId = authUser.organizationId;
              token.organizationName = authUser.organizationName;
              token.permissions = authUser.permissions;
              token.role = authUser.role;
            }
          }
          
          // Handle impersonation (superadmin "view as user" feature)
          if (token.isSuperAdmin && session.viewingAsUserId !== undefined) {
            token.viewingAsUserId = session.viewingAsUserId || undefined;
            token.viewingAsUserName = session.viewingAsUserName || undefined;
            token.viewingAsUserEmail = session.viewingAsUserEmail || undefined;
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
          
          session.user.viewingAsUserId = token.viewingAsUserId as string | undefined;
          session.user.viewingAsUserName = token.viewingAsUserName as string | undefined;
          session.user.viewingAsUserEmail = token.viewingAsUserEmail as string | undefined;
        }
        return session;
      } catch (error) {
        console.error("Session error:", error);
        return session;
      }
    },
    async redirect({ url, baseUrl }) {
      const config = getEnvConfig();
      const currentEnv = getCurrentEnvironment();
      const baseDomain = config.baseDomain.split(':')[0]; // Remove port if present
      
      // PRODUCTION/STAGING: Standard redirect behavior
      // Cookies are properly shared across subdomains via domain attribute,
      // so no bridge is needed - NextAuth handles everything correctly
      if (currentEnv !== 'local') {
        // Allows relative callback URLs
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }
        // Allows callback URLs on the same origin
        try {
          if (new URL(url).origin === baseUrl) {
            return url;
          }
        } catch {
          // URL parsing failed, continue to next check
        }
        // Allow callback URLs to the current environment's domain (trusted)
        if (url.includes(baseDomain)) {
          return url;
        }
        return baseUrl;
      }
      
      // LOCAL DEVELOPMENT: Handle cross-domain OAuth redirect
      // When OAuth completes on localhost:3000 but the callbackUrl is for a local subdomain,
      // we need to redirect through the session bridge to set the cookie on the correct domain.
      // This is only needed in local dev because OAuth providers don't allow localhost
      // subdomains as redirect URIs.
      
      const isLocalhost = baseUrl === "http://localhost:3000";
      const callbackIsLocalSubdomain = url.includes(baseDomain);
      const isNotAlreadyBridge = !url.includes("oauth-bridge");
      
      if (isLocalhost && callbackIsLocalSubdomain && isNotAlreadyBridge) {
        // Extract the original callback URL
        let finalCallback = url;
        
        try {
          const urlObj = new URL(url);
          const nestedCallback = urlObj.searchParams.get("callbackUrl");
          if (nestedCallback) {
            finalCallback = nestedCallback;
          }
        } catch {
          // URL parsing failed, use as-is
        }
        
        // Prevent redirect loop: if callback is the login portal, redirect to admin instead
        try {
          const callbackUrlObj = new URL(finalCallback);
          const callbackHost = callbackUrlObj.hostname;
          const callbackPath = callbackUrlObj.pathname;
          if (callbackHost.startsWith("login.") || callbackPath === "/login") {
            finalCallback = getSubdomainUrl("admin") + "/";
            console.log("Redirect callback: Callback was login page, redirecting to admin instead");
          }
        } catch {
          // URL parsing failed, continue with original
        }
        
        console.log("Redirect callback: Detected cross-domain OAuth, redirecting to bridge");
        console.log("Redirect callback: baseUrl=", baseUrl, "url=", url, "finalCallback=", finalCallback);
        
        const bridgeUrl = new URL("/api/auth/oauth-bridge", "http://localhost:3000");
        bridgeUrl.searchParams.set("callbackUrl", finalCallback);
        return bridgeUrl.toString();
      }
      
      // Local dev fallback: standard redirect behavior
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      try {
        if (new URL(url).origin === baseUrl) {
          return url;
        }
      } catch {
        // URL parsing failed
      }
      if (url.includes(baseDomain)) {
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

const UPLIFTER_STAFF_DOMAINS = [
  "@uplifterinc.com",
  "@upliftergymnastics.com",
  "@uplifter.app",
  "@uplifterincca.onmicrosoft.com",
];

// Helper to check if email is an Uplifter staff email (super admin eligible)
export function isUplifterEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return UPLIFTER_STAFF_DOMAINS.some((domain) => lower.endsWith(domain));
}
