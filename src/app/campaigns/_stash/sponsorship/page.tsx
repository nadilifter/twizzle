import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check, Handshake } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function SponsorshipPage() {
  const tiers = [
    {
      name: "Silver Sponsor",
      price: "$1,000",
      description: "Great for small businesses wanting to support.",
      features: [
        "Logo on event website",
        "Social media mention",
        "2 Event tickets",
        "Quarter page ad in program",
      ],
    },
    {
      name: "Gold Sponsor",
      price: "$5,000",
      description: "Increased visibility and engagement.",
      features: [
        "Logo on all marketing materials",
        "Dedicated social media post",
        "5 Event tickets",
        "Half page ad in program",
        "Booth space at event",
      ],
      featured: true,
    },
    {
      name: "Platinum Sponsor",
      price: "$10,000+",
      description: "Maximum exposure and partnership status.",
      features: [
        "Premier logo placement",
        "Speaking opportunity",
        "10 Event tickets",
        "Full page ad in program",
        "Premium booth location",
        "VIP reception access",
      ],
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Become a Sponsor</h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Partner with us to drive change and gain visibility for your brand. 
          Choose a sponsorship package that fits your goals.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 mb-8">
        {tiers.map((tier) => (
          <Card 
            key={tier.name} 
            className={`flex flex-col ${tier.featured ? 'border-primary shadow-lg scale-105' : ''}`}
          >
            <CardHeader>
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <div className="text-3xl font-bold mt-2">{tier.price}</div>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={tier.featured ? "default" : "outline"}>
                Select Plan
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mx-auto max-w-2xl w-full">
        <Card>
          <CardHeader>
            <CardTitle>Sponsorship Inquiry</CardTitle>
            <CardDescription>
              Interested in a custom package? Contact us today.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" placeholder="Company Name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea 
                id="message" 
                placeholder="Tell us about your sponsorship goals..." 
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
              <Handshake className="mr-2 h-4 w-4" /> Submit Inquiry
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
