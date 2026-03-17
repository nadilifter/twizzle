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
  Users,
  UserPlus,
  Calendar,
  BookOpen,
  MessageSquare,
  Mail,
  HardDrive,
  Tag
} from "lucide-react"
import { toast } from "sonner"
import { validatePassword, PASSWORD_MESSAGES, PASSWORD_MIN_LENGTH } from "@/lib/password"

import { COUNTRIES } from "@/lib/location-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getBaseDomainSuffix } from "@/lib/client-domains"

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
  isPopular: boolean
  maxAthletes: number | null
  maxUsers: number | null
  maxPrograms: number | null
  maxEvents: number | null
  smsIncluded: number | null
  emailIncluded: number | null
  maxStorageMB: number | null
  maxMembershipTypes: number | null
}

const MAX_NAME_LENGTH = 50

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([])
  const [plansLoading, setPlansLoading] = React.useState(true)
  
  // Subdomain availability check
  const [subdomainStatus, setSubdomainStatus] = React.useState<"idle" | "checking" | "available" | "taken">("idle")
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
    
    // Plan
    planId: "",
  })

  // Validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({})

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

  // Check subdomain availability
  const checkSubdomain = React.useCallback(async (subdomain: string) => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainStatus("idle")
      return
    }

    setSubdomainStatus("checking")
    try {
      const response = await fetch(`/api/org-signup/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`)
      const data = await response.json()
      setSubdomainStatus(data.available ? "available" : "taken")
    } catch (error) {
      setSubdomainStatus("idle")
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

    // Subdomain validation
    if (!formData.subdomain.trim()) {
      newErrors.subdomain = "Subdomain is required"
    } else if (formData.subdomain.length < 3) {
      newErrors.subdomain = "Subdomain must be at least 3 characters"
    } else if (subdomainStatus === "taken") {
      newErrors.subdomain = "This subdomain is already taken"
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
          <fieldset disabled={isLoading} className="space-y-6">
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
                  placeholder="Sunrise Gymnastics Club"
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
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  name="street"
                  placeholder="123 Main Street"
                  value={formData.street}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateProvince">
                  {formData.country === "CA" ? "Province" : "State / Province"}
                </Label>
                <StateProvinceCombobox
                  country={formData.country}
                  value={formData.stateProvince}
                  onChange={(val) => setFormData(prev => ({ ...prev, stateProvince: val }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  placeholder="10001"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    country: value,
                    stateProvince: prev.country !== value ? "" : prev.stateProvince,
                  }))}
                >
                  <SelectTrigger>
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
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Your Website */}
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
                  <p className="text-sm text-destructive">This subdomain is already taken. Please choose another.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Choose Your Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Choose Your Plan</CardTitle>
              </div>
              <CardDescription>
                All plans include a 30-day free trial. No credit card required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
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
              )}
              {errors.planId && <p className="text-sm text-destructive mt-2">{errors.planId}</p>}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || subdomainStatus === "checking"}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
          </fieldset>
        </form>
      </div>
    </TooltipProvider>
  )
}
