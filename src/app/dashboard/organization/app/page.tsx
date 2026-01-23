"use client"

import { useState } from "react"
import { Upload, Smartphone, MapPin, CalendarCheck, MessageSquare, Bell, FileText, Globe, Palette, Users, BookOpen, Calendar, Trophy, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AppPage() {
  const [primaryColor, setPrimaryColor] = useState("#000000")
  const [secondaryColor, setSecondaryColor] = useState("#ffffff")
  const [appName, setAppName] = useState("My Organization App")
  const [buttonStyle, setButtonStyle] = useState("rounded")
  const [fontFamily, setFontFamily] = useState("sans")
  
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">App Configuration</h1>
          <p className="text-muted-foreground">
            Customize the look and feel of your white-labeled organization app.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Discard Changes</Button>
          <Button>Publish Changes</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main Configuration Area */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Identity</CardTitle>
              <CardDescription>
                Set your app&apos;s name, logo, and visual style.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="app-name">App Name</Label>
                  <Input 
                    id="app-name" 
                    placeholder="e.g. Acme Athletics" 
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">This name will appear in app stores and on the device home screen.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Custom Domain</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                      https://
                    </span>
                    <Input id="domain" className="rounded-l-none" placeholder="app.yourdomain.com" />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for deep links and email communications.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>App Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">Upload your logo</h4>
                    <p className="text-xs text-muted-foreground">
                      Recommended dimensions: 1024x1024px. <br />
                      Format: PNG or JPG. Max size: 2MB.
                    </p>
                    <Button variant="secondary" size="sm" className="mt-2">
                      Select File
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="primary-color" 
                      type="color" 
                      className="w-12 p-1 h-10" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                    />
                    <Input 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Secondary / Accent Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="secondary-color" 
                      type="color" 
                      className="w-12 p-1 h-10" 
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                    />
                    <Input 
                      value={secondaryColor} 
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                 <div className="space-y-2">
                  <Label htmlFor="button-style">Button Style</Label>
                  <Select value={buttonStyle} onValueChange={setButtonStyle}>
                    <SelectTrigger id="button-style">
                      <SelectValue placeholder="Select button style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp">Sharp (Square)</SelectItem>
                      <SelectItem value="rounded">Rounded (Default)</SelectItem>
                      <SelectItem value="pill">Pill (Fully Rounded)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-family">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger id="font-family">
                      <SelectValue placeholder="Select font family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sans">Sans-Serif (Modern)</SelectItem>
                      <SelectItem value="serif">Serif (Classic)</SelectItem>
                      <SelectItem value="mono">Monospace (Technical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Selection</CardTitle>
              <CardDescription>
                Enable or disable specific features for your organization&apos;s app.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <MapPin className="w-4 h-4 text-primary" />
                     <Label htmlFor="gps-tracking" className="font-medium">GPS Tracking</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Allow tracking of users or assets during events.
                  </span>
                </div>
                <Switch id="gps-tracking" />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <CalendarCheck className="w-4 h-4 text-primary" />
                     <Label htmlFor="event-checkin" className="font-medium">Event Check-ins</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Enable QR code or location-based check-ins for events.
                  </span>
                </div>
                <Switch id="event-checkin" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <MessageSquare className="w-4 h-4 text-primary" />
                     <Label htmlFor="direct-comms" className="font-medium">Direct Communication</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Allow staff to chat directly with members via the app.
                  </span>
                </div>
                <Switch id="direct-comms" defaultChecked />
              </div>
              <Separator />
               <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <Bell className="w-4 h-4 text-primary" />
                     <Label htmlFor="push-notifs" className="font-medium">Push Notifications</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Send alerts and updates directly to user devices.
                  </span>
                </div>
                <Switch id="push-notifs" defaultChecked />
              </div>
               <Separator />
               <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <Users className="w-4 h-4 text-primary" />
                     <Label htmlFor="member-directory" className="font-medium">Member Directory</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Allow members to view and contact other members.
                  </span>
                </div>
                <Switch id="member-directory" />
              </div>
               <Separator />
               <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                     <BookOpen className="w-4 h-4 text-primary" />
                     <Label htmlFor="resource-library" className="font-medium">Resource Library</Label>
                  </div>
                  <span className="text-sm text-muted-foreground pl-6">
                    Host documents, videos, and guides for your members.
                  </span>
                </div>
                <Switch id="resource-library" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Area */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                Approximate representation of your app home screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`border-4 border-slate-800 rounded-[2.5rem] overflow-hidden h-[600px] w-full bg-background relative shadow-xl mx-auto max-w-[300px] font-${fontFamily}`}>
                {/* Status Bar Mock */}
                <div className="h-6 bg-slate-800 w-full absolute top-0 z-20 flex justify-between px-4 items-center">
                    <div className="w-10 h-3 rounded-full bg-slate-700/50"></div>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-slate-700/50"></div>
                        <div className="w-3 h-3 rounded-full bg-slate-700/50"></div>
                    </div>
                </div>
                
                {/* App Header */}
                <div 
                  className="pt-10 pb-4 px-4 text-white relative z-10"
                  style={{ backgroundColor: primaryColor }}
                >
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                            <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="w-8 h-8 bg-white/20 rounded-full"></div>
                    </div>
                    <div className="mt-4">
                        <h3 className="font-bold text-lg">{appName || "Your App Name"}</h3>
                        <p className="text-white/80 text-xs">Welcome back, Andrew!</p>
                    </div>
                </div>

                {/* App Body */}
                <div className="p-4 space-y-4 bg-slate-50 h-full overflow-hidden">
                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`bg-white p-3 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 aspect-square ${
                            buttonStyle === 'pill' ? 'rounded-[1.5rem]' : buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-none'
                        }`}>
                            <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${secondaryColor}20`, color: secondaryColor }}
                            >
                                <CalendarCheck className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-medium text-slate-600">Check In</span>
                        </div>
                        <div className={`bg-white p-3 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 aspect-square ${
                            buttonStyle === 'pill' ? 'rounded-[1.5rem]' : buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-none'
                        }`}>
                             <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${secondaryColor}20`, color: secondaryColor }}
                            >
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-medium text-slate-600">Messages</span>
                        </div>
                    </div>

                    {/* Feed Item */}
                    <div className={`bg-white p-4 shadow-sm border border-slate-100 space-y-3 ${
                        buttonStyle === 'pill' ? 'rounded-[1.5rem]' : buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-none'
                    }`}>
                        <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                            <div>
                                <div className="h-2 w-24 bg-slate-200 rounded mb-1"></div>
                                <div className="h-2 w-16 bg-slate-100 rounded"></div>
                            </div>
                        </div>
                        <div className="h-20 bg-slate-100 rounded-lg w-full"></div>
                    </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
