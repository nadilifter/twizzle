import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string; // Keep as string for now, we'll ensure it's set or handle empty
      organizationName: string;
      permissions: string[];
      isSuperAdmin: boolean;
      // Impersonation fields (superadmin "view as coach" feature)
      viewingAsCoachId?: string;
      viewingAsCoachName?: string;
      viewingAsOrganizationId?: string;
      viewingAsOrganizationName?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    organizationId: string;
    organizationName: string;
    permissions: string[];
    isSuperAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    organizationId: string;
    organizationName: string;
    permissions: string[];
    isSuperAdmin: boolean;
    // Impersonation fields (superadmin "view as coach" feature)
    viewingAsCoachId?: string;
    viewingAsCoachName?: string;
    viewingAsOrganizationId?: string;
    viewingAsOrganizationName?: string;
  }
}
