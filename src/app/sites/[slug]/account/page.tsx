"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Star, MapPin, User } from "lucide-react";
import { toast } from "sonner";

interface UserContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string | null;
  isPrimary: boolean;
}

interface UserBillingAddress {
  id: string;
  label: string | null;
  street: string;
  city: string;
  stateProvince: string | null;
  postalCode: string;
  country: string;
  isPrimary: boolean;
}

const emptyContact = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  relationship: "",
};

const emptyAddress = {
  label: "",
  street: "",
  city: "",
  stateProvince: "",
  postalCode: "",
};

export default function AccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [addresses, setAddresses] = useState<UserBillingAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Contact form state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<UserContact | null>(null);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Address form state
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserBillingAddress | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, slug, router]);

  // Fetch contacts & addresses
  useEffect(() => {
    if (!session?.user?.email) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [contactsRes, addressesRes] = await Promise.all([
          fetch(`/api/user/contacts`),
          fetch(`/api/user/billing-addresses`),
        ]);
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          setContacts(data.contacts || []);
        }
        if (addressesRes.ok) {
          const data = await addressesRes.json();
          setAddresses(data.addresses || []);
        }
      } catch {
        toast.error("Failed to load account data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [session, slug]);

  // ---- Contact CRUD ----

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm(emptyContact);
    setContactDialogOpen(true);
  };

  const openEditContact = (contact: UserContact) => {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      relationship: contact.relationship || "",
    });
    setContactDialogOpen(true);
  };

  const saveContact = async () => {
    if (
      !contactForm.firstName ||
      !contactForm.lastName ||
      !contactForm.email ||
      !contactForm.phone
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isValidPhoneNumber(contactForm.phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setIsSavingContact(true);
    try {
      if (editingContact) {
        const res = await fetch(`/api/user/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactForm),
        });
        if (!res.ok) throw new Error("Failed to update contact");
        const { contact } = await res.json();
        setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
        toast.success("Contact updated");
      } else {
        const res = await fetch(`/api/user/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...contactForm, isPrimary: contacts.length === 0 }),
        });
        if (!res.ok) throw new Error("Failed to create contact");
        const { contact } = await res.json();
        setContacts((prev) => [...prev, contact]);
        toast.success("Contact added");
      }
      setContactDialogOpen(false);
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setIsSavingContact(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/user/contacts/${contactId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success("Contact removed");
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const setPrimaryContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/user/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setContacts((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === contactId })));
      toast.success("Primary contact updated");
    } catch {
      toast.error("Failed to set primary contact");
    }
  };

  // ---- Address CRUD ----

  const openNewAddress = () => {
    setEditingAddress(null);
    setAddressForm(emptyAddress);
    setAddressDialogOpen(true);
  };

  const openEditAddress = (address: UserBillingAddress) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || "",
      street: address.street,
      city: address.city,
      stateProvince: address.stateProvince || "",
      postalCode: address.postalCode,
    });
    setAddressDialogOpen(true);
  };

  const saveAddress = async () => {
    if (!addressForm.street || !addressForm.city || !addressForm.postalCode) {
      toast.error("Please fill in street, city, and postal code");
      return;
    }
    setIsSavingAddress(true);
    try {
      if (editingAddress) {
        const res = await fetch(`/api/user/billing-addresses/${editingAddress.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addressForm),
        });
        if (!res.ok) throw new Error("Failed to update address");
        const { address } = await res.json();
        setAddresses((prev) => prev.map((a) => (a.id === address.id ? address : a)));
        toast.success("Address updated");
      } else {
        const res = await fetch(`/api/user/billing-addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...addressForm, isPrimary: addresses.length === 0 }),
        });
        if (!res.ok) throw new Error("Failed to create address");
        const { address } = await res.json();
        setAddresses((prev) => [...prev, address]);
        toast.success("Address added");
      }
      setAddressDialogOpen(false);
    } catch {
      toast.error("Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/billing-addresses/${addressId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      toast.success("Address removed");
    } catch {
      toast.error("Failed to delete address");
    }
  };

  const setPrimaryAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/billing-addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setAddresses((prev) => prev.map((a) => ({ ...a, isPrimary: a.id === addressId })));
      toast.success("Primary address updated");
    } catch {
      toast.error("Failed to set primary address");
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading your account...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">My Account</h1>
      <p className="text-muted-foreground mb-8">
        Manage your contact information and billing addresses. These will be pre-filled during
        checkout.
      </p>

      {/* Contacts Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
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
                <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
                <DialogDescription>
                  {editingContact
                    ? "Update this contact's information."
                    : "Add a new contact who can register athletes."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-firstName">First Name *</Label>
                    <Input
                      id="contact-firstName"
                      autoComplete="given-name"
                      value={contactForm.firstName}
                      onChange={(e) => setContactForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-lastName">Last Name *</Label>
                    <Input
                      id="contact-lastName"
                      autoComplete="family-name"
                      value={contactForm.lastName}
                      onChange={(e) => setContactForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email *</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone *</Label>
                  <PhoneInput
                    id="contact-phone"
                    defaultCountry="US"
                    value={contactForm.phone}
                    onChange={(value) => setContactForm((f) => ({ ...f, phone: value || "" }))}
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
                <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveContact} disabled={isSavingContact}>
                  {isSavingContact && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingContact ? "Save Changes" : "Add Contact"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No contacts saved yet.</p>
              <p className="text-sm">Add a contact to speed up checkout.</p>
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
                <CardContent className="pb-3 text-sm text-muted-foreground space-y-1">
                  <p>{contact.email}</p>
                  <p>{contact.phone}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditContact(contact)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!contact.isPrimary && (
                    <Button variant="ghost" size="sm" onClick={() => setPrimaryContact(contact.id)}>
                      <Star className="h-3 w-3 mr-1" />
                      Set Primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={() => deleteContact(contact.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Billing Addresses Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
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
                <DialogTitle>{editingAddress ? "Edit Address" : "Add Address"}</DialogTitle>
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
                    onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-street">Street Address *</Label>
                  <Input
                    id="address-street"
                    autoComplete="street-address"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm((f) => ({ ...f, street: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address-city">City *</Label>
                    <Input
                      id="address-city"
                      autoComplete="address-level2"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address-stateProvince">State / Province</Label>
                    <Input
                      id="address-stateProvince"
                      autoComplete="address-level1"
                      value={addressForm.stateProvince}
                      onChange={(e) =>
                        setAddressForm((f) => ({ ...f, stateProvince: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-postalCode">Postal Code *</Label>
                  <Input
                    id="address-postalCode"
                    autoComplete="postal-code"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm((f) => ({ ...f, postalCode: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveAddress} disabled={isSavingAddress}>
                  {isSavingAddress && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {editingAddress ? "Save Changes" : "Add Address"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {addresses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No billing addresses saved yet.</p>
              <p className="text-sm">Add an address to speed up checkout.</p>
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
                    {address.stateProvince ? `, ${address.stateProvince}` : ""} {address.postalCode}
                  </p>
                  <p>{address.country}</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditAddress(address)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {!address.isPrimary && (
                    <Button variant="ghost" size="sm" onClick={() => setPrimaryAddress(address.id)}>
                      <Star className="h-3 w-3 mr-1" />
                      Set Primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={() => deleteAddress(address.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
