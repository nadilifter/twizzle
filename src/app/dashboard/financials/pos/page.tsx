"use client"

import * as React from "react"
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Search,
  ScanBarcode
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { products, Product, CartItem } from "@/mock-data/products"

export default function PointOfSalePage() {
  const [cart, setCart] = React.useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("all")

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta)
        return { ...item, quantity: newQty }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const tax = subtotal * 0.08 // Mock 8% tax
  const total = subtotal + tax

  const handleCheckout = () => {
    if (cart.length === 0) return
    alert(`Processing payment for $${total.toFixed(2)}`)
    setCart([])
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Product Selection (Left) */}
      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        <div className="flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon">
                    <ScanBarcode className="h-4 w-4" />
                </Button>
            </div>
          </div>
          <div className="flex gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
          </div>
          <Tabs defaultValue="all" className="w-full" onValueChange={setCategoryFilter}>
            <TabsList>
              <TabsTrigger value="all">All Items</TabsTrigger>
              <TabsTrigger value="apparel">Apparel</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="snack">Snacks</TabsTrigger>
              <TabsTrigger value="accessory">Accessories</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-6">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:border-primary transition-colors overflow-hidden"
                onClick={() => addToCart(product)}
              >
                 <div className="aspect-square bg-muted flex items-center justify-center text-muted-foreground">
                    {/* Placeholder for product image */}
                    {product.image ? (
                        <div className="text-xs">{product.name}</div>
                    ) : (
                        <div className="text-xs">No Image</div>
                    )}
                 </div>
                 <CardContent className="p-4">
                   <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{product.name}</h3>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className="font-bold">${product.price.toFixed(2)}</span>
                      <Badge variant="secondary" className="text-xs">{product.stock} in stock</Badge>
                   </div>
                 </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Shopping Cart (Right) */}
      <div className="w-[400px] border-l bg-muted/10 flex flex-col h-full">
        <div className="p-6 border-b bg-background">
          <h2 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Current Order
          </h2>
        </div>
        
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex gap-4 bg-background p-3 rounded-lg border shadow-sm">
                 <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <p className="text-muted-foreground text-xs">${item.price.toFixed(2)} each</p>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <span className="font-bold text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         size="icon" 
                         className="h-6 w-6"
                         onClick={(e) => {
                             e.stopPropagation()
                             updateQuantity(item.id, -1)
                         }}
                        >
                           <Minus className="h-3 w-3" />
                       </Button>
                       <span className="text-sm w-4 text-center">{item.quantity}</span>
                        <Button 
                         variant="outline" 
                         size="icon" 
                         className="h-6 w-6"
                         onClick={(e) => {
                             e.stopPropagation()
                             updateQuantity(item.id, 1)
                         }}
                        >
                           <Plus className="h-3 w-3" />
                       </Button>
                    </div>
                 </div>
              </div>
            ))}
            {cart.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <p>Cart is empty</p>
                    <p className="text-sm">Select items to start sale</p>
                </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 bg-background border-t space-y-4 mt-auto">
           <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
               <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <Separator />
               <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
           </div>
           
           <Button className="w-full size-lg text-lg" disabled={cart.length === 0} onClick={handleCheckout}>
             Checkout
           </Button>
        </div>
      </div>
    </div>
  )
}

