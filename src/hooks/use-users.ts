"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
}

interface UseUsersOptions {
  role?: string;
  autoFetch?: boolean;
}

export function useUsers(options: UseUsersOptions = {}) {
  const { role, autoFetch = true } = options;
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<User[]>("/api/users");
      if (role) {
        setUsers(data.filter((u) => u.role.toLowerCase() === role.toLowerCase()));
      } else {
        setUsers(data);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch users";
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (autoFetch) {
      fetchUsers();
    }
  }, [autoFetch, fetchUsers]);

  return { users, isLoading, error, fetchUsers };
}
