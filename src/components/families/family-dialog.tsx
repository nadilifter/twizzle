"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { FamilyWithRelations, CreateFamilyPayload, UpdateFamilyPayload } from "@/types/families";

interface FamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family?: FamilyWithRelations | null;
  onSubmit: (data: CreateFamilyPayload | UpdateFamilyPayload) => Promise<FamilyWithRelations | null>;
  isSubmitting?: boolean;
}

export function FamilyDialog({
  open,
  onOpenChange,
  family,
  onSubmit,
  isSubmitting = false,
}: FamilyDialogProps) {
  const isEditing = !!family;

  const [name, setName] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Reset form when dialog opens/closes or family changes
  useEffect(() => {
    if (open) {
      if (family) {
        setName(family.name);
        setPrimaryContact(family.primaryContact);
        setEmail(family.email);
        setPhone(family.phone);
        setAddress(family.address || "");
      } else {
        setName("");
        setPrimaryContact("");
        setEmail("");
        setPhone("");
        setAddress("");
      }
    }
  }, [open, family]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !primaryContact.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const data: CreateFamilyPayload | UpdateFamilyPayload = {
      name: name.trim(),
      primaryContact: primaryContact.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
    };

    const result = await onSubmit(data);

    if (result) {
      toast.success(isEditing ? "Family updated successfully" : "Family created successfully");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Family" : "Add Family"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the family's information below."
              : "Add a new family to your organization. Fill in the details below."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Family Name *</Label>
              <Input
                id="name"
                placeholder="e.g., The Smith Family"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primaryContact">Primary Contact Name *</Label>
              <Input
                id="primaryContact"
                placeholder="e.g., John Smith"
                value={primaryContact}
                onChange={(e) => setPrimaryContact(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="123 Main St, City, State ZIP"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Family" : "Add Family"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
