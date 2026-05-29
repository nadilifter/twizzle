"use client";

import { useEffect, useRef } from "react";

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Don't capture keys when focus is inside an open dialog or sheet
  if (el.closest('[role="dialog"], [role="alertdialog"]')) return true;
  return false;
}

export interface GlobalShortcutOptions {
  onHelpOpen: () => void;
  onNavigate: (url: string) => void;
  isAdmin: boolean;
}

/**
 * Global keyboard shortcut state machine.
 *
 * Wires up:
 *   ?          → open help dialog
 *   g → a/p/c/s → vim-style go-to navigation (role-aware)
 *
 * Guards against firing when an input, textarea, select, contentEditable,
 * or Radix dialog/sheet has focus.
 */
export function useGlobalShortcuts({ onHelpOpen, onNavigate, isAdmin }: GlobalShortcutOptions) {
  const pendingGRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs so the stable event listener always sees the latest values.
  const onHelpOpenRef = useRef(onHelpOpen);
  const onNavigateRef = useRef(onNavigate);
  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    onHelpOpenRef.current = onHelpOpen;
  }, [onHelpOpen]);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditing()) return;

      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const admin = isAdminRef.current;
        if (e.key === "a") {
          e.preventDefault();
          onNavigateRef.current(admin ? "/dashboard/athletes" : "/coach/athletes");
        } else if (e.key === "p") {
          e.preventDefault();
          onNavigateRef.current(admin ? "/dashboard/registrations/programs" : "/coach/programs");
        } else if (e.key === "c") {
          e.preventDefault();
          if (admin) onNavigateRef.current("/dashboard/competitions");
        } else if (e.key === "s") {
          e.preventDefault();
          onNavigateRef.current(admin ? "/dashboard/organization/features" : "/coach");
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        onHelpOpenRef.current();
      } else if (e.key === "g") {
        // "g" is the prefix for go-to sequences. Capture it silently and wait
        // for a second keypress within 1.5 s.
        e.preventDefault();
        pendingGRef.current = true;
        timerRef.current = setTimeout(() => {
          pendingGRef.current = false;
          timerRef.current = null;
        }, 1500);
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
