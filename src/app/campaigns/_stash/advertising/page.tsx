import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Megaphone, BarChart3, Users, Globe } from "lucide-react"

export default function AdvertisingPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Advertise With Us</h2>
            <p className="text-lg text-muted-foreground">
              Reach a dedicated audience of community-minded individuals. 
              Our platform offers unique opportunities for brands to connect.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle>50k+</CardTitle>
                <CardDescription>Monthly Active Users</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Globe className="h-8 w-8 text-primary mb-2" />
                <CardTitle>120+</CardTitle>
                <CardDescription>Countries Reached</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>3.5%</CardTitle>
                <CardDescription>Average CTR</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Megaphone className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Multi-channel</CardTitle>
                <CardDescription>Web, Email, Social</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">Available Placements</h3>
            <ul className="space-y-2 list-disc list-inside text-muted-foreground">
              <li>Homepage Banner (728x90)</li>
              <li>Sidebar Box (300x250)</li>
              <li>Newsletter Feature</li>
              <li>Sponsored Blog Post</li>
            </ul>
          </div>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Start Your Campaign</CardTitle>
              <CardDescription>
                Fill out the form below and our ad team will get back to you with rates and availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Contact Name</Label>
                  <Input id="contact-name" placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input id="business-name" placeholder="Acme Inc." />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Business Email</Label>
                <Input id="email" type="email" placeholder="ads@acme.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="placement">Interested Placement</Label>
                <Select>
                  <SelectTrigger id="placement">
                    <SelectValue placeholder="Select a placement type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Homepage Banner</SelectItem>
                    <SelectItem value="sidebar">Sidebar Ad</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="sponsored">Sponsored Content</SelectItem>
                    <SelectItem value="bundle">Custom Bundle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Estimated Budget</Label>
                <Select>
                  <SelectTrigger id="budget">
                    <SelectValue placeholder="Select budget range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">$500 - $1,000</SelectItem>
                    <SelectItem value="medium">$1,000 - $5,000</SelectItem>
                    <SelectItem value="large">$5,000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input id="website" placeholder="https://..." />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg">
                Request Media Kit
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
