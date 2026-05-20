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

// Module-level stale-while-revalidate cache for the users list.
// Cache the raw unfiltered list so role filters can apply locally.
const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_KEY = "users";
type ListCacheEntry = { data: User[]; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();

function applyRoleFilter(list: User[], role?: string): User[] {
  if (!role) return list;
  return list.filter((u) => u.role.toLowerCase() === role.toLowerCase());
}

export function useUsers(options: UseUsersOptions = {}) {
  const { role, autoFetch = true } = options;

  const initialCached = listCache.get(LIST_CACHE_KEY);

  const [users, setUsers] = useState<User[]>(() =>
    initialCached ? applyRoleFilter(initialCached.data, role) : []
  );
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const cached = listCache.get(LIST_CACHE_KEY);
    if (!cached) setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<User[]>("/api/users");
      listCache.set(LIST_CACHE_KEY, { data, fetchedAt: Date.now() });
      setUsers(applyRoleFilter(data, role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch users";
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!autoFetch) return;
    const cached = listCache.get(LIST_CACHE_KEY);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setUsers(applyRoleFilter(cached.data, role));
      return;
    }
    fetchUsers();
  }, [autoFetch, fetchUsers, role]);

  return { users, isLoading, error, fetchUsers };
}
