"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Building2, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShineBorder } from "@/components/ui/shine-border"

const organizations = [
  {
    value: "downtown-athletic-club",
    label: "Downtown Athletic Club",
  },
  {
    value: "riverside-fitness",
    label: "Riverside Fitness",
  },
  {
    value: "mountain-view-gym",
    label: "Mountain View Gym",
  },
  {
    value: "ocean-side-sports",
    label: "Ocean Side Sports",
  },
  {
    value: "city-center-wellness",
    label: "City Center Wellness",
  },
]

function SwitchOrganizationForm() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    if (buttonRef.current) {
      setPopoverWidth(buttonRef.current.offsetWidth)
    }
  }, [])

  const handleSelect = (selectedValue: string) => {
    setValue(selectedValue === value ? "" : selectedValue)
    setOpen(false)
    setIsLoading(true)
    // Route to dashboard after selection
    router.push("/dashboard")
  }

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <Image
            src="/uplifter-logo.svg"
            alt="Uplifter"
            width={180}
            height={36}
            className="h-9 w-auto mb-2 dark:brightness-0 dark:invert"
          />
          <h1 className="text-2xl font-bold">Switching Organization</h1>
          <p className="text-sm text-muted-foreground">
            Please wait while we redirect you...
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="relative overflow-hidden w-full max-w-[400px]">
        <ShineBorder shineColor={["#5655ED", "#A07CFE"]} className="text-center" />
        <CardHeader className="items-center pb-2">
          <Image
            src="/uplifter-logo.svg"
            alt="Uplifter"
            width={180}
            height={36}
            className="h-9 w-auto mb-2 dark:brightness-0 dark:invert"
          />
          <h1 className="text-2xl font-bold">Switch Organization</h1>
          <p className="text-sm text-muted-foreground">
            Select an organization to switch to
          </p>
        </CardHeader>
        
        <CardContent className="grid gap-4">
          <div className="grid gap-2 text-left">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={buttonRef}
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {value
                    ? organizations.find((org) => org.value === value)?.label
                    : "Select organization..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="p-0" 
                align="start"
                style={popoverWidth ? { width: `${popoverWidth}px` } : undefined}
              >
                <Command>
                  <CommandInput placeholder="Search organization..." />
                  <CommandList>
                    <CommandEmpty>No organization found.</CommandEmpty>
                    <CommandGroup>
                      {organizations.map((organization) => (
                        <CommandItem
                          key={organization.value}
                          value={organization.value}
                          onSelect={handleSelect}
                        >
                          <Building2 className="mr-2 h-4 w-4" />
                          {organization.label}
                          <Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              value === organization.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            You will be redirected to the dashboard after selecting an organization.
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default function SwitchOrganizationPage() {
  return (
    <SwitchOrganizationForm />
  )
}

