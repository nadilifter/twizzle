export interface ActionItem {
  id: string
  title: string
  description: string
  url: string
  isComplete: boolean
  icon: string
}

export interface ActionItemsResponse {
  items: ActionItem[]
  completedCount: number
  totalCount: number
  allComplete: boolean
}
