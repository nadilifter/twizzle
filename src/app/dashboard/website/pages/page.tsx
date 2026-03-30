"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Eye,
  ExternalLink,
  CalendarDays,
  ClipboardList,
  Mail,
  MapPin,
  Users,
  Trophy,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useFeatures } from "@/components/feature-context";
import type { FeatureKey } from "@/lib/feature-toggles";

interface PageToggle {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultValue: boolean;
  manageLink?: { href: string; label: string };
  featureGated?: FeatureKey;
}

export default function PageVisibilityPage() {
  const { isFeatureEnabled } = useFeatures();
  const competitionsEnabled = isFeatureEnabled("competitions");
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/organization/website")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("Website config error:", data.error);
          setConfig({});
          setLoading(false);
          return;
        }
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load website configuration");
        setLoading(false);
      });
  }, []);

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showRegistration: config.showRegistration,
          showCalendar: config.showCalendar,
          showContact: config.showContact,
          showLocations: config.showLocations,
          showTeam: config.showTeam,
          showCompetitions: config.showCompetitions,
          showStore: config.showStore,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setConfig(data);
      toast.success("Page visibility settings saved");
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const pages: PageToggle[] = [
    {
      key: "showRegistration",
      label: "Programs",
      description:
        "Allow visitors to browse and register for your programs online. This page displays all active programs with pricing, schedules, and registration forms.",
      icon: <ClipboardList className="h-5 w-5" />,
      defaultValue: true,
      manageLink: { href: "/dashboard/registrations/programs", label: "Manage Programs" },
    },
    {
      key: "showCalendar",
      label: "Calendar",
      description:
        "Display your class and event schedule in an interactive calendar view. Visitors can see upcoming sessions, special events, and class times.",
      icon: <CalendarDays className="h-5 w-5" />,
      defaultValue: true,
      manageLink: { href: "/dashboard/registrations/programs", label: "Manage Programs" },
    },
    {
      key: "showContact",
      label: "Contact",
      description:
        "Show a contact page with your organization's information and a contact form so visitors can reach out with questions or inquiries.",
      icon: <Mail className="h-5 w-5" />,
      defaultValue: true,
      manageLink: { href: "/dashboard/organization/overview", label: "Organization Overview" },
    },
    {
      key: "showLocations",
      label: "Facilities",
      description:
        "Display your facilities with interactive maps, addresses, operating hours, and directions to help visitors find you.",
      icon: <MapPin className="h-5 w-5" />,
      defaultValue: false,
      manageLink: { href: "/dashboard/organization/facilities", label: "Manage Facilities" },
    },
    {
      key: "showTeam",
      label: "Team",
      description:
        "Showcase your coaching staff and team members with photos, bios, and credentials on your public website.",
      icon: <Users className="h-5 w-5" />,
      defaultValue: false,
      manageLink: { href: "/dashboard/website/team", label: "Manage Team" },
    },
    {
      key: "showCompetitions",
      label: "Competitions",
      description:
        "Display upcoming competitions and events with registration links. Visitors can browse events and sign up directly.",
      icon: <Trophy className="h-5 w-5" />,
      defaultValue: false,
      manageLink: { href: "/dashboard/competitions", label: "Manage Competitions" },
      featureGated: "competitions",
    },
    {
      key: "showStore",
      label: "Store",
      description:
        "Display your product store for merchandise, gear, and other items available for online purchase.",
      icon: <ShoppingBag className="h-5 w-5" />,
      defaultValue: false,
      manageLink: { href: "/dashboard/store/products", label: "Manage Products" },
      featureGated: "store",
    },
  ];

  const visiblePages = pages.filter((p) => !p.featureGated || isFeatureEnabled(p.featureGated));

  const enabledCount = visiblePages.filter((p) => {
    const val = config[p.key];
    return val === true || (val !== false && p.defaultValue);
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Page Visibility</h1>
          <p className="text-muted-foreground">
            Control which pages are visible on your public website. {enabledCount} of{" "}
            {visiblePages.length} pages enabled.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visiblePages.map((page) => {
          const isEnabled =
            config[page.key] === true || (config[page.key] !== false && page.defaultValue);

          return (
            <Card
              key={page.key}
              className={`relative transition-colors ${
                isEnabled ? "border-primary/30 bg-primary/[0.02]" : "opacity-60"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {page.icon}
                    </div>
                    <div className="flex flex-col -space-y-0.5">
                      <CardTitle className="text-base">{page.label}</CardTitle>
                      {page.manageLink && (
                        <Link
                          href={page.manageLink.href}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {page.manageLink.label}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <Switch checked={isEnabled} onCheckedChange={(c) => updateConfig(page.key, c)} />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {page.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
