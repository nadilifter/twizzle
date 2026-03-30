"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/avatar-upload";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  RotateCw,
  ArrowLeft,
  Smartphone,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  avatar: string | null;
  createdAt: string;
}

type PhoneVerificationState = "idle" | "sending" | "sent" | "verifying" | "verified";

export default function AccountPage() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationState>("idle");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name || "");
          setPhone(data.phone || "");
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        toast.success("Profile updated");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update profile");
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!phone || !isValidPhoneNumber(phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setPhoneVerification("sending");
    try {
      const res = await fetch("/api/user/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      if (data.sent) {
        setPhoneVerification("sent");
        toast.success("Verification code sent to your phone");
      }
    } catch (error) {
      setPhoneVerification("idle");
      toast.error(error instanceof Error ? error.message : "Failed to send verification code");
    }
  };

  const handleVerifyPhoneCode = async (codeToVerify?: string) => {
    const code = codeToVerify || verificationCode;
    if (!code.trim()) return;

    setPhoneVerification("verifying");
    try {
      const res = await fetch("/api/user/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      if (data.verified) {
        setPhoneVerification("verified");
        setProfile(data.user);
        setPhone(data.user.phone || "");
        toast.success("Phone number verified successfully");
        setTimeout(() => setPhoneVerification("idle"), 2000);
      } else {
        setPhoneVerification("sent");
        setVerificationCode("");
        toast.error("Invalid or expired code. Please try again.");
      }
    } catch (error) {
      setPhoneVerification("sent");
      setVerificationCode("");
      toast.error(error instanceof Error ? error.message : "Verification failed");
    }
  };

  const handleRemovePhone = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: null }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setPhone("");
        setPhoneVerification("idle");
        setVerificationCode("");
        toast.success("Phone number removed");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to remove phone number");
      }
    } catch {
      toast.error("Failed to remove phone number");
    } finally {
      setIsSaving(false);
    }
  };

  const nameHasChanges = profile && name !== profile.name;
  const phoneIsVerified = profile?.phoneVerified && phone === (profile?.phone || "");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar section */}
          <div className="flex items-center gap-4">
            <AvatarUpload
              currentAvatar={profile.avatar}
              name={profile.name}
              uploadUrl="/api/avatar"
              onAvatarChange={(url) => {
                setProfile((prev) => (prev ? { ...prev, avatar: url } : prev));
                updateSession({ avatar: url });
              }}
              size="lg"
            />
            <div>
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-muted-foreground">
                Click the avatar to upload a new profile picture
              </p>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input id="email" value={profile.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed as it is used for login
            </p>
          </div>

          {/* Save name button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving || !nameHasChanges}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Phone Verification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number
          </CardTitle>
          <CardDescription>
            A verified phone number allows you to receive SMS messages from your organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phoneVerification === "sent" || phoneVerification === "verifying" ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Check your phone</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a verification code to{" "}
                  <span className="font-medium text-foreground">{phone}</span>
                </p>
              </div>

              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                value={verificationCode}
                onChange={setVerificationCode}
                onComplete={(code) => handleVerifyPhoneCode(code)}
                disabled={phoneVerification === "verifying"}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {phoneVerification === "verifying" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Verifying...</span>
                </div>
              )}

              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>Didn&apos;t receive the code?</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm"
                  onClick={handleSendPhoneCode}
                  disabled={phoneVerification === "verifying"}
                >
                  <RotateCw className="mr-1 h-3 w-3" />
                  Resend
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setPhoneVerification("idle");
                  setVerificationCode("");
                }}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Use a different number
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {phoneIsVerified ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{profile.phone}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Verified</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={handleRemovePhone}
                      disabled={isSaving}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <PhoneInput
                    id="phone"
                    defaultCountry="US"
                    value={phone}
                    onChange={(value) => setPhone(value || "")}
                  />
                  {profile.phone && !profile.phoneVerified && phone === profile.phone && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      This phone number is not yet verified.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSendPhoneCode}
                      disabled={
                        phoneVerification === "sending" || !phone || !isValidPhoneNumber(phone)
                      }
                    >
                      {phoneVerification === "sending" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : profile.phone && !profile.phoneVerified && phone === profile.phone ? (
                        "Verify Phone Number"
                      ) : (
                        "Send Verification Code"
                      )}
                    </Button>
                    {profile.phone && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={handleRemovePhone}
                        disabled={isSaving}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
