"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest('[role="dialog"], [role="alertdialog"]')) return true;
  return false;
}

export interface ListShortcutItem {
  id: string;
  /** URL to navigate to when the user presses Enter on this row. */
  detailUrl?: string;
  /** Called when the user presses e on this row. */
  onEdit?: () => void;
  /** Called when the user presses d on this row. */
  onDelete?: () => void;
}

/**
 * j/k/Enter/e/d list-page shortcuts.
 *
 * Returns the currently highlighted index so callers can apply a visual
 * ring/border to that row. Starts at -1 (no visible highlight) until the
 * user actually presses j or k — the ring is a keyboard-navigation
 * affordance and shouldn't decorate the first item by default.
 *
 * Guards: same as useGlobalShortcuts — skips when an input, dialog, or
 * contentEditable has focus.
 */
export function useListKeyboardShortcuts(items: ListShortcutItem[]) {
  const router = useRouter();
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs so the stable event listener always sees the latest values.
  const indexRef = useRef(highlightedIndex);
  const itemsRef = useRef(items);
  const routerRef = useRef(router);
  useEffect(() => {
    indexRef.current = highlightedIndex;
  }, [highlightedIndex]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Keep highlightedIndex in-bounds when the list length changes (e.g. after
  // filtering). Don't promote -1 to 0 — the keyboard handlers (j/k) do that
  // on first press; until then the user sees no highlight.
  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (items.length === 0) return -1;
      if (prev === -1) return -1;
      return Math.min(prev, items.length - 1);
    });
  }, [items.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditing()) return;

      const list = itemsRef.current;
      if (list.length === 0) return;
      const idx = indexRef.current;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i < 0 ? 0 : i + 1, list.length - 1));
          break;
        case "k":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i < 0 ? 0 : i - 1, 0));
          break;
        case "Enter": {
          if (idx < 0) break;
          const url = list[idx]?.detailUrl;
          if (url) {
            e.preventDefault();
            routerRef.current.push(url);
          }
          break;
        }
        case "e": {
          if (idx < 0) break;
          const edit = list[idx]?.onEdit;
          if (edit) {
            e.preventDefault();
            edit();
          }
          break;
        }
        case "d": {
          if (idx < 0) break;
          const del = list[idx]?.onDelete;
          if (del) {
            e.preventDefault();
            del();
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { highlightedIndex, setHighlightedIndex };
}
