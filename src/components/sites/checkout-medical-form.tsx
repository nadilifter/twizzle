"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Heart,
  Pill,
  UtensilsCrossed,
  Phone,
  Shield,
  FileText,
  User,
  Plus,
  X,
  Check,
} from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { toast } from "sonner"
import {
  COMMON_ALLERGIES,
  COMMON_CONDITIONS,
  DIETARY_RESTRICTIONS,
  EMERGENCY_CONTACT_RELATIONSHIPS,
} from "@/types/medical"
import type {
  MedicalFormConfig,
  CustomMedicalQuestion,
  AthleteMedicalInfoWithResponses,
  UpsertAthleteMedicalInfoPayload,
} from "@/types/medical"

// ============================================
// Types
// ============================================

type MedicalCategory = "allergies" | "conditions" | "medications" | "dietary"

type MedicalSubStep =
  | "categories"
  | "allergies"
  | "conditions"
  | "medications"
  | "dietary"
  | "emergency_insurance"
  | "custom_questions"

interface CheckoutMedicalFormProps {
  athleteId: string
  athleteName: string
  config: MedicalFormConfig
  customQuestions: CustomMedicalQuestion[]
  organizationId: string
  email: string
  onComplete: () => void
  onBack: () => void
}

// ============================================
// Category Selection Step
// ============================================

function CategorySelector({
  config,
  selectedCategories,
  onToggle,
}: {
  config: MedicalFormConfig
  selectedCategories: Set<MedicalCategory>
  onToggle: (category: MedicalCategory) => void
}) {
  const categories: { key: MedicalCategory; label: string; description: string; icon: React.ReactNode; configKey: keyof MedicalFormConfig }[] = [
    {
      key: "allergies",
      label: "Allergies",
      description: "Food, environmental, and medication allergies",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      configKey: "collectAllergies",
    },
    {
      key: "conditions",
      label: "Medical Conditions",
      description: "Conditions like asthma, diabetes, epilepsy, etc.",
      icon: <Heart className="h-5 w-5 text-red-500" />,
      configKey: "collectConditions",
    },
    {
      key: "medications",
      label: "Medications",
      description: "Current medications being taken",
      icon: <Pill className="h-5 w-5 text-blue-500" />,
      configKey: "collectMedications",
    },
    {
      key: "dietary",
      label: "Dietary Restrictions",
      description: "Dietary restrictions and food preferences",
      icon: <UtensilsCrossed className="h-5 w-5 text-orange-500" />,
      configKey: "collectDietaryRestrictions",
    },
  ]

  // Only show categories enabled in the org config
  const enabledCategories = categories.filter((c) => config[c.configKey] === true)

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select which categories apply. Uncheck any that are not relevant.
      </p>
      {enabledCategories.map((cat) => (
        <label
          key={cat.key}
          className={`flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors ${
            selectedCategories.has(cat.key)
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50"
          }`}
        >
          <Checkbox
            checked={selectedCategories.has(cat.key)}
            onCheckedChange={() => onToggle(cat.key)}
          />
          <div className="flex items-center gap-3 flex-1">
            {cat.icon}
            <div>
              <div className="font-medium">{cat.label}</div>
              <div className="text-sm text-muted-foreground">{cat.description}</div>
            </div>
          </div>
        </label>
      ))}
    </div>
  )
}

// ============================================
// Allergies Form
// ============================================

