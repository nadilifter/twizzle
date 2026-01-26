"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, AlertCircle, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function WebsitePage() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<'idle' | 'available' | 'taken' | 'invalid' | 'error'>('idle');
  const [domainType, setDomainType] = useState<"subdomain" | "custom">("subdomain");

  // Fetch config on mount
  useEffect(() => {
    fetch("/api/organization/website")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        if (data.domain) {
            setDomainType("custom");
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
        setCheckingSubdomain(true);
        try {
            const res = await fetch(`/api/organization/website/check-subdomain?subdomain=${config.subdomain}`);
            if (!res.ok) {
                // Handle API errors gracefully
                setSubdomainStatus('error');
                console.error("API Error checking subdomain");
                return;
            }
            const data = await res.json();
            if (data.available) {
                setSubdomainStatus('available');
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
  }, [config.subdomain]);

  // Progress Calculation
  const requirements = [
    { label: "Add a logo", done: !!config.logo },
    { label: "Set primary color", done: !!config.primaryColor && config.primaryColor !== "#000000" }, 
    { label: "Set subdomain", done: !!config.subdomain && subdomainStatus === 'available' },
    { label: "Add hero image", done: !!config.heroImage },
  ];
  
  const completedCount = requirements.filter(r => r.done).length;
  const progress = (completedCount / requirements.length) * 100;
  const isReady = completedCount === requirements.length;

  const handlePublishToggle = async () => {
    const newStatus = !config.isPublished;
    
    // Validate before publishing
    if (newStatus) {
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold">Website Builder</h1>
           <p className="text-muted-foreground">Customize your organization's public website.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
                 <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <span>Setup Progress: {Math.round(progress)}%</span>
                    {isReady ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                 </div>
                 <Progress value={progress} className="w-32 h-2" />
            </div>
            <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
            </Button>
             <Button 
                variant={config.isPublished ? "outline" : "default"}
                onClick={handlePublishToggle}
                disabled={!isReady || saving}
             >
                {config.isPublished ? "Unpublish" : "Go Live"}
             </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General & Branding</TabsTrigger>
          <TabsTrigger value="content">Content & Pages</TabsTrigger>
          <TabsTrigger value="settings">Settings & Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
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
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
             <Card>
                <CardHeader>
                    <CardTitle>Hero Section</CardTitle>
                    <CardDescription>Customize the main banner on your home page.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <ImageUpload 
                        label="Hero Background Image" 
                        type="hero" 
                        value={config.heroImage} 
                        onChange={(url) => updateConfig("heroImage", url)} 
                    />
                    <div className="grid gap-2">
                        <Label>Headline</Label>
                        <Input 
                            value={config.heroHeadline || ""} 
                            onChange={(e) => updateConfig("heroHeadline", e.target.value)}
                            placeholder="Welcome to our gym!" 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Subheadline</Label>
                        <Input 
                            value={config.heroSubheadline || ""} 
                            onChange={(e) => updateConfig("heroSubheadline", e.target.value)}
                            placeholder="Where champions are made." 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Introduction Text</Label>
                        <RichTextEditor 
                            value={config.heroText || ""} 
                            onChange={(val) => updateConfig("heroText", val)} 
                        />
                    </div>
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Page Visibility</CardTitle>
                    <CardDescription>Choose which pages are visible to the public.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Show Registration</Label>
                            <p className="text-sm text-muted-foreground">Allow users to register online.</p>
                        </div>
                        <Switch 
                            checked={config.showRegistration !== false} 
                            onCheckedChange={(c) => updateConfig("showRegistration", c)} 
                        />
                     </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Show Login</Label>
                            <p className="text-sm text-muted-foreground">Show login button in navigation.</p>
                        </div>
                        <Switch 
                            checked={config.showLogin !== false} 
                            onCheckedChange={(c) => updateConfig("showLogin", c)} 
                        />
                     </div>
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
                </CardContent>
             </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Domain Settings</CardTitle>
                    <CardDescription>Configure your website address.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <RadioGroup value={domainType} onValueChange={(val: "subdomain" | "custom") => setDomainType(val)}>
                        <div className="flex items-start space-x-2">
                            <RadioGroupItem value="subdomain" id="subdomain" className="mt-1" />
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="subdomain">Use Uplifter Subdomain</Label>
                                <p className="text-sm text-muted-foreground">Get a free subdomain on uplifterinc.com (e.g., mygym.uplifterinc.com).</p>
                                
                                <div className="mt-2">
                                     <div className="flex items-center gap-2">
                                        <div className="relative flex-1 max-w-[250px]">
                                            <Input 
                                                value={config.subdomain || ""} 
                                                onChange={(e) => updateConfig("subdomain", e.target.value)}
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
                                        <span className="text-muted-foreground">.uplifterinc.com</span>
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
                                                <li>If using the root domain (e.g., mygym.com), check if your registrar supports CNAME flattening or ALIAS records. If not, use 'www' as the primary address.</li>
                                            </ol>
                                            <p className="text-xs text-muted-foreground mt-2">Note: DNS changes can take up to 48 hours to propagate.</p>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
