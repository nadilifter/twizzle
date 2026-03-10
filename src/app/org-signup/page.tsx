"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Loader2, 
  Check, 
  X, 
  Info, 
  Building2, 
  User, 
  Globe, 
  CreditCard, 
  Palette, 
  Users,
  UserPlus,
  Calendar,
  BookOpen,
  MessageSquare,
  Mail,
  HardDrive,
  Tag,
  Trophy,
} from "lucide-react"
import { toast } from "sonner"
import { validatePassword, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH } from "@/lib/password"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { isValidPhoneNumber } from "react-phone-number-input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { getBaseDomainSuffix } from "@/lib/client-domains"
import { PlansComparisonDialog } from "./plans-comparison-dialog"

interface Sport {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  description: string | null
  monthlyPrice: string
  yearlyPrice: string | null
  transactionFee: string
  perTransactionFee: string
  features: string[]
  featureToggles: Record<string, boolean>
  isPopular: boolean
  maxAthletes: number | null
  maxUsers: number | null
  maxPrograms: number | null
  maxEvents: number | null
  smsIncluded: number | null
  smsOverageRate: string | null
  emailIncluded: number | null
  emailOverageRate: string | null
  maxStorageMB: number | null
  maxMembershipTypes: number | null
}

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
]

const MAX_NAME_LENGTH = 50
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

