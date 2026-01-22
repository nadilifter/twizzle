import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShoppingCart } from "lucide-react"

export default function MerchandisePage() {
  const products = [
    {
      id: 1,
      name: "Campaign T-Shirt",
      description: "100% Cotton, various sizes available.",
      price: 25.0,
      category: "Apparel",
    },
    {
      id: 2,
      name: "Eco Water Bottle",
      description: "Stainless steel, keeps drinks cold for 24h.",
      price: 20.0,
      category: "Accessories",
    },
    {
      id: 3,
      name: "Supporter Cap",
      description: "Adjustable strap, embroidered logo.",
      price: 15.0,
      category: "Apparel",
    },
    {
      id: 4,
      name: "Tote Bag",
      description: "Durable canvas bag for everyday use.",
      price: 12.0,
      category: "Accessories",
    },
    {
      id: 5,
      name: "Notebook & Pen Set",
      description: "Recycled paper notebook with branded pen.",
      price: 10.0,
      category: "Stationery",
    },
    {
      id: 6,
      name: "Sticker Pack",
      description: "Set of 5 vinyl stickers.",
      price: 5.0,
      category: "Accessories",
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Merchandise Store</h2>
          <p className="text-muted-foreground">
            Support us by purchasing our branded merchandise.
          </p>
        </div>
        <Button>
          <ShoppingCart className="mr-2 h-4 w-4" /> View Cart
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col overflow-hidden">
            <div className="aspect-square relative bg-muted">
               <div className="flex h-full items-center justify-center text-muted-foreground">
                  Product Image
               </div>
            </div>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">
                    {product.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary">${product.price.toFixed(2)}</Badge>
              </div>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button className="w-full">Add to Cart</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
