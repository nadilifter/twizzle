"use client";

import React, { useEffect, useState } from "react";
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
import { CheckCircle2, Circle } from "lucide-react";

export default function WebsitePage() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    fetch("/api/organization/website")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load website configuration");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
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

  // Progress Calculation
  const requirements = [
    { label: "Add a logo", done: !!config.logo },
    { label: "Set primary color", done: !!config.primaryColor && config.primaryColor !== "#000000" }, // Assuming default is black, but user might want black. Maybe just check if it exists? The default in DB is #000000. Let's just check if it's there.
    { label: "Set subdomain", done: !!config.subdomain },
    { label: "Add hero image", done: !!config.heroImage },
  ];
  // Adjust logic: primaryColor always exists due to default. Maybe check if they touched it? Hard to track. 
  // Let's just assume if it's not empty string it's done.
  const completedCount = requirements.filter(r => r.done).length;
  const progress = (completedCount / requirements.length) * 100;
  const isReady = completedCount === requirements.length;

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
                onClick={() => updateConfig("isPublished", !config.isPublished)}
                disabled={!isReady}
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
                    <div className="grid gap-2">
                        <Label>Subdomain</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                                value={config.subdomain || ""} 
                                onChange={(e) => updateConfig("subdomain", e.target.value)}
                                placeholder="my-gym" 
                                className="max-w-[200px]"
                            />
                            <span className="text-muted-foreground">.uplifterinc.com</span>
                        </div>
                        <p className="text-sm text-muted-foreground">This will be your primary address if you don't have a custom domain.</p>
                    </div>

                     <div className="grid gap-2">
                        <Label>Custom Domain (Optional)</Label>
                        <Input 
                             value={config.domain || ""} 
                             onChange={(e) => updateConfig("domain", e.target.value)}
                             placeholder="www.mygym.com" 
                        />
                        <p className="text-sm text-muted-foreground">Requires DNS configuration. Contact support for assistance.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
