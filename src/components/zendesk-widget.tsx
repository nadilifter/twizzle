"use client"

import Script from "next/script"
import { useFeatures } from "@/components/feature-context"

export function ZendeskWidget() {
  const { isFeatureEnabled, isLoaded } = useFeatures()

  if (!isLoaded || !isFeatureEnabled("liveSupport")) return null

  const key = process.env.NEXT_PUBLIC_ZENDESK_KEY
  if (!key) return null

  return (
    <Script
      id="ze-snippet"
      src={`https://static.zdassets.com/ekr/snippet.js?key=${key}`}
      strategy="lazyOnload"
    />
  )
}
