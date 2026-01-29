"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAthleteMedicalInfo } from "@/hooks/use-medical";
import { MedicalDisplay } from "@/components/medical/medical-display";
import { MedicalForm } from "@/components/medical/medical-form";

interface Athlete {
  id: string;
  name: string;
  avatar: string | null;
  level: string;
  group: string;
}

export default function AthleteMedicalPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const { 
    medicalInfo, 
    customQuestions, 
    config, 
    isLoading: medicalLoading,
    isSaving,
    saveMedicalInfo 
  } = useAthleteMedicalInfo(selectedAthleteId);

  // Fetch athletes for the family
  useEffect(() => {
    async function fetchAthletes() {
      setIsLoadingAthletes(true);
      try {
        const response = await api.get<{ data: Athlete[] }>("/api/athletes", {});
        const athleteData = response.data || [];
        setAthletes(athleteData);
        
        // Select first athlete by default
        if (athleteData.length > 0 && !selectedAthleteId) {
          setSelectedAthleteId(athleteData[0].id);
        }
      } catch (error) {
        console.error("Error fetching athletes:", error);
        toast.error("Failed to load athletes");
      } finally {
        setIsLoadingAthletes(false);
      }
    }

    fetchAthletes();
  }, []);

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  const handleSave = async (data: any) => {
    const success = await saveMedicalInfo(data);
    if (success) {
      toast.success("Medical information saved successfully");
      setIsEditing(false);
    } else {
      toast.error("Failed to save medical information");
    }
    return success;
  };

  if (isLoadingAthletes) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardHeader>
            <CardTitle>No Athletes Found</CardTitle>
            <CardDescription>
              There are no athletes associated with your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Heart className="h-8 w-8" />
            Medical Information
          </h1>
          <p className="text-muted-foreground">
            View and update medical information for your athletes
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/athletes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Athlete Selector (if multiple athletes) */}
      {athletes.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Athlete</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedAthleteId || undefined}
              onValueChange={(value) => {
                setSelectedAthleteId(value);
                setIsEditing(false);
              }}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select an athlete" />
              </SelectTrigger>
              <SelectContent>
                {athletes.map((athlete) => (
                  <SelectItem key={athlete.id} value={athlete.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={athlete.avatar || undefined} />
                        <AvatarFallback>
                          {athlete.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span>{athlete.name}</span>
                      <span className="text-muted-foreground">({athlete.level})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Selected Athlete Header */}
      {selectedAthlete && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={selectedAthlete.avatar || undefined} />
                <AvatarFallback className="text-xl">
                  {selectedAthlete.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{selectedAthlete.name}</h2>
                <p className="text-muted-foreground">
                  {selectedAthlete.level} - {selectedAthlete.group}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medical Info Content */}
      {medicalLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isEditing ? (
        <MedicalForm
          medicalInfo={medicalInfo}
          config={config}
          customQuestions={customQuestions}
          onSave={handleSave}
          isSaving={isSaving}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsEditing(true)}>
              {medicalInfo?.id ? "Edit Medical Info" : "Add Medical Info"}
            </Button>
          </div>
          <MedicalDisplay
            medicalInfo={medicalInfo}
            config={config}
            showEmptyState={true}
          />
        </div>
      )}

      {/* Alert for missing critical info */}
      {!medicalLoading && !isEditing && !medicalInfo?.emergencyContactPhone && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Missing Emergency Contact
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Please add an emergency contact for {selectedAthlete?.name}. This information is important for their safety.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsEditing(true)}
                >
                  Add Emergency Contact
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
