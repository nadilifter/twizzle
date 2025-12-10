
export type Family = {
  id: string
  name: string
  primaryContact: string
  email: string
  phone: string
  address: string
  balance: number
  paymentMethods: PaymentMethod[]
  athletes: string[] // Athlete IDs
}

export type PaymentMethod = {
  id: string
  type: "card" | "bank"
  last4: string
  expiry?: string
  brand?: string
  isDefault: boolean
}

export const families: Family[] = [
  {
    id: "FAM-001",
    name: "Miller Family",
    primaryContact: "Sarah Miller",
    email: "sarah.miller@example.com",
    phone: "555-0101",
    address: "123 Maple Ave, Springfield, IL",
    balance: 0,
    paymentMethods: [
      { id: "PM-001", type: "card", last4: "4242", expiry: "12/25", brand: "Visa", isDefault: true }
    ],
    athletes: ["ATH-001"]
  },
  {
    id: "FAM-002",
    name: "Chen Family",
    primaryContact: "David Chen",
    email: "david.chen@example.com",
    phone: "555-0102",
    address: "456 Oak Dr, Springfield, IL",
    balance: 150.00,
    paymentMethods: [
      { id: "PM-002", type: "bank", last4: "6789", isDefault: true }
    ],
    athletes: ["ATH-002"]
  },
  {
    id: "FAM-003",
    name: "Jones Family",
    primaryContact: "Jessica Jones",
    email: "jessica.jones@example.com",
    phone: "555-0103",
    address: "789 Pine Ln, Springfield, IL",
    balance: -25.00,
    paymentMethods: [
      { id: "PM-003", type: "card", last4: "1111", expiry: "05/26", brand: "Mastercard", isDefault: true }
    ],
    athletes: ["ATH-003"]
  },
  {
    id: "FAM-004",
    name: "Wilson Family",
    primaryContact: "Tom Wilson",
    email: "tom.wilson@example.com",
    phone: "555-0104",
    address: "321 Elm St, Springfield, IL",
    balance: 0,
    paymentMethods: [],
    athletes: ["ATH-004"]
  }
]


