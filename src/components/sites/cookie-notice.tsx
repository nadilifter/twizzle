"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie-notice-dismissed";

/**
 * Simple, non-blocking cookie notice banner
 * 
 * Informs users about the anonymous analytics cookie.
 * Dismissible with preference stored in localStorage.
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the notice
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay to avoid layout shift on initial load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-300"
      role="banner"
      aria-label="Cookie notice"
    >
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <p className="text-sm text-muted-foreground">
            This site uses a cookie to count unique visitors. No personal data is collected.
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDismiss}
            aria-label="Dismiss cookie notice"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
