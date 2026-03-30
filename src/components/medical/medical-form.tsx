"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Pill,
  Heart,
  Phone,
  UtensilsCrossed,
  Shield,
} from "lucide-react";
import type {
  AthleteMedicalInfoWithResponses,
  MedicalFormConfig,
  CustomMedicalQuestion,
  UpsertAthleteMedicalInfoPayload,
} from "@/types/medical";
import {
  COMMON_ALLERGIES,
  COMMON_CONDITIONS,
  DIETARY_RESTRICTIONS,
  EMERGENCY_CONTACT_RELATIONSHIPS,
} from "@/types/medical";

interface MedicalFormProps {
  medicalInfo: AthleteMedicalInfoWithResponses | null;
  config: MedicalFormConfig | null;
  customQuestions: CustomMedicalQuestion[];
  onSave: (data: UpsertAthleteMedicalInfoPayload) => Promise<boolean>;
  isSaving?: boolean;
  onCancel?: () => void;
}

export function MedicalForm({
  medicalInfo,
  config,
  customQuestions,
  onSave,
  isSaving = false,
  onCancel,
}: MedicalFormProps) {
  // Form state
  const [allergies, setAllergies] = useState<string[]>(medicalInfo?.allergies || []);
  const [newAllergy, setNewAllergy] = useState("");
  const [medications, setMedications] = useState<string[]>(medicalInfo?.medications || []);
  const [newMedication, setNewMedication] = useState("");
  const [conditions, setConditions] = useState<string[]>(medicalInfo?.conditions || []);
  const [newCondition, setNewCondition] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    medicalInfo?.dietaryRestrictions || []
  );
  const [insuranceProvider, setInsuranceProvider] = useState(medicalInfo?.insuranceProvider || "");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState(
    medicalInfo?.insurancePolicyNumber || ""
  );
  const [emergencyContactName, setEmergencyContactName] = useState(
    medicalInfo?.emergencyContactName || ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    medicalInfo?.emergencyContactPhone || ""
  );
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(
    medicalInfo?.emergencyContactRelation || ""
  );
  const [additionalNotes, setAdditionalNotes] = useState(medicalInfo?.additionalNotes || "");

  // Custom responses state
  const [customResponses, setCustomResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    medicalInfo?.customResponses?.forEach((r) => {
      initial[r.questionId] = r.response;
    });
    return initial;
  });

  // Handlers for array fields
  const addAllergy = () => {
    if (newAllergy.trim() && !allergies.includes(newAllergy.trim())) {
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy("");
    }
  };

  const removeAllergy = (allergy: string) => {
    setAllergies(allergies.filter((a) => a !== allergy));
  };

  const addMedication = () => {
    if (newMedication.trim() && !medications.includes(newMedication.trim())) {
      setMedications([...medications, newMedication.trim()]);
      setNewMedication("");
    }
  };

  const removeMedication = (medication: string) => {
    setMedications(medications.filter((m) => m !== medication));
  };

  const addCondition = () => {
    if (newCondition.trim() && !conditions.includes(newCondition.trim())) {
      setConditions([...conditions, newCondition.trim()]);
      setNewCondition("");
    }
  };

  const removeCondition = (condition: string) => {
    setConditions(conditions.filter((c) => c !== condition));
  };

  const toggleDietaryRestriction = (restriction: string) => {
    if (dietaryRestrictions.includes(restriction)) {
      setDietaryRestrictions(dietaryRestrictions.filter((r) => r !== restriction));
    } else {
      setDietaryRestrictions([...dietaryRestrictions, restriction]);
    }
  };

  const handleCustomResponseChange = (questionId: string, value: string) => {
    setCustomResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: UpsertAthleteMedicalInfoPayload = {
      allergies,
      medications,
      conditions,
      dietaryRestrictions,
      insuranceProvider: insuranceProvider || null,
      insurancePolicyNumber: insurancePolicyNumber || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyContactRelation: emergencyContactRelation || null,
      additionalNotes: additionalNotes || null,
      customResponses: Object.entries(customResponses)
        .filter(([_, response]) => response.trim())
        .map(([questionId, response]) => ({ questionId, response })),
    };

    await onSave(data);
  };

  const renderCustomQuestion = (question: CustomMedicalQuestion) => {
    const value = customResponses[question.id] || "";

    switch (question.questionType) {
      case "YES_NO":
        return (
          <RadioGroup
            value={value}
            onValueChange={(v) => handleCustomResponseChange(question.id, v)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`}>Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="No" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`}>No</Label>
            </div>
          </RadioGroup>
        );

      case "MULTIPLE_CHOICE":
        return (
          <RadioGroup
            value={value}
            onValueChange={(v) => handleCustomResponseChange(question.id, v)}
          >
            {((question.options as string[]) || []).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "CHECKBOX":
        const selectedOptions = value ? value.split(",").filter(Boolean) : [];
        return (
          <div className="space-y-2">
            {((question.options as string[]) || []).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${i}`}
                  checked={selectedOptions.includes(option)}
                  onCheckedChange={(checked) => {
                    const newSelected = checked
                      ? [...selectedOptions, option]
                      : selectedOptions.filter((o) => o !== option);
                    handleCustomResponseChange(question.id, newSelected.join(","));
                  }}
                />
                <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
              </div>
            ))}
          </div>
        );

      case "TEXT":
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleCustomResponseChange(question.id, e.target.value)}
            placeholder="Enter your response"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Medical Information
          </CardTitle>
          <CardDescription>
            Please provide accurate medical information to ensure athlete safety
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Allergies */}
          {config?.collectAllergies !== false && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Allergies
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allergies.map((allergy, i) => (
                  <Badge key={i} variant="destructive" className="gap-1">
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(allergy)}
                      className="ml-1 hover:bg-red-700 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (v && !allergies.includes(v)) {
                      setAllergies([...allergies, v]);
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Add common allergy" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_ALLERGIES.filter((a) => !allergies.includes(a)).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 flex gap-2">
                  <Input
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    placeholder="Or type a custom allergy"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAllergy())}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addAllergy}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Medical Conditions */}
          {config?.collectConditions !== false && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Medical Conditions
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {conditions.map((condition, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {condition}
                    <button
                      type="button"
                      onClick={() => removeCondition(condition)}
                      className="ml-1 hover:bg-gray-300 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (v && !conditions.includes(v)) {
                      setConditions([...conditions, v]);
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Add common condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CONDITIONS.filter((c) => !conditions.includes(c)).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 flex gap-2">
                  <Input
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    placeholder="Or type a custom condition"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCondition())}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addCondition}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Medications */}
          {config?.collectMedications !== false && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-blue-500" />
                Current Medications
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {medications.map((medication, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    {medication}
                    <button
                      type="button"
                      onClick={() => removeMedication(medication)}
                      className="ml-1 hover:bg-gray-200 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  placeholder="Add medication"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMedication())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addMedication}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Dietary Restrictions */}
          {config?.collectDietaryRestrictions !== false && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                Dietary Restrictions
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DIETARY_RESTRICTIONS.map((restriction) => (
                  <div key={restriction} className="flex items-center space-x-2">
                    <Checkbox
                      id={`diet-${restriction}`}
                      checked={dietaryRestrictions.includes(restriction)}
                      onCheckedChange={() => toggleDietaryRestriction(restriction)}
                    />
                    <Label htmlFor={`diet-${restriction}`} className="text-sm">
                      {restriction}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Emergency Contact */}
          {config?.collectEmergencyContact !== false && (
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                Emergency Contact
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Name</Label>
                  <Input
                    id="emergencyName"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <PhoneInput
                    id="emergencyPhone"
                    defaultCountry="US"
                    value={emergencyContactPhone}
                    onChange={(value) => setEmergencyContactPhone(value || "")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relationship</Label>
                  <Select
                    value={emergencyContactRelation}
                    onValueChange={setEmergencyContactRelation}
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

          {/* Insurance */}
          {config?.collectInsuranceInfo !== false && (
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-500" />
                Insurance Information
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                  <Input
                    id="insuranceProvider"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    placeholder="e.g., Blue Cross Blue Shield"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                  <Input
                    id="insurancePolicyNumber"
                    value={insurancePolicyNumber}
                    onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                    placeholder="Policy number"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom Questions */}
          {customQuestions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium">Additional Questions</h4>
                {customQuestions.map((question) => (
                  <div key={question.id} className="space-y-2">
                    <Label>
                      {question.questionText}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {renderCustomQuestion(question)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Any additional medical information we should know about..."
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Medical Information
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
