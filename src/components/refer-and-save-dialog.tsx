"use client";

import * as React from "react";
import { Gift, Link2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarMenuButton } from "@/components/ui/sidebar";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 1.092.044 1.545.108v3.282a8 8 0 0 0-.87-.044c-1.236 0-1.715.468-1.715 1.684v2.528h3.428l-.591 3.667h-2.837v7.98z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

const SIGNUP_SUBDOMAIN = "startup";

function buildReferralUrl(referralCode: string): string {
  if (typeof window === "undefined") return "";

  const { hostname, port, protocol } = window.location;
  const parts = hostname.split(".");

  if (parts.length >= 3) {
    parts[0] = SIGNUP_SUBDOMAIN;
    const newHostname = parts.join(".");
    return `${protocol}//${newHostname}${port ? ":" + port : ""}?ref=${referralCode}`;
  }

  return `${protocol}//${hostname}${port ? ":" + port : ""}/org-signup?ref=${referralCode}`;
}

export function ReferAndSaveDialog() {
  const [referralCode, setReferralCode] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open || referralCode) return;

    setIsLoading(true);
    fetch("/api/organization/referral-code")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load referral code");
        return res.json();
      })
      .then((data) => {
        if (data.referralCode) {
          setReferralCode(data.referralCode);
        }
      })
      .catch(() => {
        toast.error("Failed to load referral code");
      })
      .finally(() => setIsLoading(false));
  }, [open, referralCode]);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const referralUrl = referralCode ? buildReferralUrl(referralCode) : "";

  const shareMessage =
    "We switched to Uplifter for our club and it's been a game-changer — registration, billing, scheduling, all in one place. Check it out!";

  const emailSubject = "You need to check out Uplifter for your club";
  const emailBody = `Hey!\n\n${shareMessage}\n\n${referralUrl}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareLinks = [
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
      icon: <FacebookIcon className="h-4 w-4" />,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareMessage + "\n\n" + referralUrl)}`,
      icon: <LinkedInIcon className="h-4 w-4" />,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(referralUrl)}`,
      icon: <XIcon className="h-4 w-4" />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <SidebarMenuButton>
          <Gift />
          <span>Refer &amp; Save</span>
        </SidebarMenuButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refer &amp; Save</DialogTitle>
          <DialogDescription>
            Share your unique link and get a free month for each referral.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {shareLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3 text-primary hover:text-primary hover:bg-primary/10"
                  asChild
                >
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.icon}
                    <span className="text-xs font-medium">{link.label}</span>
                  </a>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={referralUrl}
                className="flex-1 text-sm text-muted-foreground"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="shrink-0">
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
