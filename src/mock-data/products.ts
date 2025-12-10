
export type Product = {
  id: string
  name: string
  category: "apparel" | "equipment" | "snack" | "accessory"
  price: number
  stock: number
  sku: string
  image?: string
}

export const products: Product[] = [
  {
    id: "PROD-001",
    name: "Team Leotard - Competition",
    category: "apparel",
    price: 85.00,
    stock: 24,
    sku: "LEO-COMP-2024",
    image: "/products/leo-comp.jpg"
  },
  {
    id: "PROD-002",
    name: "Training Grips",
    category: "equipment",
    price: 45.00,
    stock: 15,
    sku: "GRIPS-STD",
    image: "/products/grips.jpg"
  },
  {
    id: "PROD-003",
    name: "Chalk Block",
    category: "accessory",
    price: 4.50,
    stock: 100,
    sku: "CHALK-BLK",
    image: "/products/chalk.jpg"
  },
  {
    id: "PROD-004",
    name: "Energy Bar",
    category: "snack",
    price: 2.50,
    stock: 50,
    sku: "SNACK-BAR-CHOC",
    image: "/products/bar.jpg"
  },
  {
    id: "PROD-005",
    name: "Wrist Bands",
    category: "accessory",
    price: 12.00,
    stock: 30,
    sku: "WRIST-STD",
    image: "/products/wrist.jpg"
  },
  {
    id: "PROD-006",
    name: "Gym T-Shirt",
    category: "apparel",
    price: 25.00,
    stock: 40,
    sku: "TEE-LOG-2024",
    image: "/products/tshirt.jpg"
  }
]

export type CartItem = Product & {
  quantity: number
}

