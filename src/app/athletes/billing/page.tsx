"use client"

import { useState, useEffect } from "react"
import { formatPhoneNumberIntl, isValidPhoneNumber } from "react-phone-number-input"
import { Loader2, Plus, Pencil, Trash2, Star, MapPin, Phone, User } from "lucide-react"
import { toast } from "sonner"

import { COUNTRIES, getRegionsForCountry, isValidPostalCode } from "@/lib/location-data"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface UserContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  relationship: string | null
  isPrimary: boolean
}

interface UserBillingAddress {
  id: string
  label: string | null
  street: string
  city: string
  stateProvince: string | null
  postalCode: string
  country: string
  isPrimary: boolean
}

const emptyContact = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "",
}

const emptyAddress = {
  label: "",
  country: "US",
  street: "",
  city: "",
  stateProvince: "",
  postalCode: "",
}

export default function BillingPage() {
  const [contacts, setContacts] = useState<UserContact[]>([])
  const [addresses, setAddresses] = useState<UserBillingAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<UserContact | null>(null)
  const [contactForm, setContactForm] = useState(emptyContact)
  const [isSavingContact, setIsSavingContact] = useState(false)

  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<UserBillingAddress | null>(null)
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [isSavingAddress, setIsSavingAddress] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [contactsRes, addressesRes] = await Promise.all([
          fetch("/api/user/contacts"),
          fetch("/api/user/billing-addresses"),
        ])
        if (contactsRes.ok) {
          const data = await contactsRes.json()
          setContacts(data.contacts || [])
        }
        if (addressesRes.ok) {
          const data = await addressesRes.json()
          setAddresses(data.addresses || [])
        }
      } catch {
        toast.error("Failed to load billing details")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // ---- Contact CRUD ----

  const openNewContact = () => {
    setEditingContact(null)
    setContactForm(emptyContact)
    setContactDialogOpen(true)
  }

  const openEditContact = (contact: UserContact) => {
    setEditingContact(contact)
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      relationship: contact.relationship || "",
    })
    setContactDialogOpen(true)
  }

  const saveContact = async () => {
    if (
      !contactForm.firstName ||
      !contactForm.lastName ||
      !contactForm.email ||
      !contactForm.phone
    ) {
      toast.error("Please fill in all required fields")
      return
    }
    if (!isValidPhoneNumber(contactForm.phone)) {
      toast.error("Please enter a valid phone number")
      return
    }
    setIsSavingContact(true)
    try {
      if (editingContact) {
        const res = await fetch(`/api/user/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactForm),
        })
        if (!res.ok) throw new Error("Failed to update contact")
        const { contact } = await res.json()
        setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)))
        toast.success("Contact updated")
      } else {
        const res = await fetch("/api/user/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...contactForm, isPrimary: contacts.length === 0 }),
        })
        if (!res.ok) throw new Error("Failed to create contact")
        const { contact } = await res.json()
        setContacts((prev) => [...prev, contact])
        toast.success("Contact added")
      }
      setContactDialogOpen(false)
    } catch {
      toast.error("Failed to save contact")
    } finally {
      setIsSavingContact(false)
    }
  }

  const deleteContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/user/contacts/${contactId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
      toast.success("Contact removed")
    } catch {
      toast.error("Failed to delete contact")
    }
  }

  const setPrimaryContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/user/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setContacts((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === contactId })))
      toast.success("Primary contact updated")
    } catch {
      toast.error("Failed to set primary contact")
    }
  }

  // ---- Address CRUD ----

  const openNewAddress = () => {
    setEditingAddress(null)
    setAddressForm(emptyAddress)
    setAddressDialogOpen(true)
  }

  const openEditAddress = (address: UserBillingAddress) => {
    setEditingAddress(address)
    setAddressForm({
      label: address.label || "",
      country: address.country || "US",
      street: address.street,
      city: address.city,
      stateProvince: address.stateProvince || "",
      postalCode: address.postalCode,
    })
    setAddressDialogOpen(true)
  }

  const saveAddress = async () => {
    if (!addressForm.country) {
      toast.error("Please select a country")
      return
    }
    if (!addressForm.street || !addressForm.city || !addressForm.postalCode) {
      toast.error("Please fill in street, city, and postal code")
      return
    }
    const regions = getRegionsForCountry(addressForm.country)
    if (regions.length > 0 && !addressForm.stateProvince) {
      toast.error(`Please select a ${addressForm.country === "CA" ? "province" : "state"}`)
      return
    }
    if ((addressForm.country === "US" || addressForm.country === "CA") && !isValidPostalCode(addressForm.postalCode, addressForm.country)) {
      toast.error(
        addressForm.country === "US"
          ? "Enter a valid ZIP code (e.g. 12345 or 12345-6789)"
          : "Enter a valid postal code (e.g. A1A 1A1)"
      )
      return
    }
    setIsSavingAddress(true)
    try {
      if (editingAddress) {
        const res = await fetch(`/api/user/billing-addresses/${editingAddress.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addressForm),
        })
        if (!res.ok) throw new Error("Failed to update address")
        const { address } = await res.json()
        setAddresses((prev) => prev.map((a) => (a.id === address.id ? address : a)))
        toast.success("Address updated")
      } else {
        const res = await fetch("/api/user/billing-addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...addressForm, isPrimary: addresses.length === 0 }),
        })
        if (!res.ok) throw new Error("Failed to create address")
        const { address } = await res.json()
        setAddresses((prev) => [...prev, address])
        toast.success("Address added")
      }
      setAddressDialogOpen(false)
    } catch {
      toast.error("Failed to save address")
    } finally {
      setIsSavingAddress(false)
    }
  }

  const deleteAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/billing-addresses/${addressId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      setAddresses((prev) => prev.filter((a) => a.id !== addressId))
      toast.success("Address removed")
    } catch {
      toast.error("Failed to delete address")
    }
  }

  const setPrimaryAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/billing-addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setAddresses((prev) => prev.map((a) => ({ ...a, isPrimary: a.id === addressId })))
      toast.success("Primary address updated")
    } catch {
      toast.error("Failed to set primary address")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-[min(24rem,100%)]" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your saved contacts and billing addresses. These are pre-filled during checkout on any site.
        </p>
      </div>

      {/* Contacts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Contacts
          </h2>
          <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewContact}>
                <Plus className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? "Edit Contact" : "Add Contact"}
                </DialogTitle>
                <DialogDescription>
                  {editingContact
                    ? "Update this contact's information."
                    : "Add a new contact to pre-fill during checkout."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-firstName">First Name *</Label>
                    <Input
                      id="contact-firstName"
                      value={contactForm.firstName}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-lastName">Last Name *</Label>
                    <Input
                      id="contact-lastName"
                      value={contactForm.lastName}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone *</Label>
                  <PhoneInput
                    id="contact-phone"
                    defaultCountry="US"
                    value={contactForm.phone}
                    onChange={(value) =>
                      setContactForm((f) => ({ ...f, phone: value || "" }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-relationship">Relationship</Label>
                  <Input
                    id="contact-relationship"
                    placeholder="e.g. Parent, Guardian, Sibling"
                    value={contactForm.relationship}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, relationship: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setContactDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={saveContact} disabled={isSavingContact}>
                  {isSavingContact && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  {editingContact ? "Save Changes" : "Add Contact"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No contacts saved yet</p>
              <p className="text-sm mt-1">
                Add a contact to speed up checkout across all sites.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {contact.firstName} {contact.lastName}
                      </CardTitle>
                      {contact.relationship && (
                        <CardDescription>{contact.relationship}</CardDescription>
                      )}
                    </div>
                    {contact.isPrimary && (
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm text-muted-foreground space-y-1.5">
                  <p>{contact.email}</p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    {formatPhoneNumberIntl(contact.phone) || contact.phone}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditContact(contact)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!contact.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryContact(contact.id)}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Primary
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove contact?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {contact.firstName} {contact.lastName} from
                          your saved contacts. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteContact(contact.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Billing Addresses Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Billing Addresses
          </h2>
          <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewAddress}>
                <Plus className="h-4 w-4 mr-1" />
                Add Address
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAddress ? "Edit Address" : "Add Address"}
                </DialogTitle>
                <DialogDescription>
                  {editingAddress
                    ? "Update this billing address."
                    : "Add a new billing address for checkout."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="address-label">Label</Label>
                  <Input
                    id="address-label"
                    placeholder="e.g. Home, Work"
                    value={addressForm.label}
                    onChange={(e) =>
                      setAddressForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country *</Label>
                  <Select
                    value={addressForm.country || undefined}
                    onValueChange={(value) =>
                      setAddressForm((f) => ({
                        ...f,
                        country: value,
                        stateProvince: f.country !== value ? "" : f.stateProvince,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-street">Street Address *</Label>
                  <Input
                    id="address-street"
                    placeholder="e.g. 123 Main St"
                    autoComplete="street-address"
                    value={addressForm.street}
                    onChange={(e) =>
                      setAddressForm((f) => ({ ...f, street: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address-city">City *</Label>
                    <Input
                      id="address-city"
                      autoComplete="address-level2"
                      value={addressForm.city}
                      onChange={(e) =>
                        setAddressForm((f) => ({ ...f, city: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {addressForm.country === "CA" ? "Province" : "State"}{" "}
                      {getRegionsForCountry(addressForm.country).length > 0 ? "*" : ""}
                    </Label>
                    <StateProvinceCombobox
                      country={addressForm.country}
                      value={addressForm.stateProvince}
                      onChange={(val) => setAddressForm((f) => ({ ...f, stateProvince: val }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-postalCode">
                    {addressForm.country === "CA" ? "Postal Code" : "ZIP Code"} *
                  </Label>
                  <Input
                    id="address-postalCode"
                    autoComplete="postal-code"
                    placeholder={addressForm.country === "CA" ? "A1A 1A1" : "12345"}
                    value={addressForm.postalCode}
                    onChange={(e) =>
                      setAddressForm((f) => ({ ...f, postalCode: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddressDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={saveAddress} disabled={isSavingAddress}>
                  {isSavingAddress && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  {editingAddress ? "Save Changes" : "Add Address"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {addresses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No billing addresses saved yet</p>
              <p className="text-sm mt-1">
                Add an address to speed up checkout across all sites.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((address) => (
              <Card key={address.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {address.label || "Billing Address"}
                    </CardTitle>
                    {address.isPrimary && (
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm text-muted-foreground space-y-1">
                  <p>{address.street}</p>
                  <p>
                    {address.city}
                    {address.stateProvince
                      ? `, ${getRegionsForCountry(address.country).find((r) => r.code === address.stateProvince)?.name ?? address.stateProvince}`
                      : ""}{" "}
                    {address.postalCode}
                  </p>
                  <p>{COUNTRIES.find((c) => c.code === address.country)?.name ?? address.country}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditAddress(address)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!address.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPrimaryAddress(address.id)}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Set Primary
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove address?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove &ldquo;{address.label || "Billing Address"}
                          &rdquo; from your saved addresses. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAddress(address.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