function AllergiesForm({
  allergies,
  onChange,
}: {
  allergies: string[]
  onChange: (allergies: string[]) => void
}) {
  const [customAllergy, setCustomAllergy] = useState("")

  const toggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      onChange(allergies.filter((a) => a !== allergy))
    } else {
      onChange([...allergies, allergy])
    }
  }

  const addCustom = () => {
    const trimmed = customAllergy.trim()
    if (trimmed && !allergies.includes(trimmed)) {
      onChange([...allergies, trimmed])
      setCustomAllergy("")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Common Allergies</Label>
        <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {COMMON_ALLERGIES.map((allergy) => (
            <label
              key={allergy}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                allergies.includes(allergy)
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={allergies.includes(allergy)}
                onCheckedChange={() => toggleAllergy(allergy)}
              />
              {allergy}
            </label>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Other Allergies</Label>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Add an allergy..."
            value={customAllergy}
            onChange={(e) => setCustomAllergy(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addCustom}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {allergies.filter((a) => !(COMMON_ALLERGIES as readonly string[]).includes(a)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {allergies
              .filter((a) => !(COMMON_ALLERGIES as readonly string[]).includes(a))
              .map((allergy) => (
                <Badge key={allergy} variant="secondary" className="gap-1">
                  {allergy}
                  <button onClick={() => toggleAllergy(allergy)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Conditions Form
// ============================================

function ConditionsForm({
  conditions,
  onChange,
}: {
  conditions: string[]
  onChange: (conditions: string[]) => void
}) {
  const [customCondition, setCustomCondition] = useState("")

  const toggleCondition = (condition: string) => {
    if (conditions.includes(condition)) {
      onChange(conditions.filter((c) => c !== condition))
    } else {
      onChange([...conditions, condition])
    }
  }

  const addCustom = () => {
    const trimmed = customCondition.trim()
    if (trimmed && !conditions.includes(trimmed)) {
      onChange([...conditions, trimmed])
      setCustomCondition("")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Common Conditions</Label>
        <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {COMMON_CONDITIONS.map((condition) => (
            <label
              key={condition}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                conditions.includes(condition)
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={conditions.includes(condition)}
                onCheckedChange={() => toggleCondition(condition)}
              />
              {condition}
            </label>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Other Conditions</Label>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Add a condition..."
            value={customCondition}
            onChange={(e) => setCustomCondition(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addCustom}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {conditions.filter((c) => !(COMMON_CONDITIONS as readonly string[]).includes(c)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {conditions
              .filter((c) => !(COMMON_CONDITIONS as readonly string[]).includes(c))
              .map((condition) => (
                <Badge key={condition} variant="secondary" className="gap-1">
                  {condition}
                  <button onClick={() => toggleCondition(condition)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Medications Form
// ============================================

function MedicationsForm({
  medications,
  onChange,
}: {
  medications: string[]
  onChange: (medications: string[]) => void
}) {
  const [newMedication, setNewMedication] = useState("")

  const addMedication = () => {
    const trimmed = newMedication.trim()
    if (trimmed && !medications.includes(trimmed)) {
      onChange([...medications, trimmed])
      setNewMedication("")
    }
  }

  const removeMedication = (med: string) => {
    onChange(medications.filter((m) => m !== med))
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Current Medications</Label>
        <p className="text-sm text-muted-foreground mb-3">
          List all medications currently being taken, including dosage if known
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Albuterol inhaler, Ibuprofen 200mg..."
            value={newMedication}
            onChange={(e) => setNewMedication(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMedication())}
          />
          <Button type="button" variant="outline" size="icon" onClick={addMedication}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {medications.length > 0 && (
        <div className="space-y-2">
          {medications.map((med, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{med}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMedication(med)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {medications.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No medications added. If there are none, you can skip this step.</p>
      )}
    </div>
  )
}

// ============================================
// Dietary Restrictions Form
// ============================================

function DietaryForm({
  restrictions,
  onChange,
}: {
  restrictions: string[]
  onChange: (restrictions: string[]) => void
}) {
  const toggleRestriction = (restriction: string) => {
    if (restrictions.includes(restriction)) {
      onChange(restrictions.filter((r) => r !== restriction))
    } else {
      onChange([...restrictions, restriction])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Dietary Restrictions</Label>
        <p className="text-sm text-muted-foreground mb-3">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_RESTRICTIONS.map((restriction) => (
            <label
              key={restriction}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                restrictions.includes(restriction)
                  ? "border-primary bg-primary/5 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={restrictions.includes(restriction)}
                onCheckedChange={() => toggleRestriction(restriction)}
              />
              {restriction}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Emergency Contact & Insurance Form
// ============================================

function EmergencyInsuranceForm({
  config,
  emergencyContactName,
  emergencyContactPhone,
  emergencyContactRelation,
  insuranceProvider,
  insurancePolicyNumber,
  onChangeEmergency: onChangeEC,
  onChangeInsurance: onChangeIns,
}: {
  config: MedicalFormConfig
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  insuranceProvider: string
  insurancePolicyNumber: string
  onChangeEmergency: (field: string, value: string) => void
  onChangeInsurance: (field: string, value: string) => void
}) {
  return (
    <div className="space-y-6">
      {config.collectEmergencyContact && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-500" />
            <Label className="text-base font-medium">Emergency Contact</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ecName">Contact Name <span className="text-destructive">*</span></Label>
              <Input
                id="ecName"
                value={emergencyContactName}
                onChange={(e) => onChangeEC("emergencyContactName", e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ecPhone">Phone Number <span className="text-destructive">*</span></Label>
              <PhoneInput
                defaultCountry="US"
                value={emergencyContactPhone}
                onChange={(val) => onChangeEC("emergencyContactPhone", val || "")}
                placeholder="(555) 555-5555"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ecRelation">Relationship <span className="text-destructive">*</span></Label>
              <Select
                value={emergencyContactRelation}
                onValueChange={(v) => onChangeEC("emergencyContactRelation", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {EMERGENCY_CONTACT_RELATIONSHIPS.map((rel) => (
                    <SelectItem key={rel} value={rel}>
                      {rel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {config.collectEmergencyContact && config.collectInsuranceInfo && <Separator />}

      {config.collectInsuranceInfo && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <Label className="text-base font-medium">Insurance Information</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="insProvider">Insurance Provider</Label>
              <Input
                id="insProvider"
                value={insuranceProvider}
                onChange={(e) => onChangeIns("insuranceProvider", e.target.value)}
                placeholder="Provider name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insPolicy">Policy Number</Label>
              <Input
                id="insPolicy"
                value={insurancePolicyNumber}
                onChange={(e) => onChangeIns("insurancePolicyNumber", e.target.value)}
                placeholder="Policy number"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Custom Questions Form
// ============================================

function CustomQuestionsForm({
  questions,
  responses,
  onChangeResponse,
}: {
  questions: CustomMedicalQuestion[]
  responses: Record<string, string>
  onChangeResponse: (questionId: string, value: string) => void
}) {
  if (questions.length === 0) return null

  return (
    <div className="space-y-6">
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label className="text-sm font-medium">
            {q.questionText}
            {q.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {q.questionType === "TEXT" && (
            <Textarea
              value={responses[q.id] || ""}
              onChange={(e) => onChangeResponse(q.id, e.target.value)}
              placeholder="Your answer..."
              rows={2}
            />
          )}

          {q.questionType === "YES_NO" && (
            <RadioGroup
              value={responses[q.id] || ""}
              onValueChange={(v) => onChangeResponse(q.id, v)}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id={`${q.id}-yes`} />
                  <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id={`${q.id}-no`} />
                  <Label htmlFor={`${q.id}-no`}>No</Label>
                </div>
              </div>
            </RadioGroup>
          )}

          {q.questionType === "MULTIPLE_CHOICE" && q.options && (
            <RadioGroup
              value={responses[q.id] || ""}
              onValueChange={(v) => onChangeResponse(q.id, v)}
            >
              <div className="space-y-2">
                {(q.options as string[]).map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${q.id}-${option}`} />
                    <Label htmlFor={`${q.id}-${option}`}>{option}</Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          {q.questionType === "CHECKBOX" && q.options && (
            <div className="space-y-2">
              {(q.options as string[]).map((option) => {
                const currentValues = (responses[q.id] || "").split(",").filter(Boolean)
                return (
                  <label key={option} className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={currentValues.includes(option)}
                      onCheckedChange={(checked) => {
                        const newValues = checked
                          ? [...currentValues, option]
                          : currentValues.filter((v) => v !== option)
                        onChangeResponse(q.id, newValues.join(","))
                      }}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================
// Main Checkout Medical Form
// ============================================

export function CheckoutMedicalForm({
  athleteId,
  athleteName,
  config,
  customQuestions,
  organizationId,
  email,
  onComplete,
  onBack,
}: CheckoutMedicalFormProps) {
  // Sub-step navigation
  const [subStep, setSubStep] = useState<MedicalSubStep>("categories")
  const [selectedCategories, setSelectedCategories] = useState<Set<MedicalCategory>>(() => {
    const initial = new Set<MedicalCategory>()
    if (config.collectAllergies) initial.add("allergies")
    if (config.collectConditions) initial.add("conditions")
    if (config.collectMedications) initial.add("medications")
    if (config.collectDietaryRestrictions) initial.add("dietary")
    return initial
  })

  // Form data
  const [allergies, setAllergies] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>([])
  const [medications, setMedications] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("")
  const [insuranceProvider, setInsuranceProvider] = useState("")
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("")
  const [customResponses, setCustomResponses] = useState<Record<string, string>>({})

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load existing medical info
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const response = await fetch(
          `/api/public/athletes/${athleteId}/medical?organizationId=${organizationId}&email=${encodeURIComponent(email)}`
        )
        if (response.ok) {
          const data = await response.json()
          const info = data.medicalInfo
          if (info && info.id) {
            setAllergies(info.allergies || [])
            setConditions(info.conditions || [])
            setMedications(info.medications || [])
            setDietaryRestrictions(info.dietaryRestrictions || [])
            setEmergencyContactName(info.emergencyContactName || "")
            setEmergencyContactPhone(info.emergencyContactPhone || "")
            setEmergencyContactRelation(info.emergencyContactRelation || "")
            setInsuranceProvider(info.insuranceProvider || "")
            setInsurancePolicyNumber(info.insurancePolicyNumber || "")
            if (info.customResponses) {
              const responses: Record<string, string> = {}
              info.customResponses.forEach((r: any) => {
                responses[r.questionId] = r.response
              })
              setCustomResponses(responses)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching existing medical info:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchExisting()
  }, [athleteId, organizationId, email])

  // Build ordered list of steps
  const getStepOrder = useCallback((): MedicalSubStep[] => {
    const steps: MedicalSubStep[] = ["categories"]

    // Add selected categories
    const categoryOrder: MedicalCategory[] = ["allergies", "conditions", "medications", "dietary"]
    for (const cat of categoryOrder) {
      if (selectedCategories.has(cat)) {
        steps.push(cat)
      }
    }

    // Add emergency/insurance if enabled
    if (config.collectEmergencyContact || config.collectInsuranceInfo) {
      steps.push("emergency_insurance")
    }

    // Add custom questions if any
    if (customQuestions.length > 0) {
      steps.push("custom_questions")
    }

    return steps
  }, [selectedCategories, config, customQuestions])

  // Save the current section's data progressively
  const saveCurrentSection = async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      const payload: UpsertAthleteMedicalInfoPayload & { organizationId: string; email: string } = {
        organizationId,
        email,
      }

      // Include all data we have so far
      if (selectedCategories.has("allergies")) payload.allergies = allergies
      if (selectedCategories.has("conditions")) payload.conditions = conditions
      if (selectedCategories.has("medications")) payload.medications = medications
      if (selectedCategories.has("dietary")) payload.dietaryRestrictions = dietaryRestrictions

      // For non-selected categories, explicitly send empty arrays
      if (!selectedCategories.has("allergies")) payload.allergies = []
      if (!selectedCategories.has("conditions")) payload.conditions = []
      if (!selectedCategories.has("medications")) payload.medications = []
      if (!selectedCategories.has("dietary")) payload.dietaryRestrictions = []

      // Include emergency/insurance if on that step or past it
      if (config.collectEmergencyContact) {
        payload.emergencyContactName = emergencyContactName || null
        payload.emergencyContactPhone = emergencyContactPhone || null
        payload.emergencyContactRelation = emergencyContactRelation || null
      }
      if (config.collectInsuranceInfo) {
        payload.insuranceProvider = insuranceProvider || null
        payload.insurancePolicyNumber = insurancePolicyNumber || null
      }

      // Include custom responses
      if (Object.keys(customResponses).length > 0) {
        payload.customResponses = Object.entries(customResponses)
          .filter(([, v]) => v.trim())
          .map(([questionId, response]) => ({ questionId, response }))
      }

      const response = await fetch(`/api/public/athletes/${athleteId}/medical`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to save medical info")
      }

      return true
    } catch (error) {
      console.error("Error saving medical info:", error)
      toast.error("Failed to save medical information")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleNext = async () => {
    const steps = getStepOrder()
    const currentIndex = steps.indexOf(subStep)

    if (subStep === "emergency_insurance" && config.collectEmergencyContact) {
      if (!emergencyContactName.trim()) {
        toast.error("Emergency contact name is required")
        return
      }
      if (!emergencyContactPhone.trim()) {
        toast.error("Emergency contact phone number is required")
        return
      }
      if (!emergencyContactRelation) {
        toast.error("Emergency contact relationship is required")
        return
      }
    }

    // Save current section
    const saved = await saveCurrentSection()
    if (!saved) return

    if (currentIndex < steps.length - 1) {
      setSubStep(steps[currentIndex + 1])
    } else {
      // All steps complete
      toast.success(`Medical information saved for ${athleteName}`)
      onComplete()
    }
  }

  const handlePrevious = () => {
    const steps = getStepOrder()
    const currentIndex = steps.indexOf(subStep)

    if (currentIndex > 0) {
      setSubStep(steps[currentIndex - 1])
    } else {
      onBack()
    }
  }

  const toggleCategory = (category: MedicalCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Compute step info for display
  const steps = getStepOrder()
  const currentStepIndex = steps.indexOf(subStep)
  const totalSteps = steps.length
  const isLastStep = currentStepIndex === totalSteps - 1

  // Step labels for display
  const stepLabels: Record<MedicalSubStep, string> = {
    categories: "Select Categories",
    allergies: "Allergies",
    conditions: "Medical Conditions",
    medications: "Medications",
    dietary: "Dietary Restrictions",
    emergency_insurance: "Emergency Contact & Insurance",
    custom_questions: "Additional Questions",
  }

  const stepIcons: Record<MedicalSubStep, React.ReactNode> = {
    categories: <Heart className="h-5 w-5" />,
    allergies: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    conditions: <Heart className="h-5 w-5 text-red-500" />,
    medications: <Pill className="h-5 w-5 text-blue-500" />,
    dietary: <UtensilsCrossed className="h-5 w-5 text-orange-500" />,
    emergency_insurance: <Phone className="h-5 w-5 text-green-500" />,
    custom_questions: <FileText className="h-5 w-5" />,
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-primary">{athleteName}</span>
        </div>
        <CardTitle className="flex items-center gap-2">
          {stepIcons[subStep]}
          Medical Information
        </CardTitle>
        <CardDescription>
          Step {currentStepIndex + 1} of {totalSteps}: {stepLabels[subStep]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress indicator */}
        <div className="flex gap-1">
          {steps.map((step, i) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Category selection */}
        {subStep === "categories" && (
          <CategorySelector
            config={config}
            selectedCategories={selectedCategories}
            onToggle={toggleCategory}
          />
        )}

        {/* Category forms */}
        {subStep === "allergies" && (
          <AllergiesForm allergies={allergies} onChange={setAllergies} />
        )}

        {subStep === "conditions" && (
          <ConditionsForm conditions={conditions} onChange={setConditions} />
        )}

        {subStep === "medications" && (
          <MedicationsForm medications={medications} onChange={setMedications} />
        )}

        {subStep === "dietary" && (
          <DietaryForm restrictions={dietaryRestrictions} onChange={setDietaryRestrictions} />
        )}

        {/* Emergency contact & insurance */}
        {subStep === "emergency_insurance" && (
          <EmergencyInsuranceForm
            config={config}
            emergencyContactName={emergencyContactName}
            emergencyContactPhone={emergencyContactPhone}
            emergencyContactRelation={emergencyContactRelation}
            insuranceProvider={insuranceProvider}
            insurancePolicyNumber={insurancePolicyNumber}
            onChangeEmergency={(field, value) => {
              if (field === "emergencyContactName") setEmergencyContactName(value)
              if (field === "emergencyContactPhone") setEmergencyContactPhone(value)
              if (field === "emergencyContactRelation") setEmergencyContactRelation(value)
            }}
            onChangeInsurance={(field, value) => {
              if (field === "insuranceProvider") setInsuranceProvider(value)
              if (field === "insurancePolicyNumber") setInsurancePolicyNumber(value)
            }}
          />
        )}

        {/* Custom questions */}
        {subStep === "custom_questions" && (
          <CustomQuestionsForm
            questions={customQuestions}
            responses={customResponses}
            onChangeResponse={(questionId, value) => {
              setCustomResponses((prev) => ({ ...prev, [questionId]: value }))
            }}
          />
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLastStep ? (
            <>
              <Check className="mr-1 h-4 w-4" />
              Save & Continue
            </>
          ) : (
            <>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
