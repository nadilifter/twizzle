"use client"

import * as React from "react"
import { Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SAMPLES = {
  members: {
    filename: "members_template.csv",
    content: "Name,Email,Phone,Status,JoinDate\nJohn Doe,john@example.com,555-0123,Active,2023-01-01\nJane Smith,jane@example.com,555-0124,Active,2023-02-15"
  },
  results: {
    filename: "results_template.csv",
    content: "AthleteID,AthleteName,Event,Score,Date,Competition\nATH-001,Sophia Miller,Vault,9.5,2023-10-15,Fall Classic\nATH-002,Olivia Chen,Bars,9.2,2023-10-15,Fall Classic"
  },
  payments: {
    filename: "payments_template.csv",
    content: "Date,Description,Amount,Method,Status,Reference\n2023-11-26,Tuition - Elite Squad,150.00,Visa,Settled,REF123456\n2023-11-25,Uniform Purchase,85.50,Mastercard,Authorised,REF123457"
  },
  skills: {
    filename: "skills_template.csv",
    content: "Name,Event,Level,Difficulty,Description\nBack Handspring,Floor,Advanced,C,Jump backwards onto hands and push off to land on feet\nCast Handstand,Bars,Advanced,C,Cast from support to handstand position"
  },
  athletes: {
    filename: "athletes_template.csv",
    content: "Name,Level,Group,Status,Email,Parent\nSophia Miller,Level 8,Elite Squad,Active,sophia.m@example.com,Sarah Miller\nOlivia Chen,Elite,National Team,Active,olivia.c@example.com,David Chen"
  },
  users: {
    filename: "users_template.csv",
    content: "Name,Email,Role,Status\nAndrew Karzel,andrew@uplifterinc.com,Admin,Active\nCoach Mike,mike@uplifterinc.com,Coach,Active"
  }
}

type UploadType = keyof typeof SAMPLES

const UPLOAD_OPTIONS: { value: UploadType; label: string; description: string }[] = [
  { value: "members", label: "Members", description: "Import new members or update existing member details." },
  { value: "results", label: "Results", description: "Bulk import competition results and scores for athletes." },
  { value: "payments", label: "Payments", description: "Import historical payment records or external transactions." },
  { value: "skills", label: "Skills", description: "Add new skills to the training database in bulk." },
  { value: "athletes", label: "Athletes", description: "Register multiple athletes at once. Requires parent information." },
  { value: "users", label: "Users", description: "Create system user accounts for staff, coaches, and admins." },
]

export default function BulkUploadPage() {
  const [activeType, setActiveType] = React.useState<UploadType | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadStatus, setUploadStatus] = React.useState<"idle" | "success" | "error">("idle")

  const handleDownloadSample = (type: UploadType) => {
    const sample = SAMPLES[type]
    const blob = new Blob([sample.content], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", sample.filename)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    setUploadStatus("idle")

    // Simulate upload delay
    setTimeout(() => {
      setIsUploading(false)
      setUploadStatus("success")
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setUploadStatus("idle")
      }, 3000)
    }, 1500)
  }

  const activeOption = activeType ? UPLOAD_OPTIONS.find(opt => opt.value === activeType) : null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Bulk Upload</h1>
        <p className="text-muted-foreground">
          Upload large datasets efficiently using CSV templates.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="w-full max-w-xs">
          <Label htmlFor="upload-type" className="mb-2 block">Select Upload Type</Label>
          <Select onValueChange={(v) => setActiveType(v as UploadType)}>
            <SelectTrigger id="upload-type">
              <SelectValue placeholder="Choose what to upload..." />
            </SelectTrigger>
            <SelectContent>
              {UPLOAD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeOption && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Upload {activeOption.label}</CardTitle>
              <CardDescription>{activeOption.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">Template CSV</p>
                      <p className="text-xs text-muted-foreground">
                        Download the sample file to prepare your data.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadSample(activeType!)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Sample
                  </Button>
                </div>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor={`file-${activeType}`}>Upload CSV</Label>
                  <Input id={`file-${activeType}`} type="file" accept=".csv" required />
                </div>

                {uploadStatus === "success" && (
                  <Alert className="bg-green-50 text-green-900 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>
                      Your file has been uploaded successfully. The data is being processed.
                    </AlertDescription>
                  </Alert>
                )}
              </form>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-bounce" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {activeOption.label}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
