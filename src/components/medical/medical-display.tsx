"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Pill,
  Heart,
  Phone,
  FileText,
  UtensilsCrossed,
  Shield,
  CheckCircle,
} from "lucide-react";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import type {
  AthleteMedicalInfoWithResponses,
  MedicalFormConfig,
  CustomMedicalQuestion,
} from "@/types/medical";

interface MedicalDisplayProps {
  medicalInfo: AthleteMedicalInfoWithResponses | null;
  config?: MedicalFormConfig | null;
  showEmptyState?: boolean;
  compact?: boolean;
}

export function MedicalDisplay({
  medicalInfo,
  config,
  showEmptyState = true,
  compact = false,
}: MedicalDisplayProps) {
  if (!medicalInfo && !showEmptyState) {
    return null;
  }

  const hasAllergies = medicalInfo?.allergies && medicalInfo.allergies.length > 0;
  const hasConditions = medicalInfo?.conditions && medicalInfo.conditions.length > 0;
  const hasMedications = medicalInfo?.medications && medicalInfo.medications.length > 0;
  const hasDietaryRestrictions =
    medicalInfo?.dietaryRestrictions && medicalInfo.dietaryRestrictions.length > 0;
  const hasEmergencyContact =
    medicalInfo?.emergencyContactName || medicalInfo?.emergencyContactPhone;
  const hasInsurance = medicalInfo?.insuranceProvider || medicalInfo?.insurancePolicyNumber;
  const hasCustomResponses = medicalInfo?.customResponses && medicalInfo.customResponses.length > 0;
  const hasMedicalAlerts = hasAllergies || hasConditions;

  if (!medicalInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Medical Information
          </CardTitle>
          <CardDescription>No medical information on file</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {hasMedicalAlerts && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Medical alerts on file</span>
          </div>
        )}
        {hasAllergies && (
          <div className="flex flex-wrap gap-1">
            {medicalInfo.allergies.map((allergy, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                {allergy}
              </Badge>
            ))}
          </div>
        )}
        {hasConditions && (
          <div className="flex flex-wrap gap-1">
            {medicalInfo.conditions.map((condition, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {condition}
              </Badge>
            ))}
          </div>
        )}
        {hasEmergencyContact && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {medicalInfo.emergencyContactName}
            {medicalInfo.emergencyContactPhone &&
              `: ${formatPhoneNumberIntl(medicalInfo.emergencyContactPhone) || medicalInfo.emergencyContactPhone}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Medical Information
          {hasMedicalAlerts && (
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Alerts
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {medicalInfo.updatedAt && (
            <>Last updated: {new Date(medicalInfo.updatedAt).toLocaleDateString()}</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Allergies */}
        {config?.collectAllergies !== false && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h4 className="font-medium">Allergies</h4>
            </div>
            {hasAllergies ? (
              <div className="flex flex-wrap gap-2">
                {medicalInfo.allergies.map((allergy, i) => (
                  <Badge key={i} variant="destructive">
                    {allergy}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                No known allergies
              </p>
            )}
          </div>
        )}

        {/* Medical Conditions */}
        {config?.collectConditions !== false && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-red-500" />
              <h4 className="font-medium">Medical Conditions</h4>
            </div>
            {hasConditions ? (
              <div className="flex flex-wrap gap-2">
                {medicalInfo.conditions.map((condition, i) => (
                  <Badge key={i} variant="secondary">
                    {condition}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                No known conditions
              </p>
            )}
          </div>
        )}

        {/* Medications */}
        {config?.collectMedications !== false && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pill className="h-4 w-4 text-blue-500" />
              <h4 className="font-medium">Current Medications</h4>
            </div>
            {hasMedications ? (
              <div className="flex flex-wrap gap-2">
                {medicalInfo.medications.map((medication, i) => (
                  <Badge key={i} variant="outline">
                    {medication}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No medications listed</p>
            )}
          </div>
        )}

        {/* Dietary Restrictions */}
        {config?.collectDietaryRestrictions !== false && hasDietaryRestrictions && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-4 w-4 text-orange-500" />
              <h4 className="font-medium">Dietary Restrictions</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {medicalInfo.dietaryRestrictions.map((restriction, i) => (
                <Badge key={i} variant="outline">
                  {restriction}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Emergency Contact */}
        {config?.collectEmergencyContact !== false && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-green-500" />
              <h4 className="font-medium">Emergency Contact</h4>
            </div>
            {hasEmergencyContact ? (
              <div className="text-sm space-y-1">
                {medicalInfo.emergencyContactName && (
                  <p>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    {medicalInfo.emergencyContactName}
                  </p>
                )}
                {medicalInfo.emergencyContactPhone && (
                  <p>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {formatPhoneNumberIntl(medicalInfo.emergencyContactPhone) ||
                      medicalInfo.emergencyContactPhone}
                  </p>
                )}
                {medicalInfo.emergencyContactRelation && (
                  <p>
                    <span className="text-muted-foreground">Relationship:</span>{" "}
                    {medicalInfo.emergencyContactRelation}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No emergency contact on file</p>
            )}
          </div>
        )}

        {/* Insurance */}
        {config?.collectInsuranceInfo !== false && hasInsurance && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <h4 className="font-medium">Insurance</h4>
            </div>
            <div className="text-sm space-y-1">
              {medicalInfo.insuranceProvider && (
                <p>
                  <span className="text-muted-foreground">Provider:</span>{" "}
                  {medicalInfo.insuranceProvider}
                </p>
              )}
              {medicalInfo.insurancePolicyNumber && (
                <p>
                  <span className="text-muted-foreground">Policy #:</span>{" "}
                  {medicalInfo.insurancePolicyNumber}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Custom Questions */}
        {hasCustomResponses && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-gray-500" />
                <h4 className="font-medium">Additional Information</h4>
              </div>
              <div className="space-y-3">
                {medicalInfo.customResponses.map((response) => (
                  <div key={response.id} className="text-sm">
                    <p className="text-muted-foreground">{response.question?.questionText}</p>
                    <p className="font-medium">{response.response}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Additional Notes */}
        {medicalInfo.additionalNotes && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h4 className="font-medium">Additional Notes</h4>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {medicalInfo.additionalNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact alert badge for athlete list views
interface MedicalAlertBadgeProps {
  medicalInfo: AthleteMedicalInfoWithResponses | null;
}

export function MedicalAlertBadge({ medicalInfo }: MedicalAlertBadgeProps) {
  if (!medicalInfo) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No info
      </Badge>
    );
  }

  const hasAllergies = medicalInfo.allergies && medicalInfo.allergies.length > 0;
  const hasConditions = medicalInfo.conditions && medicalInfo.conditions.length > 0;
  const hasMedicalAlerts = hasAllergies || hasConditions;

  if (hasMedicalAlerts) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {hasAllergies && hasConditions ? "Alerts" : hasAllergies ? "Allergies" : "Conditions"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
      <CheckCircle className="h-3 w-3" />
      Complete
    </Badge>
  );
}
