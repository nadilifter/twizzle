"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api-client";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface SidebarSearchEntity {
  id: string;
  name: string;
}

export interface SidebarSearchResults {
  programs: SidebarSearchEntity[];
  events: SidebarSearchEntity[];
  competitions: SidebarSearchEntity[];
  memberships: SidebarSearchEntity[];
  categories: SidebarSearchEntity[];
  seasons: SidebarSearchEntity[];
}

const EMPTY_RESULTS: SidebarSearchResults = {
  programs: [],
  events: [],
  competitions: [],
  memberships: [],
  categories: [],
  seasons: [],
};

export function useSidebarSearch(query: string) {
  const [results, setResults] = useState<SidebarSearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async (search: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const data = await api.get<SidebarSearchResults>("/api/sidebar-search", {
        search,
      });
      if (!controller.signal.aborted) {
        setResults(data);
      }
    } catch {
      if (!controller.signal.aborted) {
        setResults(EMPTY_RESULTS);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(() => {
      fetchResults(query);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchResults]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { results, isLoading };
}
