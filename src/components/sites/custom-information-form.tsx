"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SignaturePad, type SignaturePadRef } from "@/components/ui/signature-pad";
import { Loader2, Upload, Check, FileIcon, X } from "lucide-react";
import type { CustomInfoQuestion, CustomInfoResponse } from "@/types/custom-information";

interface CustomInformationFormProps {
  questions: CustomInfoQuestion[];
  existingResponses: CustomInfoResponse[];
  athleteId: string;
  organizationId: string;
  onComplete: () => void;
  onBack?: () => void;
}

interface FormValues {
  [questionId: string]: {
    responseValue?: string | null;
    signatureData?: string | null;
    file?: File | null;
    fileUrl?: string | null;
    fileName?: string | null;
  };
}

export function CustomInformationForm({
  questions,
  existingResponses,
  athleteId,
  organizationId,
  onComplete,
  onBack,
}: CustomInformationFormProps) {
  const [values, setValues] = useState<FormValues>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const signatureRefs = useRef<Record<string, SignaturePadRef | null>>({});

  useEffect(() => {
    const initial: FormValues = {};
    for (const q of questions) {
      const existing = existingResponses.find((r) => r.questionId === q.id);
      initial[q.id] = {
        responseValue: existing?.responseValue ?? null,
        signatureData: existing?.signatureData ?? null,
        fileUrl: existing?.fileUrl ?? null,
        fileName: existing?.fileName ?? null,
      };
    }
    setValues(initial);
  }, [questions, existingResponses]);

  const updateValue = useCallback((questionId: string, field: string, value: unknown) => {
    setValues((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const q of questions) {
      const val = values[q.id];

      if (q.questionType === "VALUE" && val?.responseValue?.trim()) {
        const num = Number(val.responseValue);
        if (isNaN(num)) {
          newErrors[q.id] = "Must be a number";
          continue;
        }
        if (!q.allowDecimals && !Number.isInteger(num)) {
          newErrors[q.id] = "Decimal values are not allowed";
          continue;
        }
        if (q.valueMin != null && num < q.valueMin) {
          newErrors[q.id] = `Must be at least ${q.valueMin}`;
          continue;
        }
        if (q.valueMax != null && num > q.valueMax) {
          newErrors[q.id] = `Must be at most ${q.valueMax}`;
          continue;
        }
      }

      if (!q.required) continue;
      switch (q.questionType) {
        case "VALUE":
        case "SHORT_TEXT":
        case "LONG_TEXT":
          if (!val?.responseValue?.trim()) {
            newErrors[q.id] = "This field is required";
          }
          break;
        case "BOOLEAN":
          if (q.requireSignatureOnYes && val?.responseValue === "true") {
            if (!val?.signatureData && signatureRefs.current[q.id]?.isEmpty()) {
              newErrors[q.id] = "Signature is required when answering Yes";
            }
          }
          break;
        case "SIGNATURE":
          if (!val?.signatureData && signatureRefs.current[q.id]?.isEmpty()) {
            newErrors[q.id] = "Signature is required";
          }
          break;
        case "IMAGE":
          if (!val?.file && !val?.fileUrl) {
            newErrors[q.id] = "File upload is required";
          }
          break;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    for (const q of questions) {
      const needsSignature =
        q.questionType === "SIGNATURE" ||
        (q.questionType === "BOOLEAN" &&
          q.requireSignatureOnYes &&
          values[q.id]?.responseValue === "true");
      if (needsSignature && signatureRefs.current[q.id]) {
        const sigRef = signatureRefs.current[q.id];
        if (sigRef && !sigRef.isEmpty()) {
          updateValue(q.id, "signatureData", sigRef.toDataURL());
          values[q.id] = { ...values[q.id], signatureData: sigRef.toDataURL() };
        }
      }
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Upload IMAGE files first
      for (const q of questions) {
        if (q.questionType === "IMAGE" && values[q.id]?.file) {
          const formData = new FormData();
          formData.append("file", values[q.id].file!);
          formData.append("athleteId", athleteId);
          formData.append("organizationId", organizationId);
          formData.append("questionId", q.id);

          const uploadRes = await fetch("/api/public/custom-information/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.error || "Failed to upload file");
          }
        }
      }

      // Submit text/boolean/signature responses
      const textResponses = questions
        .filter((q) => q.questionType !== "IMAGE")
        .map((q) => ({
          questionId: q.id,
          responseValue:
            q.questionType === "BOOLEAN"
              ? (values[q.id]?.responseValue ?? "false")
              : (values[q.id]?.responseValue ?? null),
          signatureData:
            q.questionType === "SIGNATURE" ||
            (q.questionType === "BOOLEAN" && q.requireSignatureOnYes)
              ? (values[q.id]?.signatureData ?? null)
              : null,
        }));

      if (textResponses.length > 0) {
        const res = await fetch(`/api/public/athletes/${athleteId}/custom-information`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            responses: textResponses,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to save responses");
        }
      }

      onComplete();
    } catch (error) {
      console.error("Error submitting custom info:", error);
      setErrors({ _form: error instanceof Error ? error.message : "Failed to save responses" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Additional Information</h3>
        <p className="text-sm text-muted-foreground">
          Please provide the following information to complete your registration.
        </p>
      </div>

      {errors._form && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm text-destructive">{errors._form}</p>
        </div>
      )}

      <div className="space-y-6">
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={values[q.id] || {}}
            error={errors[q.id]}
            onChange={(field, val) => updateValue(q.id, field, val)}
            signatureRef={(ref) => {
              signatureRefs.current[q.id] = ref;
            }}
          />
        ))}
      </div>

      <div className="flex justify-between pt-4">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={isSubmitting} className={onBack ? "" : "ml-auto"}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  error,
  onChange,
  signatureRef,
}: {
  question: CustomInfoQuestion;
  value: FormValues[string];
  error?: string;
  onChange: (field: string, val: unknown) => void;
  signatureRef: (ref: SignaturePadRef | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renderInput = () => {
    switch (question.questionType) {
      case "VALUE": {
        const rangeHint =
          question.valueMin != null && question.valueMax != null
            ? `${question.valueMin} – ${question.valueMax}${question.allowDecimals ? " (decimals allowed)" : " (whole numbers)"}`
            : undefined;
        return (
          <div className="space-y-1">
            <Input
              type="number"
              inputMode={question.allowDecimals ? "decimal" : "numeric"}
              step={question.allowDecimals ? "any" : "1"}
              min={question.valueMin ?? undefined}
              max={question.valueMax ?? undefined}
              value={value?.responseValue || ""}
              onChange={(e) => onChange("responseValue", e.target.value)}
              placeholder={rangeHint ? `Range: ${rangeHint}` : "Enter a value"}
            />
            {rangeHint && (
              <p className="text-xs text-muted-foreground">Accepted range: {rangeHint}</p>
            )}
          </div>
        );
      }

      case "BOOLEAN":
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Switch
                checked={value?.responseValue === "true"}
                onCheckedChange={(checked) => {
                  onChange("responseValue", checked ? "true" : "false");
                  if (!checked) onChange("signatureData", null);
                }}
              />
              <span className="text-sm text-muted-foreground">
                {value?.responseValue === "true" ? "Yes" : "No"}
              </span>
            </div>
            {question.requireSignatureOnYes && value?.responseValue === "true" && (
              <div className="space-y-2 border rounded-md p-3">
                <p className="text-sm font-medium">Signature required</p>
                {value?.signatureData ? (
                  <div className="relative border rounded-md p-2">
                    <img src={value.signatureData} alt="Signature" className="max-h-32 mx-auto" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => onChange("signatureData", null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <SignaturePad ref={signatureRef} height={150} />
                )}
              </div>
            )}
          </div>
        );

      case "SIGNATURE":
        return (
          <div className="space-y-2">
            {value?.signatureData ? (
              <div className="relative border rounded-md p-2">
                <img src={value.signatureData} alt="Signature" className="max-h-32 mx-auto" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1"
                  onClick={() => onChange("signatureData", null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <SignaturePad ref={signatureRef} height={150} />
            )}
          </div>
        );

      case "SHORT_TEXT":
        return (
          <Input
            value={value?.responseValue || ""}
            onChange={(e) => onChange("responseValue", e.target.value)}
            placeholder="Enter your response"
          />
        );

      case "LONG_TEXT":
        return (
          <Textarea
            value={value?.responseValue || ""}
            onChange={(e) => onChange("responseValue", e.target.value)}
            placeholder="Enter your response"
            rows={4}
          />
        );

      case "IMAGE":
        return (
          <div className="space-y-2">
            {value?.file || value?.fileUrl ? (
              <div className="flex items-center gap-2 border rounded-md p-3">
                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">
                  {value?.file?.name || value?.fileName || "Uploaded file"}
                </span>
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("file", null);
                    onChange("fileUrl", null);
                    onChange("fileName", null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload (PNG, JPG, PDF, max 10 MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onChange("file", file);
                  onChange("fileName", file.name);
                }
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-1">
        <Label className="text-base">{question.questionText}</Label>
        {question.required && <span className="text-destructive text-sm">*</span>}
      </div>
      {question.description && (
        <p className="text-sm text-muted-foreground">{question.description}</p>
      )}
      {renderInput()}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
