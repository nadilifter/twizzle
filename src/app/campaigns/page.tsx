import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Heart, ShoppingBag, Handshake, Megaphone } from "lucide-react"

export default function CampaignsPage() {
  const campaigns = [
    {
      title: "Donations",
      description: "Support our cause directly with a financial contribution.",
      icon: Heart,
      href: "/campaigns/donation",
      action: "Donate Now",
    },
    {
      title: "Merchandise",
      description: "Buy branded items to show your support and spread the word.",
      icon: ShoppingBag,
      href: "/campaigns/merchandise",
      action: "Shop Now",
    },
    {
      title: "Sponsorship",
      description: "Partner with us to make a bigger impact.",
      icon: Handshake,
      href: "/campaigns/sponsorship",
      action: "Become a Sponsor",
    },
    {
      title: "Advertising",
      description: "Promote your brand while supporting our community.",
      icon: Megaphone,
      href: "/campaigns/advertising",
      action: "Advertise with Us",
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Explore different ways to support and engage with our mission.
          </p>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.title} className="flex flex-col">
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <campaign.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{campaign.title}</CardTitle>
              <CardDescription>{campaign.description}</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button asChild className="w-full">
                <Link href={campaign.href}>{campaign.action}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
