"use client";

import { useState, useEffect } from "react";
import { Cookie, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookie-consent-acknowledged";

/**
 * Cookie Notice Banner for Essential Cookies Only
 * 
 * This banner informs users that only essential cookies are used for:
 * - Session management and authentication
 * - Security (CSRF protection)
 * 
 * No marketing, analytics, or tracking cookies are used.
 * 
 * Best practices implemented:
 * - Clear, transparent messaging about essential-only cookies
 * - Links to privacy policy and terms of service
 * - Accessible design with proper ARIA attributes
 * - Smooth animation on appearance
 * - Persistent acknowledgment stored in localStorage
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already acknowledged the notice
    const acknowledged = localStorage.getItem(STORAGE_KEY);
    if (!acknowledged) {
      // Small delay to avoid layout shift on initial load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcknowledge = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto z-50 md:max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500"
      role="region"
      aria-label="Cookie notice"
    >
      <div className="rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                We only use essential cookies
              </p>
              <p className="text-sm text-muted-foreground">
                This site uses strictly necessary cookies for authentication and security. 
                We do not use any marketing, analytics, or tracking cookies.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                size="sm"
                onClick={handleAcknowledge}
                className="gap-2"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Got it
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <a 
                  href="https://www.uplifterinc.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline transition-colors"
                >
                  Privacy Policy
                </a>
                <span aria-hidden="true">•</span>
                <a 
                  href="https://www.uplifterinc.com/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline transition-colors"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