// US: 12345 or 12345-6789; Canada: A1A 1A1 (letter-digit-letter digit-letter-digit)
function isValidPostalCode(value: string, country: string): boolean {
  const trimmed = value.trim().replace(/\s/g, "")
  if (!trimmed) return false
  if (country === "US") return /^\d{5}(-\d{4})?$/.test(trimmed)
  if (country === "CA") return /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/.test(trimmed)
  return true // no country selected yet
}

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = React.useState(true)
  const [sports, setSports] = React.useState<Sport[]>([])
  const [sportsLoading, setSportsLoading] = React.useState(true)
  
  // Subdomain availability check
  const [subdomainStatus, setSubdomainStatus] = React.useState<"idle" | "checking" | "available" | "taken">("idle")
  const [subdomainReason, setSubdomainReason] = React.useState<string>("")
  const subdomainCheckTimeout = React.useRef<NodeJS.Timeout | null>(null)
  
  // Form state
  const [formData, setFormData] = React.useState({
    // User account
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    
    // Organization
    orgName: "",
    orgEmail: "",
    phone: "",
    street: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
    
    // Website
    subdomain: "",
    
    // Branding (optional)
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    
    // Sports (optional)
    sportIds: [] as string[],

    // Plan
    planId: "",
  })

  // Validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Default country from browser locale (US or CA only)
  React.useEffect(() => {
    if (typeof navigator === "undefined") return
    const locale = navigator.language || (navigator.languages && navigator.languages[0]) || ""
    const region = locale.split("-")[1]?.toUpperCase()
    if (region === "US" || region === "CA") {
      setFormData(prev => (prev.country ? prev : { ...prev, country: region }))
    }
  }, [])

  // Fetch plans on mount
  React.useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/org-signup/plans")
        if (!response.ok) throw new Error("Failed to fetch plans")
        const data = await response.json()
        setPlans(data)
        // Pre-select the most popular plan or first plan
        const popularPlan = data.find((p: SubscriptionPlan) => p.isPopular)
        if (popularPlan) {
          setFormData(prev => ({ ...prev, planId: popularPlan.id }))
        } else if (data.length > 0) {
          setFormData(prev => ({ ...prev, planId: data[0].id }))
        }
      } catch (error) {
        toast.error("Failed to load subscription plans")
      } finally {
        setPlansLoading(false)
      }
    }
    fetchPlans()
  }, [])

  // Fetch sports on mount
  React.useEffect(() => {
    async function fetchSports() {
      try {
        const response = await fetch("/api/sports")
        if (!response.ok) throw new Error("Failed to fetch sports")
        const data = await response.json()
        setSports(data)
      } catch (error) {
        console.error("Failed to load sports:", error)
      } finally {
        setSportsLoading(false)
      }
    }
    fetchSports()
  }, [])

  // Check subdomain availability
  const checkSubdomain = React.useCallback(async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus("idle")
      setSubdomainReason("")
      return
    }

    setSubdomainStatus("checking")
    try {
      const response = await fetch(`/api/org-signup/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`)
      const data = await response.json()
      setSubdomainStatus(data.available ? "available" : "taken")
      setSubdomainReason(data.reason || "")
    } catch (error) {
      setSubdomainStatus("idle")
      setSubdomainReason("")
    }
  }, [])

  // Debounced subdomain check
  const handleSubdomainChange = (value: string) => {
    // Space bar inserts a dash; then normalize: lowercase, alphanumeric and hyphens only
    const withDashes = value.replace(/\s/g, "-")
    const normalized = withDashes.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setFormData(prev => ({ ...prev, subdomain: normalized }))
    if (errors.subdomain) {
      setErrors(prev => ({ ...prev, subdomain: "" }))
    }
    
    if (subdomainCheckTimeout.current) {
      clearTimeout(subdomainCheckTimeout.current)
    }
    
    subdomainCheckTimeout.current = setTimeout(() => {
      checkSubdomain(normalized)
    }, 500)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const trimmed = value.trim()
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors(prev => ({ ...prev, [name]: "Please enter a valid email" }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // User account validation
    if (!formData.name.trim()) {
      newErrors.name = "Your name is required"
    } else if (formData.name.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email"
    }
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else {
      const pwError = validatePassword(formData.password)
      if (pwError) newErrors.password = pwError
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = PASSWORD_MESSAGES.mismatch
    }

    // Organization validation
    if (!formData.orgName.trim()) {
      newErrors.orgName = "Organization name is required"
    }
    if (!formData.orgEmail.trim()) {
      newErrors.orgEmail = "Organization email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.orgEmail)) {
      newErrors.orgEmail = "Please enter a valid email"
    }
    if (!formData.phone) {
      newErrors.phone = "Phone is required"
    } else if (!isValidPhoneNumber(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number"
    }
    if (!formData.country) {
      newErrors.country = "Country is required"
    }
    if (!formData.street.trim()) {
      newErrors.street = "Street address is required"
    }
    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    }
    if (!formData.stateProvince.trim()) {
      newErrors.stateProvince = "State / Province is required"
    }
    if (formData.country === "US" || formData.country === "CA") {
      if (!formData.postalCode.trim()) {
        newErrors.postalCode = "Postal code is required"
      } else if (!isValidPostalCode(formData.postalCode, formData.country)) {
        newErrors.postalCode =
          formData.country === "US"
            ? "Enter a valid US ZIP code (e.g. 12345 or 12345-6789)"
            : "Enter a valid Canadian postal code (e.g. A1A 1A1)"
      }
    }
    if (!HEX_COLOR_REGEX.test(formData.primaryColor)) {
      newErrors.primaryColor = "Enter a valid hex color (e.g. #000000)"
    }
    if (!HEX_COLOR_REGEX.test(formData.secondaryColor)) {
      newErrors.secondaryColor = "Enter a valid hex color (e.g. #ffffff)"
    }

    // Subdomain validation
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = "Subdomain is required"
    } else if (formData.subdomain.length < 3) {
      newErrors.subdomain = "Subdomain must be at least 3 characters"
    } else if (subdomainStatus === "taken") {
      newErrors.subdomain = subdomainReason || "This subdomain is already taken"
    }

    // Plan validation
    if (!formData.planId) {
      newErrors.planId = "Please select a plan"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    // Check if the selected plan is paid (price > 0)
    const selectedPlan = plans.find(p => p.id === formData.planId)
    const isPaidPlan = selectedPlan && Number(selectedPlan.monthlyPrice) > 0

    if (isPaidPlan) {
      // Store form data in session storage and redirect to payment page
      const signupData = {
        ...formData,
        planName: selectedPlan.name,
        planPrice: selectedPlan.monthlyPrice,
      }
      sessionStorage.setItem("org-signup-data", JSON.stringify(signupData))
      router.push("/org-signup/payment")
      return
    }

    // For free plans, proceed directly with signup
    setIsLoading(true)
    try {
      const response = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization")
      }

      toast.success("Organization created successfully!")
      router.push(`/org-signup/success?subdomain=${formData.subdomain}&orgName=${encodeURIComponent(formData.orgName)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(Number(amount))
  }

  return (
    <TooltipProvider>
      <div className="w-full max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your Organization</h1>
          <p className="text-muted-foreground">
            Get started with Uplifter in just a few minutes. All plans include a 30-day free trial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Your Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Your Account</CardTitle>
              </div>
              <CardDescription>
                Create your administrator account
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={handleInputChange}
                  maxLength={MAX_NAME_LENGTH}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                <p className="text-xs text-muted-foreground">{formData.name.length}/{MAX_NAME_LENGTH}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={handleEmailBlur}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={`Min. ${PASSWORD_MIN_LENGTH} chars, upper, lower, number, special`}
                  value={formData.password}
                  onChange={handleInputChange}
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2 sm:col-start-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Organization Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Organization Details</CardTitle>
              </div>
              <CardDescription>
                Tell us about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  name="orgName"
                  placeholder="Your Gymnastics Club"
                  value={formData.orgName}
                  onChange={handleInputChange}
                  className={errors.orgName ? "border-destructive" : ""}
                />
                {errors.orgName && <p className="text-sm text-destructive">{errors.orgName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgEmail">Organization Email</Label>
                <Input
                  id="orgEmail"
                  name="orgEmail"
                  type="email"
                  placeholder="info@yourclub.com"
                  value={formData.orgEmail}
                  onChange={handleInputChange}
                  onBlur={handleEmailBlur}
                  className={errors.orgEmail ? "border-destructive" : ""}
                />
                {errors.orgEmail && <p className="text-sm text-destructive">{errors.orgEmail}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInput
                  id="phone"
                  defaultCountry="US"
                  value={formData.phone}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, phone: value || "" }))
                    if (errors.phone) {
                      setErrors(prev => ({ ...prev, phone: "" }))
                    }
                  }}
                  className={errors.phone ? "[&>input]:border-destructive" : ""}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, country: value }))
                    if (errors.country) setErrors(prev => ({ ...prev, country: "" }))
                  }}
                >
                  <SelectTrigger className={errors.country ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.country && <p className="text-sm text-destructive">{errors.country}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  name="street"
                  autoComplete="street-address"
                  placeholder="123 Main Street"
                  value={formData.street}
                  onChange={handleInputChange}
                  className={errors.street ? "border-destructive" : ""}
                />
                {errors.street && <p className="text-sm text-destructive">{errors.street}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  placeholder="New York"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={errors.city ? "border-destructive" : ""}
                />
                {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateProvince">State / Province</Label>
                <Input
                  id="stateProvince"
                  name="stateProvince"
                  autoComplete="address-level1"
                  placeholder="NY"
                  value={formData.stateProvince}
                  onChange={handleInputChange}
                  className={errors.stateProvince ? "border-destructive" : ""}
                />
                {errors.stateProvince && <p className="text-sm text-destructive">{errors.stateProvince}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  autoComplete="postal-code"
                  placeholder={formData.country === "CA" ? "A1A 1A1" : "10001"}
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  className={errors.postalCode ? "border-destructive" : ""}
                />
                {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Sports (Optional) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Sports Offered</CardTitle>
                <Badge variant="secondary" className="ml-2">Optional</Badge>
              </div>
              <CardDescription>
                Select the sports your organization offers. You can update this later in your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sportsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sports available yet.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sports.map((sport) => {
                    const isSelected = formData.sportIds.includes(sport.id)
                    return (
                      <label
                        key={sport.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({
                              ...prev,
                              sportIds: checked
                                ? [...prev.sportIds, sport.id]
                                : prev.sportIds.filter(id => id !== sport.id),
                            }))
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-0.5">
                          <span className="font-medium text-sm">{sport.name}</span>
                          {sport.description && (
                            <p className="text-xs text-muted-foreground">{sport.description}</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Your Website */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>Your Website</CardTitle>
              </div>
              <CardDescription>
                Choose your organization&apos;s web address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>A custom domain (e.g., yourclub.com) can be configured after initial setup in your dashboard settings.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative flex w-full items-center">
                  <Input
                    id="subdomain"
                    name="subdomain"
                    placeholder="your-club"
                    value={formData.subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    className={cn(
                      "flex-1 min-w-0 rounded-r-none",
                      errors.subdomain ? "border-destructive" : "",
                      subdomainStatus === "available" ? "border-green-500 focus-visible:ring-green-500" : "",
                      subdomainStatus === "taken" ? "border-destructive" : ""
                    )}
                  />
                  <span className="inline-flex items-center px-3 h-9 border border-l-0 rounded-r-md bg-muted text-muted-foreground text-sm whitespace-nowrap">
                    {getBaseDomainSuffix()}
                  </span>
                  {subdomainStatus !== "idle" && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {subdomainStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {subdomainStatus === "available" && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {subdomainStatus === "taken" && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {errors.subdomain && <p className="text-sm text-destructive">{errors.subdomain}</p>}
                {subdomainStatus === "available" && (
                  <p className="text-sm text-green-600">This subdomain is available!</p>
                )}
                {subdomainStatus === "taken" && (
                  <p className="text-sm text-destructive">
                    {subdomainReason || "This subdomain is already taken. Please choose another."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Branding (Optional) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Branding</CardTitle>
                <Badge variant="secondary" className="ml-2">Optional</Badge>
              </div>
              <CardDescription>
                Choose your brand colors. You can customize these later in your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      className="w-12 p-1 h-10 cursor-pointer"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === "" || /^#?[A-Fa-f0-9]{0,6}$/.test(v.replace(/^#/, ""))) {
                          setFormData(prev => ({ ...prev, primaryColor: v.startsWith("#") ? v : "#" + v }))
                          if (errors.primaryColor) setErrors(prev => ({ ...prev, primaryColor: "" }))
                        }
                      }}
                      className={cn("font-mono", errors.primaryColor && "border-destructive")}
                      placeholder="#000000"
                      maxLength={7}
                    />
                  </div>
                  {errors.primaryColor && <p className="text-sm text-destructive">{errors.primaryColor}</p>}
                  <p className="text-xs text-muted-foreground">Used for buttons, links, and accents (e.g. #000000)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      className="w-12 p-1 h-10 cursor-pointer"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === "" || /^#?[A-Fa-f0-9]{0,6}$/.test(v.replace(/^#/, ""))) {
                          setFormData(prev => ({ ...prev, secondaryColor: v.startsWith("#") ? v : "#" + v }))
                          if (errors.secondaryColor) setErrors(prev => ({ ...prev, secondaryColor: "" }))
                        }
                      }}
                      className={cn("font-mono", errors.secondaryColor && "border-destructive")}
                      placeholder="#ffffff"
                      maxLength={7}
                    />
                  </div>
                  {errors.secondaryColor && <p className="text-sm text-destructive">{errors.secondaryColor}</p>}
                  <p className="text-xs text-muted-foreground">Used for backgrounds and highlights (e.g. #ffffff)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Choose Your Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Choose Your Plan</CardTitle>
              </div>
              <CardDescription>
                All plans include a 30-day free trial. {plans.find(p => p.id === formData.planId && Number(p.monthlyPrice) > 0) ? "Credit card required for paid plans." : "No credit card required for free plans."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className={cn(
                    "grid gap-4",
                    plans.length === 1 && "grid-cols-1",
                    plans.length === 2 && "grid-cols-1 sm:grid-cols-2",
                    plans.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setFormData(prev => ({ ...prev, planId: plan.id }))}
                        className={cn(
                          "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                          formData.planId === plan.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        {plan.isPopular && (
                          <Badge className="absolute -top-2 right-2 bg-primary">
                            Popular
                          </Badge>
                        )}
                        {/* Selection indicator */}
                        {formData.planId === plan.id && (
                          <div className="absolute -top-2 -left-2">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                        
                        {/* Plan name and price */}
                        <div className="mb-3">
                          <h3 className="font-semibold text-lg">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                          )}
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-3xl font-bold">
                              {formatCurrency(plan.monthlyPrice)}
                            </span>
                            <span className="text-muted-foreground text-sm">/mo</span>
                          </div>
                          {plan.yearlyPrice && (
                            <p className="text-sm text-muted-foreground">
                              or {formatCurrency(plan.yearlyPrice)}/year
                            </p>
                          )}
                        </div>

                        <Badge variant="secondary" className="mb-3">
                          Free for 30 days
                        </Badge>

                        {/* Limits grid */}
                        <div className="grid grid-cols-4 gap-1 text-center text-xs mb-3 py-2 border-y">
                          <div>
                            <Users className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.maxAthletes || "∞"}</p>
                            <p className="text-muted-foreground">Athletes</p>
                          </div>
                          <div>
                            <UserPlus className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.maxUsers || "∞"}</p>
                            <p className="text-muted-foreground">Users</p>
                          </div>
                          <div>
                            <BookOpen className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.maxPrograms || "∞"}</p>
                            <p className="text-muted-foreground">Programs</p>
                          </div>
                          <div>
                            <Calendar className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.maxEvents || "∞"}</p>
                            <p className="text-muted-foreground">Events</p>
                          </div>
                        </div>

                        {/* Usage limits grid */}
                        <div className="grid grid-cols-4 gap-1 text-center text-xs mb-3 pb-3 border-b">
                          <div>
                            <MessageSquare className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.smsIncluded || "—"}</p>
                            <p className="text-muted-foreground">SMS/mo</p>
                          </div>
                          <div>
                            <Mail className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.emailIncluded || "—"}</p>
                            <p className="text-muted-foreground">Email/mo</p>
                          </div>
                          <div>
                            <HardDrive className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">
                              {plan.maxStorageMB 
                                ? plan.maxStorageMB >= 1000 
                                  ? `${plan.maxStorageMB / 1000}GB` 
                                  : `${plan.maxStorageMB}MB`
                                : "∞"}
                            </p>
                            <p className="text-muted-foreground">Storage</p>
                          </div>
                          <div>
                            <Tag className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
                            <p className="font-medium">{plan.maxMembershipTypes || "∞"}</p>
                            <p className="text-muted-foreground">Memberships</p>
                          </div>
                        </div>

                        {/* Features list */}
                        <ul className="space-y-1.5 text-sm">
                          {plan.features.slice(0, 4).map((feature, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                          {plan.features.length > 4 && (
                            <li className="text-xs text-muted-foreground pl-6">
                              +{plan.features.length - 4} more features
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <PlansComparisonDialog
                      plans={plans}
                      selectedPlanId={formData.planId}
                      onSelectPlan={(planId) =>
                        setFormData((prev) => ({ ...prev, planId }))
                      }
                    >
                      <Button
                        type="button"
                        variant="link"
                        className="text-sm text-primary"
                      >
                        Compare all plans in detail
                      </Button>
                    </PlansComparisonDialog>
                  </div>
                </>
              )}
              {errors.planId && <p className="text-sm text-destructive mt-2">{errors.planId}</p>}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            {(() => {
              const selectedPlan = plans.find(p => p.id === formData.planId)
              const isPaidPlan = selectedPlan && Number(selectedPlan.monthlyPrice) > 0
              return (
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading || subdomainStatus === "checking"}
                  className="w-full sm:w-auto min-w-[200px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isPaidPlan ? "Proceeding to Payment..." : "Creating Organization..."}
                    </>
                  ) : isPaidPlan ? (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Continue to Payment
                    </>
                  ) : (
                    "Create Organization"
                  )}
                </Button>
              )
            })()}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </form>
      </div>
    </TooltipProvider>
  )
}
