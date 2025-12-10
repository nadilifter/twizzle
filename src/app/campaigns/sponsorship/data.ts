export type Sponsor = {
  id: string
  company: string
  contact: string
  tier: "Platinum" | "Gold" | "Silver" | "Bronze"
  amount: number
  status: "Active" | "Expired" | "Pending"
  renewalDate: string
  description?: string
  logo?: string
  website?: string
  email?: string
  phone?: string
  sponsoredEvents?: {
    id: string
    name: string
    date: string
    contribution: number
  }[]
  sponsoredMerchandise?: {
    id: string
    name: string
    quantity: number
    cost: number
  }[]
}

export const sponsors: Sponsor[] = [
  {
    id: "SPN-001",
    company: "Acme Corp",
    contact: "John Doe",
    tier: "Platinum",
    amount: 10000,
    status: "Active",
    renewalDate: "2026-01-01",
    description: "Acme Corp is a leading provider of innovative solutions for the modern world.",
    website: "https://acme.example.com",
    email: "sponsorships@acme.example.com",
    phone: "(555) 123-4567",
    sponsoredEvents: [
      { id: "EVT-101", name: "Annual Charity Gala", date: "2025-06-15", contribution: 5000 },
      { id: "EVT-102", name: "Summer Sports Camp", date: "2025-07-20", contribution: 3000 },
    ],
    sponsoredMerchandise: [
      { id: "MERCH-001", name: "Team Jerseys", quantity: 200, cost: 2000 },
    ]
  },
  {
    id: "SPN-002",
    company: "Global Gym Supplies",
    contact: "Jane Smith",
    tier: "Gold",
    amount: 5000,
    status: "Active",
    renewalDate: "2025-12-15",
    description: "Global Gym Supplies provides high-quality fitness equipment to gyms worldwide.",
    website: "https://globalgym.example.com",
    email: "jane.smith@globalgym.example.com",
    phone: "(555) 987-6543",
    sponsoredEvents: [
      { id: "EVT-103", name: "Winter Fitness Challenge", date: "2025-01-10", contribution: 2500 },
    ],
    sponsoredMerchandise: [
      { id: "MERCH-002", name: "Water Bottles", quantity: 500, cost: 2500 },
    ]
  },
  {
    id: "SPN-003",
    company: "Local Bakery",
    contact: "Bob Miller",
    tier: "Silver",
    amount: 1000,
    status: "Expired",
    renewalDate: "2024-11-01",
    description: "Freshly baked goods every day.",
    sponsoredEvents: [],
    sponsoredMerchandise: [
       { id: "MERCH-003", name: "Event Snacks", quantity: 100, cost: 500 },
    ]
  },
  {
    id: "SPN-004",
    company: "TechStart Inc",
    contact: "Sarah Connor",
    tier: "Gold",
    amount: 5000,
    status: "Pending",
    renewalDate: "2025-02-01",
    description: "Innovative tech startups incubator.",
    sponsoredEvents: [
       { id: "EVT-104", name: "Hackathon 2025", date: "2025-03-15", contribution: 5000 },
    ],
    sponsoredMerchandise: []
  },
]



