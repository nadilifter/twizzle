"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useFeatures } from "@/components/feature-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  Trophy,
  MapPin,
  Clock,
  CalendarDays,
  Tag,
  Info,
  Users,
  CreditCard,
  BarChart3,
  Check,
  DollarSign,
  Plus,
  Trash2,
  Heart,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { useMemberships } from "@/hooks/use-memberships"
import { cn } from "@/lib/utils"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"

interface CompetitionConfigurationProps {
  competitionId: string
  onClose: () => void
  onUpdated?: () => void | Promise<void>
}

// -- Types copied/adapted from CompetitionStepper --

interface OrgSport {
  id: string
  name: string
  slug: string
}

function sportSlugToCompetitionType(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_")
}

type PublishStatus = "LIVE" | "DRAFT" | "SCHEDULED"

interface Level {
  id: string
  name: string
  color: string | null
  order: number
}

interface Facility {
  id: string
  name: string
  street: string | null
  city: string | null
  stateProvince: string | null
  country: string | null
}

interface MembershipInstance {
  id: string
  name: string
  price: number
  groupName: string
}

type ResultType = "TIME" | "DISTANCE" | "HEIGHT" | "SCORE"
type SortDir = "ASC" | "DESC"
type SubMode = "NONE" | "VERIFIED_RESULT" | "MANUAL_ENTRY"

interface CategoryResultConfig {
  combinationEntryId: string | null
  individualEntryId: string | null
  sportEventId: string | null
  ageCategoryId: string | null
  label: string
  resultType: ResultType
  sortDirection: SortDir
  precision: number
  seedMarkRequired: boolean
  submissionMode: SubMode
  qualifyingMark: number | null
  isTeamEvent: boolean
  teamSize: number | null
  collectResults: boolean
}

interface SportEventEntry {
  id: string
  code: string
  name: string
  eventGroup: string
  eventType: string
  resultType: ResultType
  sortDirection: SortDir
  defaultPrecision: number
  isActive: boolean
  displayOrder: number
  eligibility?: Array<{
    id: string
    sportEventId: string
    ageCategoryId: string
    isEnabled: boolean
    ageCategory: { id: string; code: string; name: string }
  }>
}

interface SportAgeCategoryEntry {
  id: string
  code: string
  name: string
  minAge: number
  maxAge: number | null
  isActive: boolean
  displayOrder: number
}

const EVENT_GROUP_LABELS: Record<string, string> = {
  sprints: "Sprints",
  hurdles: "Hurdles",
  middle_distance: "Middle Distance",
  distance: "Distance",
  relays: "Relays",
  jumps: "Jumps",
  throws: "Throws",
  combined: "Combined Events",
  racewalk: "Race Walk",
  road: "Road",
}

interface CompetitionFormData {
  // Step 1: General
  name: string
  competitionType: string | null
  facilityId: string | null
  country: string
  stateProvince: string
  city: string
  streetAddress: string
  startDate: Date | null
  endDate: Date | null
  startTime: string
  endTime: string

  // Step 2: Categories
  categoryMode: "ALL" | "SPECIFIC"
  selectedCategoryIds: string[]

  // Step 3: Restrictions
  hasLevelRestriction: boolean
  levelRequirementIds: string[]
  hasCapacityRestriction: boolean
  capacity: number | null
  hasAgeRestriction: boolean
  minAge: number | null
  maxAge: number | null
  hasMembershipRestriction: boolean
  membershipRequirementIds: string[]
  hasWaiverRestriction: boolean
  waiverRequirementIds: string[]
  hasMedicalRequirement: boolean

  // Step 4: Results
  categoryResults: CategoryResultConfig[]

  // Step 5: Pricing
  pricingMode: "FREE" | "PER_COMPETITION" | "PER_EVENT" | "TIERED" | "PER_CATEGORY"
  entryFee: number | null
  pricingTiers: Array<{ minEvents: number; maxEvents: number | null; pricePerEvent: number }>
  categoryPrices: Record<string, number>

