"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Settings, Loader2, AlertCircle, Users, Clock, Globe, Timer } from "lucide-react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { useQueueConfig, type QueueConfig } from "@/hooks/use-queue-config"
import { usePrograms } from "@/hooks/use-programs"
import { toast } from "sonner"
import { QueueConfiguration } from "./queue-configuration"

export default function QueuesPage() {
  const { configs, isLoading, error, fetchConfigs, createConfig, toggleConfig, deleteConfig } = useQueueConfig({ includeProgram: true })
  const { programs } = usePrograms()
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [selectedConfig, setSelectedConfig] = React.useState<QueueConfig | null>(null)
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  // Find programs that don't have a queue config yet
  const programsWithoutQueue = programs.filter(
    p => !configs.some(c => c.programId === p.id)
  )

  const hasGlobalQueue = configs.some(c => c.programId === null)

  const handleCreateGlobal = async () => {
    const result = await createConfig({
      programId: null,
      isEnabled: false,
      reservationMinutes: 10,
      maxConcurrent: 50,
      activationType: "ALWAYS",
    })
    if (result) {
      toast.success("Global queue configuration created")
      setSelectedConfig(result)
      setIsEditOpen(true)
    } else {
      toast.error("Failed to create queue configuration")
    }
  }

  const handleCreateForProgram = async (programId: string) => {
    const result = await createConfig({
      programId,
      isEnabled: false,
      reservationMinutes: 10,
      maxConcurrent: 50,
      activationType: "ALWAYS",
    })
    if (result) {
      toast.success("Queue configuration created")
      setSelectedConfig(result)
      setIsEditOpen(true)
    } else {
      toast.error("Failed to create queue configuration")
    }
  }

  const handleToggle = async (config: QueueConfig) => {
    setTogglingId(config.id)
    const success = await toggleConfig(config.id, !config.isEnabled)
    if (success) {
      toast.success(config.isEnabled ? "Queue disabled" : "Queue enabled")
    } else {
      toast.error("Failed to toggle queue")
    }
    setTogglingId(null)
  }

  const handleConfigure = (config: QueueConfig) => {
    setSelectedConfig(config)
    setIsEditOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this queue configuration?")) {
      const success = await deleteConfig(id)
      if (success) {
        toast.success("Queue configuration deleted")
        setIsEditOpen(false)
      } else {
        toast.error("Failed to delete queue configuration")
      }
    }
  }

  const getActivationLabel = (type: string) => {
    switch (type) {
      case "ALWAYS": return "Always Active"
      case "THRESHOLD": return "Threshold-based"
      case "SCHEDULED": return "Scheduled"
      default: return type
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registration Queues</h1>
          <p className="text-muted-foreground">
            Configure virtual waiting rooms to manage high-traffic registration periods.
          </p>
        </div>
        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Queue
          </Button>
        </Sheet>
      </div>

      {isLoading && configs.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-xl">
          {selectedConfig ? (
            <QueueConfiguration 
              config={selectedConfig} 
              onClose={() => setIsEditOpen(false)}
              onUpdate={(updated) => {
                setSelectedConfig(updated)
                fetchConfigs()
              }}
              onDelete={() => handleDelete(selectedConfig.id)}
            />
          ) : (
            <div className="p-6">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Queue Sheet */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent className="sm:max-w-md">
          <div className="flex flex-col h-full">
            <div className="pb-4 border-b">
              <h2 className="text-xl font-semibold">Add Queue Configuration</h2>
              <p className="text-sm text-muted-foreground">Create a new registration queue.</p>
            </div>
            <div className="flex-1 overflow-y-auto py-6 space-y-4">
              {!hasGlobalQueue && (
                <Card 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    handleCreateGlobal()
                    setIsAddOpen(false)
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Global Queue</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Apply a queue to all programs in your organization. This will be the default for any program without its own queue.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Program-Specific Queues</h3>
                {programsWithoutQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    All programs have queue configurations.
                  </p>
                ) : (
                  programsWithoutQueue.map(program => (
                    <Card 
                      key={program.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => {
                        handleCreateForProgram(program.id)
                        setIsAddOpen(false)
                      }}
                    >
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{program.name}</CardTitle>
                          </div>
                          <Badge variant="outline">{program.status}</Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* Global Queue Section */}
          {configs.filter(c => c.programId === null).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Global Queue
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configs.filter(c => c.programId === null).map(config => (
                  <Card key={config.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>Organization-wide Queue</CardTitle>
                          <CardDescription className="mt-1">Default for all programs</CardDescription>
                        </div>
                        <Switch
                          checked={config.isEnabled}
                          onCheckedChange={() => handleToggle(config)}
                          disabled={togglingId === config.id}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          <span>{config.reservationMinutes} min reservation</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Max {config.maxConcurrent} concurrent</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.isEnabled ? "default" : "secondary"}>
                            {config.isEnabled ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">{getActivationLabel(config.activationType)}</Badge>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                      <Button variant="outline" className="w-full" onClick={() => handleConfigure(config)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Program-Specific Queues */}
          {configs.filter(c => c.programId !== null).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Program Queues</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configs.filter(c => c.programId !== null).map(config => (
                  <Card key={config.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{config.program?.name || "Unknown Program"}</CardTitle>
                        </div>
                        <Switch
                          checked={config.isEnabled}
                          onCheckedChange={() => handleToggle(config)}
                          disabled={togglingId === config.id}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          <span>{config.reservationMinutes} min reservation</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>Max {config.maxConcurrent} concurrent</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.isEnabled ? "default" : "secondary"}>
                            {config.isEnabled ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">{getActivationLabel(config.activationType)}</Badge>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                      <Button variant="outline" className="w-full" onClick={() => handleConfigure(config)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {configs.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Queue Configurations</h3>
              <p className="text-muted-foreground mb-4">
                Create a queue to manage high-traffic registration periods.
              </p>
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Queue
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
