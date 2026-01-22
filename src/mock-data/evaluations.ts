
export type Skill = {
  name: string
  rating: number // 1-5
  comment?: string
}

export type Evaluation = {
  id: string
  date: string
  coach: string
  level: string
  overallScore: number
  status: "Pass" | "Retry" | "Excellent" | "Satisfactory"
  notes: string
  skills: Skill[]
}

export const evaluations: Evaluation[] = [
  {
    id: "EVAL-001",
    date: "2023-10-15",
    coach: "Coach Sarah",
    level: "Level 8",
    overallScore: 4.5,
    status: "Excellent",
    notes: "Sophia showed great improvement in her floor routine. Vault landing needs a bit more work.",
    skills: [
        { name: "Floor Routine", rating: 5, comment: "Excellent artistry" },
        { name: "Vault", rating: 4, comment: "Landing stability" },
        { name: "Uneven Bars", rating: 5 },
        { name: "Beam", rating: 4 }
    ]
  },
  {
    id: "EVAL-002",
    date: "2023-09-10",
    coach: "Coach Mike",
    level: "Level 8",
    overallScore: 4.0,
    status: "Satisfactory",
    notes: "Good effort overall. Consistency on beam is improving.",
    skills: [
        { name: "Floor Routine", rating: 4 },
        { name: "Vault", rating: 4 },
        { name: "Uneven Bars", rating: 4 },
        { name: "Beam", rating: 3, comment: "Wobbly on dismount" }
    ]
  }
]

