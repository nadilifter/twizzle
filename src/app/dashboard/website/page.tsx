"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import { Loader2, AlertCircle, Check, Globe, Palette, Image, Eye, LayoutGrid, ExternalLink } from "lucide-react";
import Link from "next/link";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { getBaseDomainSuffix, getBaseDomainFromHostname } from "@/lib/client-domains";
import { useFeatures } from "@/components/feature-context";

export default function WebsitePage() {
  const { isFeatureEnabled } = useFeatures();
  const customDomainsEnabled = isFeatureEnabled("customDomains");
  const competitionsEnabled = isFeatureEnabled("competitions");
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [domainType, setDomainType] = useState<"subdomain" | "custom">("subdomain");
  // Track the subdomain that's currently saved/owned by this org
  const [ownedSubdomain, setOwnedSubdomain] = useState<string | null>(null);

  // Fetch config on mount
  useEffect(() => {
    fetch("/api/organization/website")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("Website config error:", data.error);
          setConfig({ error: data.error });
          setLoading(false);
          return;
        }
        setConfig(data);
        if (data.domain) {
            setDomainType("custom");
        }
        // If the subdomain is owned by this org, track it and mark as available
        if (data.subdomain && data.subdomainOwned) {
            setOwnedSubdomain(data.subdomain);
            setSubdomainStatus('available');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load website configuration");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (subdomainStatus === 'taken' || subdomainStatus === 'invalid' || subdomainStatus === 'error') {
        toast.error("Please fix subdomain issues before saving");
        return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/organization/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setConfig(data);
      // After save, the current subdomain is now owned by this org
      if (data.subdomain) {
        setOwnedSubdomain(data.subdomain);
      }
      toast.success("Website configuration saved");
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  // Debounced subdomain check
  useEffect(() => {
    const checkSubdomain = async () => {
        if (!config.subdomain) {
            setSubdomainStatus('idle');
            return;
        }
        // Skip check if the current subdomain matches the one we already own
        if (ownedSubdomain && config.subdomain === ownedSubdomain) {
            setSubdomainStatus('available');
            return;
        }
        setCheckingSubdomain(true);
        try {
            const res = await fetch(`/api/organization/website/check-subdomain?subdomain=${config.subdomain}`);
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error("API Error checking subdomain:", errorData.error || res.statusText);
                setSubdomainStatus('error');
                return;
            }
            const data = await res.json();
            if (data.available) {
                setSubdomainStatus('available');
                // If the API confirms we own this subdomain, update our tracked value
                if (data.owned) {
                    setOwnedSubdomain(config.subdomain);
                }
            } else {
                setSubdomainStatus(data.reason === 'Invalid format' ? 'invalid' : 'taken');
            }
        } catch (error) {
            console.error(error);
            setSubdomainStatus('error');
        } finally {
            setCheckingSubdomain(false);
        }
    };

    const timer = setTimeout(checkSubdomain, 500);
    return () => clearTimeout(timer);
  }, [config.subdomain, ownedSubdomain]);

  const handlePublishToggle = async () => {
    const newStatus = !config.isPublished;
    
    // Validate before publishing
    if (newStatus) {
        if (!config.subdomain) {
            toast.error("Please set a subdomain before going live");
            return;
        }
        if (subdomainStatus === 'taken' || subdomainStatus === 'invalid' || subdomainStatus === 'error') {
            toast.error("Please fix subdomain issues before going live");
            return;
        }
    }

    updateConfig("isPublished", newStatus); // Optimistic update
    
    setSaving(true);
    try {
      const res = await fetch("/api/organization/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, isPublished: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      setConfig(data);
      // After save, the current subdomain is now owned by this org
      if (data.subdomain) {
        setOwnedSubdomain(data.subdomain);
      }
      toast.success(newStatus ? "Site is now live!" : "Site unpublished");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update site status");
      updateConfig("isPublished", !newStatus); // Revert
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading configuration...</div>;

  // If config has an error (like no organization), show helpful message
  if (config.error) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Website Builder</CardTitle>
            <CardDescription>
              {config.error === "No organization selected" 
                ? "Please select an organization first to configure your website."
                : config.error}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Website Builder</h1>
          <p className="text-muted-foreground">
            Customize your organization&apos;s public website.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button 
            variant={config.isPublished ? "outline" : "default"}
            onClick={handlePublishToggle}
            disabled={saving || !config.subdomain}
          >
            {config.isPublished ? "Unpublish" : "Go Live"}
          </Button>
        </div>
      </div>

      {/* Domain Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Domain Settings</CardTitle>
          </div>
          <CardDescription>Configure your website address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={domainType} onValueChange={(val: "subdomain" | "custom") => setDomainType(val)}>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="subdomain" id="subdomain" className="mt-1" />
              <div className="grid gap-2 flex-1">
                <Label htmlFor="subdomain">Use Uplifter Subdomain<span className="text-destructive ml-1">*</span></Label>
                <p className="text-sm text-muted-foreground">Get a free subdomain (e.g., mygym{getBaseDomainSuffix()}).</p>
                
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[250px]">
                      <Input 
                        value={config.subdomain || ""} 
                        onChange={(e) => updateConfig("subdomain", e.target.value.replace(/\s/g, "-"))}
                        placeholder="my-gym" 
                        className={subdomainStatus === 'taken' || subdomainStatus === 'invalid' || subdomainStatus === 'error' ? 'border-red-500 pr-8' : 'pr-8'}
                        disabled={domainType === 'custom'}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {checkingSubdomain ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : subdomainStatus === 'available' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : subdomainStatus === 'taken' || subdomainStatus === 'invalid' || subdomainStatus === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : null}
                      </div>
                    </div>
                    <span className="text-muted-foreground">{getBaseDomainSuffix()}</span>
                  </div>
                  {subdomainStatus === 'taken' && (
                    <p className="text-xs text-red-500 mt-1">This subdomain is already taken.</p>
                  )}
                  {subdomainStatus === 'invalid' && (
                    <p className="text-xs text-red-500 mt-1">Only lowercase letters, numbers, and hyphens allowed.</p>
                  )}
                  {subdomainStatus === 'error' && (
                    <p className="text-xs text-red-500 mt-1">Error checking subdomain availability.</p>
                  )}
                </div>
              </div>
            </div>
            
            {customDomainsEnabled && (
            <div className="flex items-start space-x-2 mt-4">
              <RadioGroupItem value="custom" id="custom" className="mt-1" />
              <div className="grid gap-2 flex-1">
                <Label htmlFor="custom">Use Custom Domain</Label>
                <p className="text-sm text-muted-foreground">Use your own domain name (e.g., www.mygym.com).</p>
                
                {domainType === "custom" && (
                  <div className="mt-2 space-y-4 border rounded-md p-4 bg-muted/50">
                    <div className="grid gap-2">
                      <Label>Your Domain Name</Label>
                      <Input 
                        value={config.domain || ""} 
                        onChange={(e) => updateConfig("domain", e.target.value)}
                        placeholder="www.mygym.com" 
                      />
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">DNS Configuration Instructions:</p>
                      <ol className="list-decimal pl-4 space-y-2 text-muted-foreground">
                        <li>Log in to your domain registrar (GoDaddy, Namecheap, etc.).</li>
                        <li>Navigate to DNS Management for your domain.</li>
                        <li>Create a new CNAME record:
                          <ul className="list-disc pl-4 mt-1">
                            <li><strong>Type:</strong> CNAME</li>
                            <li><strong>Name:</strong> www (or your chosen subdomain)</li>
                            <li><strong>Value/Target:</strong> domains.uplifterinc.com</li>
                          </ul>
                        </li>
                        <li>If using the root domain (e.g., mygym.com), check if your registrar supports CNAME flattening or ALIAS records. If not, use &apos;www&apos; as the primary address.</li>
                      </ol>
                      <p className="text-xs text-muted-foreground mt-2">Note: DNS changes can take up to 48 hours to propagate.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Branding</CardTitle>
          </div>
          <CardDescription>Set your brand colors and assets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorPicker 
              label="Primary Color" 
              value={config.primaryColor || "#000000"} 
              onChange={(val) => updateConfig("primaryColor", val)}
            />
            <ColorPicker 
              label="Secondary Color" 
              value={config.secondaryColor || "#ffffff"} 
              onChange={(val) => updateConfig("secondaryColor", val)} 
            />
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUpload 
              label="Logo" 
              type="logo" 
              value={config.logo} 
              onChange={(url) => updateConfig("logo", url)} 
            />
            <ImageUpload 
              label="Favicon" 
              type="favicon" 
              value={config.favicon} 
              onChange={(url) => updateConfig("favicon", url)} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            <CardTitle>Hero Section</CardTitle>
          </div>
          <CardDescription>Customize the main banner on your home page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload 
            label="Hero Background Image" 
            type="hero" 
            value={config.heroImage} 
            onChange={(url) => updateConfig("heroImage", url)} 
          />
          
          <Separator />
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input 
                value={config.heroHeadline || ""} 
                onChange={(e) => updateConfig("heroHeadline", e.target.value)}
                placeholder="Welcome to our gym!" 
              />
            </div>
            <div className="space-y-2">
              <Label>Subheadline</Label>
              <Input 
                value={config.heroSubheadline || ""} 
                onChange={(e) => updateConfig("heroSubheadline", e.target.value)}
                placeholder="Where champions are made." 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Introduction Text</Label>
            <RichTextEditor 
              value={config.heroText || ""} 
              onChange={(val) => updateConfig("heroText", val)} 
            />
          </div>
          
          <Separator />
          
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Age Range</Label>
              <Input 
                value={config.heroAgeRange || ""} 
                onChange={(e) => updateConfig("heroAgeRange", e.target.value)}
                placeholder="All Ages Welcome" 
              />
              <p className="text-xs text-muted-foreground">Leave empty to hide this badge</p>
            </div>
            <div className="space-y-2">
              <Label>Program Periods</Label>
              <Input 
                value={config.heroProgramPeriods || ""} 
                onChange={(e) => updateConfig("heroProgramPeriods", e.target.value)}
                placeholder="Year-Round Programs" 
              />
              <p className="text-xs text-muted-foreground">Leave empty to hide this badge</p>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input 
                value={config.heroLocation || ""} 
                onChange={(e) => updateConfig("heroLocation", e.target.value)}
                placeholder="Austin, TX" 
              />
              <p className="text-xs text-muted-foreground">Leave empty to hide this badge</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information Boxes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <CardTitle>Information Boxes</CardTitle>
          </div>
          <CardDescription>Add up to 3 information boxes to display on your home page. Leave empty to hide.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Info Box 1 */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Box 1 Title</Label>
              <Input 
                value={config.infoBox1Title || ""} 
                onChange={(e) => updateConfig("infoBox1Title", e.target.value)}
                placeholder="Membership Includes" 
              />
            </div>
            <div className="space-y-2">
              <Label>Box 1 Content</Label>
              <RichTextEditor 
                value={config.infoBox1Content || ""} 
                onChange={(val) => updateConfig("infoBox1Content", val)} 
              />
              <p className="text-xs text-muted-foreground">Leave both title and content empty to hide this box</p>
            </div>
          </div>
          
          <Separator />
          
          {/* Info Box 2 */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Box 2 Title</Label>
              <Input 
                value={config.infoBox2Title || ""} 
                onChange={(e) => updateConfig("infoBox2Title", e.target.value)}
                placeholder="Financial Assistance" 
              />
            </div>
            <div className="space-y-2">
              <Label>Box 2 Content</Label>
              <RichTextEditor 
                value={config.infoBox2Content || ""} 
                onChange={(val) => updateConfig("infoBox2Content", val)} 
              />
              <p className="text-xs text-muted-foreground">Leave both title and content empty to hide this box</p>
            </div>
          </div>
          
          <Separator />
          
          {/* Info Box 3 */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Box 3 Title</Label>
              <Input 
                value={config.infoBox3Title || ""} 
                onChange={(e) => updateConfig("infoBox3Title", e.target.value)}
                placeholder="Get Involved" 
              />
            </div>
            <div className="space-y-2">
              <Label>Box 3 Content</Label>
              <RichTextEditor 
                value={config.infoBox3Content || ""} 
                onChange={(val) => updateConfig("infoBox3Content", val)} 
              />
              <p className="text-xs text-muted-foreground">Leave both title and content empty to hide this box</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Visibility */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle>Page Visibility</CardTitle>
          </div>
          <CardDescription>Choose which pages are visible to the public.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Show Programs</Label>
                <Link
                  href="/dashboard/registrations/programs"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Manage Programs <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">Allow users to register for programs online.</p>
            </div>
            <Switch 
              checked={config.showRegistration !== false} 
              onCheckedChange={(c) => updateConfig("showRegistration", c)} 
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Calendar</Label>
              <p className="text-sm text-muted-foreground">Display your class schedule.</p>
            </div>
            <Switch 
              checked={config.showCalendar !== false} 
              onCheckedChange={(c) => updateConfig("showCalendar", c)} 
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Contact</Label>
              <p className="text-sm text-muted-foreground">Display contact information page.</p>
            </div>
            <Switch 
              checked={config.showContact !== false} 
              onCheckedChange={(c) => updateConfig("showContact", c)} 
            />
          </div>
          
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Show Locations</Label>
                <Link
                  href="/dashboard/organization/facilities"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Manage Facilities <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">Display your facility locations with maps and hours.</p>
            </div>
            <Switch 
              checked={config.showLocations === true} 
              onCheckedChange={(c) => updateConfig("showLocations", c)} 
            />
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Show Team</Label>
                <Link
                  href="/dashboard/website/team"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Manage Team <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">Display your team members on the public site.</p>
            </div>
            <Switch 
              checked={config.showTeam === true} 
              onCheckedChange={(c) => updateConfig("showTeam", c)} 
            />
          </div>

          {competitionsEnabled && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label>Show Competitions</Label>
                    <Link
                      href="/dashboard/competitions"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Manage Competitions <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">Display the competitions page for event registration.</p>
                </div>
                <Switch 
                  checked={config.showCompetitions === true} 
                  onCheckedChange={(c) => updateConfig("showCompetitions", c)} 
                />
              </div>
            </>
          )}

          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Show Store</Label>
                <Link
                  href="/dashboard/store/products"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Manage Products <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">Display the product store for online purchases.</p>
            </div>
            <Switch 
              checked={config.showStore === true} 
              onCheckedChange={(c) => updateConfig("showStore", c)} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