  // Step 6: Confirmation
  publishStatus: PublishStatus
  scheduledGoLiveDate: Date | null
  scheduledGoLiveTime: string
}

export function CompetitionConfiguration({
  competitionId,
  onClose,
  onUpdated,
}: CompetitionConfigurationProps) {
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  const { memberships, isLoading: loadingMemberships } = useMemberships({ initialParams: { include: "instances" } })

  const [activeTab, setActiveTab] = useState("general")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Data states
  const [levels, setLevels] = useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [waivers, setWaivers] = useState<Array<{ id: string; title: string; status: string }>>([])
  const [loadingWaivers, setLoadingWaivers] = useState(true)
  const [orgSports, setOrgSports] = useState<OrgSport[]>([])

  // Sport-specific data
  const [sportEvents, setSportEvents] = useState<SportEventEntry[]>([])
  const [sportAgeCategories, setSportAgeCategories] = useState<SportAgeCategoryEntry[]>([])
  const [eligibilitySet, setEligibilitySet] = useState<Set<string>>(new Set())
  const [loadingSportData, setLoadingSportData] = useState(false)
  const [hasSportSpecificData, setHasSportSpecificData] = useState(false)
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set())

  // Form state
  const [formData, setFormData] = useState<CompetitionFormData>({
    name: "",
    competitionType: null,
    facilityId: null,
    country: "",
    stateProvince: "",
    city: "",
    streetAddress: "",
    startDate: null,
    endDate: null,
    startTime: "09:00",
    endTime: "17:00",
    categoryMode: "ALL",
    selectedCategoryIds: [],
    hasLevelRestriction: false,
    levelRequirementIds: [],
    hasCapacityRestriction: false,
    capacity: null,
    hasAgeRestriction: false,
    minAge: null,
    maxAge: null,
    hasMembershipRestriction: false,
    membershipRequirementIds: [],
    hasWaiverRestriction: false,
    waiverRequirementIds: [],
    hasMedicalRequirement: false,
    categoryResults: [],
    pricingMode: "FREE",
    entryFee: null,
    pricingTiers: [{ minEvents: 1, maxEvents: 3, pricePerEvent: 20 }, { minEvents: 4, maxEvents: null, pricePerEvent: 15 }],
    categoryPrices: {},
    publishStatus: "DRAFT",
    scheduledGoLiveDate: null,
    scheduledGoLiveTime: "09:00",
  })

  // -- Initial Data Fetching --

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [compRes, levelsRes, facilitiesRes, waiversRes, sportsRes] = await Promise.all([
          fetch(`/api/competitions/${competitionId}`),
          trainingEnabled ? fetch("/api/levels") : Promise.resolve({ ok: true, json: () => [] }),
          fetch("/api/organization/facilities"),
          fetch("/api/waivers?status=ACTIVE"),
          fetch("/api/organization/sports"),
        ])

        if (!compRes.ok) throw new Error("Failed to load competition")
        const compData = await compRes.json()

        if (levelsRes.ok) setLevels(await levelsRes.json())
        if (facilitiesRes.ok) {
            const facData = await facilitiesRes.json()
            setFacilities(Array.isArray(facData) ? facData : facData.facilities || [])
        }
        if (waiversRes.ok) {
            const wavData = await waiversRes.json()
            setWaivers(wavData.data || [])
        }
        if (sportsRes.ok) setOrgSports(await sportsRes.json())

        // Reconstruct form data
        const categoryResults: CategoryResultConfig[] = (compData.categories || []).map((cat: any) => ({
          combinationEntryId: cat.combinationEntryId || null,
          individualEntryId: cat.individualEntryId || null,
          sportEventId: cat.sportEventId || null,
          ageCategoryId: cat.ageCategoryId || null,
          label: [cat.sportEvent?.name, cat.ageCategory?.code].filter(Boolean).join(" - ") || cat.id,
          resultType: cat.resultType || "TIME",
          sortDirection: cat.sortDirection || "ASC",
          precision: cat.precision ?? 3,
          seedMarkRequired: cat.seedMarkRequired ?? false,
          submissionMode: cat.submissionMode || "NONE",
          qualifyingMark: cat.qualifyingMark ?? null,
          isTeamEvent: cat.isTeamEvent ?? false,
          teamSize: cat.teamSize ?? null,
          collectResults: true,
        }))

        const combos = new Set<string>()
        for (const cat of compData.categories || []) {
          if (cat.sportEventId && cat.ageCategoryId) {
            combos.add(`${cat.sportEventId}:${cat.ageCategoryId}`)
          }
        }
        setSelectedCombos(combos)

        const pricingTiers = (compData.pricingTiers || []).length > 0
          ? compData.pricingTiers.map((t: any) => ({
              minEvents: t.minEvents,
              maxEvents: t.maxEvents ?? null,
              pricePerEvent: typeof t.pricePerEvent === "string" ? parseFloat(t.pricePerEvent) : t.pricePerEvent,
            }))
          : [{ minEvents: 1, maxEvents: 3, pricePerEvent: 20 }, { minEvents: 4, maxEvents: null, pricePerEvent: 15 }]

        const categoryPrices: Record<string, number> = {}
        for (const cat of compData.categories || []) {
          if (cat.price != null) {
            const key = cat.sportEventId && cat.ageCategoryId
              ? `${cat.sportEventId}:${cat.ageCategoryId}`
              : cat.combinationEntryId || cat.individualEntryId || ""
            if (key) {
              categoryPrices[key] = typeof cat.price === "string" ? parseFloat(cat.price) : cat.price
            }
          }
        }

        setFormData({
          name: compData.name || "",
          competitionType: compData.competitionType || null,
          facilityId: compData.facilityId || null,
          country: compData.country || "",
          stateProvince: compData.stateProvince || "",
          city: compData.city || "",
          streetAddress: compData.streetAddress || "",
          startDate: compData.startDate ? new Date(compData.startDate) : null,
          endDate: compData.endDate ? new Date(compData.endDate) : null,
          startTime: compData.startTime || "09:00",
          endTime: compData.endTime || "17:00",
          categoryMode: compData.categoryMode || "ALL",
          selectedCategoryIds: [],
          hasLevelRestriction: compData.hasLevelRestriction ?? false,
          levelRequirementIds: compData.levelRequirementIds || [],
          hasCapacityRestriction: compData.hasCapacityRestriction ?? false,
          capacity: compData.capacity ?? null,
          hasAgeRestriction: compData.hasAgeRestriction ?? false,
          minAge: compData.minAge ?? null,
          maxAge: compData.maxAge ?? null,
          hasMembershipRestriction: compData.hasMembershipRestriction ?? false,
          membershipRequirementIds: compData.membershipRequirementIds || [],
          hasWaiverRestriction: compData.hasWaiverRestriction ?? false,
          waiverRequirementIds: compData.waiverRequirementIds || [],
          hasMedicalRequirement: compData.hasMedicalRequirement ?? false,
          categoryResults,
          pricingMode: compData.pricingMode || "FREE",
          entryFee: compData.entryFee != null ? (typeof compData.entryFee === "string" ? parseFloat(compData.entryFee) : compData.entryFee) : null,
          pricingTiers,
          categoryPrices,
          publishStatus: compData.publishStatus || "DRAFT",
          scheduledGoLiveDate: compData.scheduledGoLiveDate ? new Date(compData.scheduledGoLiveDate) : null,
          scheduledGoLiveTime: compData.scheduledGoLiveTime || "09:00",
        })

      } catch (error) {
        console.error("Failed to load competition config:", error)
        toast.error("Failed to load competition data")
      } finally {
        setIsLoading(false)
        setLoadingLevels(false)
        setLoadingFacilities(false)
        setLoadingWaivers(false)
      }
    }
    fetchData()
  }, [competitionId, trainingEnabled])

  // -- Helpers --

  const fetchSportData = useCallback(async () => {
    if (!formData.competitionType || orgSports.length === 0) return

    const matchingSport = orgSports.find(
      (s) => sportSlugToCompetitionType(s.slug) === formData.competitionType
    )
    if (!matchingSport) {
      setHasSportSpecificData(false)
      return
    }

    setLoadingSportData(true)
    try {
      const res = await fetch(`/api/sports/${matchingSport.id}/events`)
      if (!res.ok) {
        setHasSportSpecificData(false)
        return
      }
      const data = await res.json()
      const events: SportEventEntry[] = data.events || []

      if (events.length === 0) {
        setHasSportSpecificData(false)
        return
      }

      setSportEvents(events)
      setHasSportSpecificData(true)

      const ageCatMap = new Map<string, SportAgeCategoryEntry>()
      const eligKeys = new Set<string>()
      for (const evt of events) {
        for (const elig of evt.eligibility || []) {
          if (elig.isEnabled !== false) {
            eligKeys.add(`${evt.id}:${elig.ageCategory.id}`)
            if (!ageCatMap.has(elig.ageCategory.id)) {
              ageCatMap.set(elig.ageCategory.id, {
                id: elig.ageCategory.id,
                code: elig.ageCategory.code,
                name: elig.ageCategory.name,
                minAge: 0,
                maxAge: null,
                isActive: true,
                displayOrder: 0,
              })
            }
          }
        }
      }
      setEligibilitySet(eligKeys)

      const ageCatRes = await fetch(`/api/sports/${matchingSport.id}/age-categories`)
      if (ageCatRes.ok) {
        const ageCatData = await ageCatRes.json()
        setSportAgeCategories(ageCatData.ageCategories || [])
      } else {
        setSportAgeCategories(Array.from(ageCatMap.values()))
      }
    } catch (error) {
      console.error("Failed to fetch sport data:", error)
      setHasSportSpecificData(false)
    } finally {
      setLoadingSportData(false)
    }
  }, [formData.competitionType, orgSports])

  // Eagerly load sport data so we can resolve labels
  useEffect(() => {
    if (formData.competitionType && orgSports.length > 0 && !hasSportSpecificData && !loadingSportData) {
        fetchSportData()
    }
  }, [formData.competitionType, orgSports, hasSportSpecificData, loadingSportData, fetchSportData])

  // Update labels when sport data is available
  useEffect(() => {
    if (sportEvents.length > 0 && sportAgeCategories.length > 0) {
      setFormData(prev => {
        const newResults = prev.categoryResults.map(cat => {
          // Try to find matching event and age category
          if (cat.sportEventId && cat.ageCategoryId) {
             const evt = sportEvents.find(e => e.id === cat.sportEventId)
             const ageCat = sportAgeCategories.find(c => c.id === cat.ageCategoryId)
             if (evt && ageCat) {
               const newLabel = `${evt.name} - ${ageCat.code}`
               if (cat.label !== newLabel) {
                 return { ...cat, label: newLabel }
               }
             }
          }
          return cat
        })
        
        // Simple check to avoid deep equality overhead if not needed, 
        // but here we just check if any label changed by comparing objects
        const changed = newResults.some((r, i) => r.label !== prev.categoryResults[i].label)
        return changed ? { ...prev, categoryResults: newResults } : prev
      })
    }
  }, [sportEvents, sportAgeCategories])

  const handleFacilityChange = (facilityId: string) => {
    if (facilityId === "__manual__") {
      setFormData(prev => ({
        ...prev,
        facilityId: null,
        country: "",
        stateProvince: "",
        city: "",
        streetAddress: "",
      }))
      return
    }
    const facility = facilities.find(f => f.id === facilityId)
    if (facility) {
      setFormData(prev => ({
        ...prev,
        facilityId: facility.id,
        country: facility.country || "",
        stateProvince: facility.stateProvince || "",
        city: facility.city || "",
        streetAddress: facility.street || "",
      }))
    }
  }

  const membershipInstances: MembershipInstance[] = useMemo(() => {
    if (!memberships) return []
    return memberships.flatMap((group: any) =>
      (group.instances || []).map((inst: any) => ({
        id: inst.id,
        name: inst.name,
        price: inst.price ? Number(inst.price) : 0,
        groupName: group.name,
      }))
    )
  }, [memberships])

  // -- Save Logic --

  const saveChanges = async (sectionName: string) => {
    // Before saving categories, rebuild categoryResults if needed
    let categoryResultsToSave = formData.categoryResults
    if (activeTab === "categories" && hasSportSpecificData) {
        const combos = formData.categoryMode === "ALL" ? eligibilitySet : selectedCombos
        const comboKeys = Array.from(combos)
        const results: CategoryResultConfig[] = []
        for (const key of comboKeys) {
          const [eventId, ageCatId] = key.split(":")
          const evt = sportEvents.find((e) => e.id === eventId)
          const ageCat = sportAgeCategories.find((c) => c.id === ageCatId)
          if (!evt || !ageCat) continue

          const existing = formData.categoryResults.find(
            (c) => c.sportEventId === eventId && c.ageCategoryId === ageCatId
          )

          results.push({
            combinationEntryId: null,
            individualEntryId: null,
            sportEventId: eventId,
            ageCategoryId: ageCatId,
            label: `${evt.name} - ${ageCat.code}`,
            resultType: evt.resultType,
            sortDirection: evt.sortDirection,
            precision: evt.defaultPrecision,
            seedMarkRequired: existing?.seedMarkRequired ?? false,
            submissionMode: existing?.submissionMode ?? "NONE",
            qualifyingMark: existing?.qualifyingMark ?? null,
            isTeamEvent: evt.eventType === "relay",
            teamSize: evt.eventType === "relay" ? 4 : null,
            collectResults: existing?.collectResults ?? true,
          })
        }
        categoryResultsToSave = results
        // update local state too
        setFormData(prev => ({...prev, categoryResults: results}))
    }

    setIsSaving(true)
    try {
        const payload = {
            name: formData.name,
            competitionType: formData.competitionType,
            facilityId: formData.facilityId,
            country: formData.country,
            stateProvince: formData.stateProvince,
            city: formData.city,
            streetAddress: formData.streetAddress,
            startDate: formData.startDate?.toISOString(),
            endDate: formData.endDate?.toISOString(),
            startTime: formData.startTime,
            endTime: formData.endTime,
            categoryMode: formData.categoryMode,
            selectedCategoryIds: formData.selectedCategoryIds,
            hasLevelRestriction: formData.hasLevelRestriction,
            levelRequirementIds: formData.levelRequirementIds,
            hasCapacityRestriction: formData.hasCapacityRestriction,
            capacity: formData.capacity,
            hasAgeRestriction: formData.hasAgeRestriction,
            minAge: formData.minAge,
            maxAge: formData.maxAge,
            hasMembershipRestriction: formData.hasMembershipRestriction,
            membershipRequirementIds: formData.membershipRequirementIds,
            hasWaiverRestriction: formData.hasWaiverRestriction,
            waiverRequirementIds: formData.waiverRequirementIds,
            hasMedicalRequirement: formData.hasMedicalRequirement,
            categoryResults: categoryResultsToSave.map((c, i) => ({
              combinationEntryId: c.combinationEntryId,
              individualEntryId: c.individualEntryId,
              sportEventId: c.sportEventId,
              ageCategoryId: c.ageCategoryId,
              resultType: c.resultType,
              sortDirection: c.sortDirection,
              precision: c.precision,
              seedMarkRequired: c.seedMarkRequired,
              submissionMode: c.submissionMode,
              qualifyingMark: c.qualifyingMark,
              isTeamEvent: c.isTeamEvent,
              teamSize: c.teamSize,
              displayOrder: i,
            })),
            pricingMode: formData.pricingMode,
            entryFee: formData.entryFee,
            pricingTiers: formData.pricingMode === "TIERED" ? formData.pricingTiers : [],
            categoryPrices: formData.pricingMode === "PER_CATEGORY" ? formData.categoryPrices : {},
            publishStatus: formData.publishStatus,
            scheduledGoLiveDate: formData.scheduledGoLiveDate?.toISOString(),
            scheduledGoLiveTime: formData.scheduledGoLiveTime,
        }

        const response = await fetch(`/api/competitions/${competitionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        if (!response.ok) throw new Error("Failed to update competition")
        
        toast.success(`${sectionName} saved`)
        if (onUpdated) await onUpdated()
    } catch (error) {
        console.error("Save error:", error)
        toast.error("Failed to save changes")
    } finally {
        setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <h2 className="text-xl font-semibold">{formData.name || "Configure Competition"}</h2>
        <p className="text-sm text-muted-foreground">Manage competition details and options.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 border-b bg-muted/30">
          <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="publishing">Publishing</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          
          {/* GENERAL TAB */}
          <TabsContent value="general" className="mt-0 space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label>Competition Name</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
                <Label>Facility</Label>
                <Select
                    value={formData.facilityId || "__manual__"}
                    onValueChange={handleFacilityChange}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__manual__">Enter address manually</SelectItem>
                        {facilities.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={formData.startDate ? format(formData.startDate, "yyyy-MM-dd") : ""} onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value ? new Date(e.target.value) : null }))} />
                </div>
                <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={formData.endDate ? format(formData.endDate, "yyyy-MM-dd") : ""} onChange={e => setFormData(prev => ({ ...prev, endDate: e.target.value ? new Date(e.target.value) : null }))} />
                </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("General settings")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save General
              </Button>
            </div>
          </TabsContent>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="mt-0 space-y-6 max-w-3xl">
            <RadioGroup
                value={formData.categoryMode}
                onValueChange={(value: "ALL" | "SPECIFIC") => {
                  setFormData(prev => ({
                    ...prev,
                    categoryMode: value,
                    selectedCategoryIds: value === "ALL" ? [] : prev.selectedCategoryIds,
                  }))
                  if (value === "ALL" && hasSportSpecificData) {
                    setSelectedCombos(new Set(eligibilitySet))
                  }
                }}
                className="space-y-4"
            >
                <label className={cn("flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors", formData.categoryMode === "ALL" ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                    <RadioGroupItem value="ALL" className="mt-1" />
                    <div className="flex-1 space-y-1">
                        <span className="font-medium">All Eligible Categories</span>
                        <p className="text-sm text-muted-foreground">Include all event/age combinations available for this sport</p>
                    </div>
                </label>
                <label className={cn("flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors", formData.categoryMode === "SPECIFIC" ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                    <RadioGroupItem value="SPECIFIC" className="mt-1" />
                    <div className="flex-1 space-y-1">
                        <span className="font-medium">Specific Categories</span>
                        <p className="text-sm text-muted-foreground">Manually select which event/age combinations to include</p>
                    </div>
                </label>
            </RadioGroup>

            {hasSportSpecificData && formData.categoryMode === "SPECIFIC" && (
                <div className="space-y-4 border rounded-lg p-4">
                    {loadingSportData ? (
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{selectedCombos.size} selected</span>
                                <div className="space-x-2">
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedCombos(new Set(eligibilitySet))}>Select All</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedCombos(new Set())}>Clear</Button>
                                </div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 sticky top-0">
                                        <tr>
                                            <th className="text-left p-2">Event</th>
                                            {sportAgeCategories.map(c => <th key={c.id} className="p-2 text-center whitespace-nowrap">{c.code}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sportEvents.map(evt => (
                                            <tr key={evt.id} className="border-t">
                                                <td className="p-2 font-medium">{evt.name}</td>
                                                {sportAgeCategories.map(cat => {
                                                    const key = `${evt.id}:${cat.id}`
                                                    const eligible = eligibilitySet.has(key)
                                                    return (
                                                        <td key={cat.id} className="p-2 text-center">
                                                            {eligible && (
                                                                <Checkbox 
                                                                    checked={selectedCombos.has(key)}
                                                                    onCheckedChange={(checked) => {
                                                                        const next = new Set(selectedCombos)
                                                                        if (checked) next.add(key)
                                                                        else next.delete(key)
                                                                        setSelectedCombos(next)
                                                                    }}
                                                                />
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("Categories")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Categories
              </Button>
            </div>
          </TabsContent>

          {/* RESTRICTIONS TAB */}
          <TabsContent value="restrictions" className="mt-0 space-y-6 max-w-2xl">
            {trainingEnabled && (
                <div className="rounded-lg border p-4 flex items-center justify-between">
                    <div>
                        <Label className="text-base">Level Restriction</Label>
                        <p className="text-sm text-muted-foreground">Require athletes to be at specific levels</p>
                    </div>
                    <Switch 
                        checked={formData.hasLevelRestriction}
                        onCheckedChange={c => setFormData(prev => ({ ...prev, hasLevelRestriction: c }))}
                    />
                </div>
            )}
            
            {formData.hasLevelRestriction && (
                <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg bg-muted/10">
                    {levels.map(l => (
                        <div key={l.id} className="flex items-center gap-2">
                            <Checkbox 
                                checked={formData.levelRequirementIds.includes(l.id)}
                                onCheckedChange={(checked) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        levelRequirementIds: checked 
                                            ? [...prev.levelRequirementIds, l.id] 
                                            : prev.levelRequirementIds.filter(id => id !== l.id)
                                    }))
                                }}
                            />
                            <span className="text-sm">{l.name}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-lg border p-4 flex items-center justify-between">
                <div>
                    <Label className="text-base">Capacity Limit</Label>
                    <p className="text-sm text-muted-foreground">Limit total participants</p>
                </div>
                <Switch 
                    checked={formData.hasCapacityRestriction}
                    onCheckedChange={c => setFormData(prev => ({ ...prev, hasCapacityRestriction: c }))}
                />
            </div>
            {formData.hasCapacityRestriction && (
                <Input 
                    type="number" 
                    placeholder="Max capacity" 
                    value={formData.capacity || ""} 
                    onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || null }))}
                />
            )}

            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("Restrictions")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Restrictions
              </Button>
            </div>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="mt-0 space-y-6 max-w-2xl">
            {formData.categoryResults.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                    No categories configured yet.
                </div>
            ) : (
                <div className="space-y-4">
                    <Label>Seed Marks & Result Collection</Label>
                    <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                        {formData.categoryResults.map((cat, idx) => (
                            <div key={idx} className="p-3 flex flex-col gap-2">
                                <div className="font-medium text-sm">{cat.label}</div>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            checked={cat.seedMarkRequired}
                                            onCheckedChange={(checked) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    categoryResults: prev.categoryResults.map((c, i) => i === idx ? { ...c, seedMarkRequired: !!checked, submissionMode: checked ? "MANUAL_ENTRY" : "NONE" } : c)
                                                }))
                                            }}
                                        />
                                        <span className="text-xs">Require Seed</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            checked={cat.collectResults}
                                            onCheckedChange={(checked) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    categoryResults: prev.categoryResults.map((c, i) => i === idx ? { ...c, collectResults: !!checked } : c)
                                                }))
                                            }}
                                        />
                                        <span className="text-xs">Record Results</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("Results settings")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Results Config
              </Button>
            </div>
          </TabsContent>

          {/* PRICING TAB */}
          <TabsContent value="pricing" className="mt-0 space-y-6 max-w-2xl">
            <RadioGroup 
                value={formData.pricingMode}
                onValueChange={(val: any) => setFormData(prev => ({ ...prev, pricingMode: val }))}
                className="grid grid-cols-2 gap-4"
            >
                {["FREE", "PER_COMPETITION", "PER_EVENT", "TIERED", "PER_CATEGORY"].map(mode => (
                    <label key={mode} className={cn("border rounded-lg p-4 cursor-pointer hover:bg-muted/50", formData.pricingMode === mode && "border-primary bg-primary/5")}>
                        <RadioGroupItem value={mode} className="sr-only" />
                        <span className="font-medium text-sm">{mode.replace("_", " ")}</span>
                    </label>
                ))}
            </RadioGroup>

            {(formData.pricingMode === "PER_COMPETITION" || formData.pricingMode === "PER_EVENT") && (
                <div className="space-y-2">
                    <Label>Price Amount</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="number" 
                            className="pl-9" 
                            value={formData.entryFee || ""} 
                            onChange={e => setFormData(prev => ({ ...prev, entryFee: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                </div>
            )}

            {formData.pricingMode === "PER_CATEGORY" && (
                <div className="space-y-2 border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    {formData.categoryResults.map((cat, idx) => {
                        const key = cat.sportEventId && cat.ageCategoryId ? `${cat.sportEventId}:${cat.ageCategoryId}` : `cat-${idx}`
                        return (
                            <div key={key} className="flex justify-between items-center text-sm">
                                <span>{cat.label}</span>
                                <Input 
                                    type="number" 
                                    className="w-24 h-8" 
                                    placeholder="0.00"
                                    value={formData.categoryPrices[key] || ""}
                                    onChange={e => setFormData(prev => ({
                                        ...prev,
                                        categoryPrices: { ...prev.categoryPrices, [key]: parseFloat(e.target.value) || 0 }
                                    }))}
                                />
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("Pricing")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Pricing
              </Button>
            </div>
          </TabsContent>

          {/* PUBLISHING TAB */}
          <TabsContent value="publishing" className="mt-0 space-y-6 max-w-2xl">
            <RadioGroup 
                value={formData.publishStatus}
                onValueChange={(val: any) => setFormData(prev => ({ ...prev, publishStatus: val }))}
                className="space-y-3"
            >
                <label className={cn("flex items-center gap-3 border p-4 rounded-lg cursor-pointer", formData.publishStatus === "DRAFT" && "border-primary")}>
                    <RadioGroupItem value="DRAFT" />
                    <div>
                        <div className="font-medium">Draft</div>
                        <div className="text-xs text-muted-foreground">Hidden from public</div>
                    </div>
                </label>
                <label className={cn("flex items-center gap-3 border p-4 rounded-lg cursor-pointer", formData.publishStatus === "LIVE" && "border-primary")}>
                    <RadioGroupItem value="LIVE" />
                    <div>
                        <div className="font-medium">Live</div>
                        <div className="text-xs text-muted-foreground">Visible and open</div>
                    </div>
                </label>
                <label className={cn("flex items-center gap-3 border p-4 rounded-lg cursor-pointer", formData.publishStatus === "SCHEDULED" && "border-primary")}>
                    <RadioGroupItem value="SCHEDULED" />
                    <div>
                        <div className="font-medium">Scheduled</div>
                        <div className="text-xs text-muted-foreground">Go live at specific time</div>
                    </div>
                </label>
            </RadioGroup>

            {formData.publishStatus === "SCHEDULED" && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={formData.scheduledGoLiveDate ? format(formData.scheduledGoLiveDate, "yyyy-MM-dd") : ""} onChange={e => setFormData(prev => ({ ...prev, scheduledGoLiveDate: new Date(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                        <Label>Time</Label>
                        <Input type="time" value={formData.scheduledGoLiveTime} onChange={e => setFormData(prev => ({ ...prev, scheduledGoLiveTime: e.target.value }))} />
                    </div>
                </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button onClick={() => saveChanges("Publishing status")} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Publishing
              </Button>
            </div>
          </TabsContent>

        </div>
      </Tabs>

      <div className="p-4 border-t flex justify-end bg-background">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
