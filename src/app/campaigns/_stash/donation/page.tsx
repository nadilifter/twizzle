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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heart } from "lucide-react"

export default function DonationPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="mx-auto max-w-2xl w-full">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold tracking-tight">Make a Difference</h2>
          <p className="text-muted-foreground">
            Your contribution helps us continue our mission.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Donation Details</CardTitle>
            <CardDescription>
              Choose your donation amount and method.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="one-time" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="one-time">One-time</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
              <TabsContent value="one-time" className="pt-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Button variant="outline" className="h-16 text-lg">
                    $25
                  </Button>
                  <Button variant="outline" className="h-16 text-lg border-primary bg-primary/5">
                    $50
                  </Button>
                  <Button variant="outline" className="h-16 text-lg">
                    $100
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="monthly" className="pt-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Button variant="outline" className="h-16 text-lg">
                    $10
                  </Button>
                  <Button variant="outline" className="h-16 text-lg">
                    $25
                  </Button>
                  <Button variant="outline" className="h-16 text-lg">
                    $50
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="amount">Custom Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  placeholder="Enter custom amount"
                  className="pl-8"
                  type="number"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-name">First name</Label>
                <Input id="first-name" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input id="last-name" placeholder="Doe" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment">Payment Method</Label>
              <Select>
                <SelectTrigger id="payment">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg">
              <Heart className="mr-2 h-4 w-4" /> Donate Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
