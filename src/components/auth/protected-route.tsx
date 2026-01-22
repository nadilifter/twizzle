"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasPermission, hasAnyPermission, Permission } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Loading state
  if (status === "loading") {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )
    );
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  // Check permissions if specified
  const userPermissions = session.user.permissions || [];

  if (permission && !hasPermission(userPermissions, permission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  if (permissions) {
    const hasAccess = requireAll
      ? permissions.every((p) => hasPermission(userPermissions, p))
      : hasAnyPermission(userPermissions, permissions);

    if (!hasAccess) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

// Hook for checking permissions in components
export function usePermissions() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions || [];

  return {
    permissions,
    hasPermission: (permission: Permission) => hasPermission(permissions, permission),
    hasAnyPermission: (perms: Permission[]) => hasAnyPermission(permissions, perms),
    isAdmin: permissions.includes("*"),
    role: session?.user?.role,
  };
}
