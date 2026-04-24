"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, GraduationCap, Layers } from "lucide-react";
import Link from "next/link";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function TrainingPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Training"
        description="Manage your skills database, evaluations, and program levels."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Skills</CardTitle>
                <CardDescription>Build and manage your skills database</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/training/skills">Manage Skills</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Evaluations</CardTitle>
                <CardDescription>Create templates and track athlete progress</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/training/evaluations">Manage Evaluations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Levels</CardTitle>
                <CardDescription>Define skill and program progression levels</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/training/levels">Manage Levels</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
