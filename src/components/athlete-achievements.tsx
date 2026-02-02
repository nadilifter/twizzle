"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Star, Target, Calendar } from "lucide-react"
import { format } from "date-fns"
import { api } from "@/lib/api-client"
import { toast } from "sonner"
import type { AthleteAchievementsResponse, SkillDifficulty } from "@/types/evaluations"

const difficultyColors: Record<SkillDifficulty, string> = {
  BEGINNER: "bg-green-500/10 text-green-700 dark:text-green-400",
  INTERMEDIATE: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  ADVANCED: "bg-red-500/10 text-red-700 dark:text-red-400",
}

interface AthleteAchievementsProps {
  athleteId: string
  showEarnedOnly?: boolean
  compact?: boolean
}

export function AthleteAchievements({ 
  athleteId, 
  showEarnedOnly = false,
  compact = false,
}: AthleteAchievementsProps) {
  const [data, setData] = useState<AthleteAchievementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchAchievements = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string> = {}
      if (showEarnedOnly) {
        params.earnedOnly = "true"
      }
      
      const response = await api.get<AthleteAchievementsResponse>(
        `/api/athletes/${athleteId}/achievements`,
        params
      )
      setData(response)
    } catch (error) {
      console.error("Error fetching achievements:", error)
      toast.error("Failed to load achievements")
    } finally {
      setIsLoading(false)
    }
  }, [athleteId, showEarnedOnly])

  useEffect(() => {
    fetchAchievements()
  }, [fetchAchievements])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {compact ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-12 rounded-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-32 w-full" />
          </>
        )}
      </div>
    )
  }

  if (!data || data.achievements.length === 0) {
    if (compact) return null
    
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="font-semibold mb-2">No Achievements Yet</h4>
          <p className="text-sm text-muted-foreground text-center">
            Complete evaluations to earn achievements
          </p>
        </CardContent>
      </Card>
    )
  }

  const earnedAchievements = data.achievements.filter((a) => a.earned)
  const inProgressAchievements = data.achievements.filter((a) => !a.earned)

  // Compact view - just show earned badges
  if (compact) {
    if (earnedAchievements.length === 0) return null
    
    return (
      <div className="flex flex-wrap gap-2">
        {earnedAchievements.slice(0, 5).map((achievement) => (
          <div
            key={achievement.id}
            className="flex items-center gap-2 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-full px-3 py-1"
            title={`${achievement.name} - Earned ${achievement.earnedAt ? format(new Date(achievement.earnedAt), "MMM d, yyyy") : ""}`}
          >
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-medium">{achievement.name}</span>
          </div>
        ))}
        {earnedAchievements.length > 5 && (
          <span className="text-sm text-muted-foreground">
            +{earnedAchievements.length - 5} more
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold">{data.summary.earned} Earned</span>
        </div>
        {data.summary.inProgress > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target className="h-5 w-5" />
            <span>{data.summary.inProgress} In Progress</span>
          </div>
        )}
      </div>

      {/* Earned Achievements */}
      {earnedAchievements.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Earned Achievements
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {earnedAchievements.map((achievement) => (
              <Card key={achievement.id} className="bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border-yellow-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {achievement.badgeImageUrl ? (
                      <img 
                        src={achievement.badgeImageUrl} 
                        alt={achievement.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-yellow-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">{achievement.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {achievement.templateName}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge className={`${difficultyColors[achievement.templateDifficulty]} text-xs`}>
                      {achievement.templateDifficulty}
                    </Badge>
                    {achievement.earnedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(achievement.earnedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  {achievement.overallScore && (
                    <p className="text-sm font-medium mt-2">
                      Score: {Number(achievement.overallScore).toFixed(1)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* In Progress Achievements */}
      {!showEarnedOnly && inProgressAchievements.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            In Progress
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgressAchievements.map((achievement) => (
              <Card key={achievement.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {achievement.badgeImageUrl ? (
                      <img 
                        src={achievement.badgeImageUrl} 
                        alt={achievement.name}
                        className="h-12 w-12 rounded-lg object-cover opacity-50"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                        <Trophy className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">{achievement.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {achievement.templateName}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Badge className={`${difficultyColors[achievement.templateDifficulty]} text-xs`}>
                    {achievement.templateDifficulty}
                  </Badge>
                  {achievement.progress && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {achievement.progress.passedCount} / {achievement.progress.requiredCount} skills
                        </span>
                        <span className="font-medium">
                          {Math.round(achievement.progress.percentage)}%
                        </span>
                      </div>
                      <Progress value={achievement.progress.percentage} className="h-2" />
                    </div>
                  )}
                  {achievement.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {achievement.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Simple badge display for inline use
export function AthleteAchievementsBadges({ athleteId }: { athleteId: string }) {
  return <AthleteAchievements athleteId={athleteId} showEarnedOnly compact />
}
